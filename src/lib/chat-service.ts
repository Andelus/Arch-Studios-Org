/**
 * Chat service for managing channels and messages through Supabase
 */

import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

// Types
export interface Channel {
  id: string;
  project_id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  unread_count?: number; // calculated field
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  is_announcement: boolean;
  metadata: {
    attachments?: MessageAttachment[];
    sender_name?: string;
    sender_avatar?: string;
    reactions?: MessageReaction[];
  };
  created_at: string;
  updated_at: string;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  file_size?: number;
  created_at: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[]; // array of user IDs
}

export interface ChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  created_at: string;
}

export interface UserChannelState {
  id: string;
  channel_id: string;
  user_id: string;
  last_read_message_id?: string;
  last_read_at?: string;
  created_at: string;
  updated_at: string;
}

// Create new channel
export async function createChannel(
  projectId: string,
  organizationId: string,
  name: string,
  isPrivate: boolean,
  description?: string,
  initialMembers: string[] = []
): Promise<{ success: boolean, data?: Channel, error?: any }> {
  try {
    // Create the channel
    const { data: channel, error } = await supabase
      .from('channels')
      .insert({
        project_id: projectId,
        organization_id: organizationId,
        name: name,
        description: description,
        is_private: isPrivate
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // If it's a private channel, add the initial members
    if (isPrivate && initialMembers.length > 0 && channel) {
      const memberRecords = initialMembers.map(userId => ({
        channel_id: channel.id,
        user_id: userId
      }));

      const { error: membersError } = await supabase
        .from('channel_members')
        .insert(memberRecords);

      if (membersError) {
        console.error('Error adding channel members:', membersError);
      }
    }

    return { success: true, data: channel };
  } catch (error) {
    console.error('Error creating channel:', error);
    return { success: false, error };
  }
}

// Get channels for a project
export async function getChannelsForProject(
  projectId: string,
  userId: string
): Promise<{ success: boolean, data?: Channel[], error?: any }> {
  try {
    let query = supabase
      .from('channels')
      .select(`
        *,
        channel_members!inner(user_id)
      `)
      .eq('project_id', projectId)
      .or(`is_private.eq.false,and(is_private.eq.true,channel_members.user_id.eq.${userId})`);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Get unread count for each channel
    const channelsWithUnreadCount = await Promise.all(
      data.map(async (channel) => {
        const unreadCount = await getUnreadMessageCount(channel.id, userId);
        return {
          ...channel,
          unread_count: unreadCount
        };
      })
    );

    return { success: true, data: channelsWithUnreadCount };
  } catch (error) {
    console.error('Error fetching channels:', error);
    return { success: false, error };
  }
}

// Get messages for a channel
export async function getMessagesForChannel(
  channelId: string,
  limit: number = 50,
  before?: string
): Promise<{ success: boolean, data?: Message[], error?: any }> {
  try {
    let query = supabase
      .from('messages')
      .select(`
        *,
        message_attachments(*)
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply pagination if provided
    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Transform the data to match the Message interface
    const messages = data.map(msg => {
      const attachments = msg.message_attachments || [];
      
      return {
        ...msg,
        metadata: {
          ...msg.metadata,
          attachments
        }
      };
    });

    return { success: true, data: messages.reverse() }; // Reverse to get oldest first
  } catch (error) {
    console.error('Error fetching messages:', error);
    return { success: false, error };
  }
}

// Send a message
export async function sendMessage(
  channelId: string,
  userId: string,
  content: string,
  isAnnouncement: boolean = false,
  senderName?: string,
  senderAvatar?: string,
  attachments?: File[]
): Promise<{ success: boolean, data?: Message, error?: any }> {
  try {
    // Create message metadata
    const metadata: any = {};
    if (senderName) metadata.sender_name = senderName;
    if (senderAvatar) metadata.sender_avatar = senderAvatar;

    // Insert the message
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        user_id: userId,
        content,
        is_announcement: isAnnouncement,
        metadata
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Handle file attachments if any
    if (attachments && attachments.length > 0) {
      // Upload files to storage
      const uploadPromises = attachments.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const filePath = `message-attachments/${channelId}/${message.id}/${uuidv4()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, file);
          
        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          return null;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(filePath);
        
        // Create attachment record
        const { data: attachment, error: attachmentError } = await supabase
          .from('message_attachments')
          .insert({
            message_id: message.id,
            file_name: file.name,
            file_type: file.type,
            file_url: publicUrl,
            file_size: file.size
          })
          .select()
          .single();
          
        if (attachmentError) {
          console.error('Error creating attachment record:', attachmentError);
          return null;
        }
        
        return attachment;
      });

      const attachmentResults = await Promise.all(uploadPromises);
      const validAttachments = attachmentResults.filter(Boolean);
      
      // Update message with attachments in metadata
      if (validAttachments.length > 0) {
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            metadata: {
              ...message.metadata,
              attachments: validAttachments
            }
          })
          .eq('id', message.id);
          
        if (updateError) {
          console.error('Error updating message with attachments:', updateError);
        } else {
          message.metadata = {
            ...message.metadata,
            attachments: validAttachments
          };
        }
      }
    }

    return { success: true, data: message };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error };
  }
}

// Mark channel as read
export async function markChannelAsRead(
  channelId: string,
  userId: string,
  messageId?: string
): Promise<{ success: boolean, error?: any }> {
  try {
    // If no messageId is provided, get the latest message in the channel
    if (!messageId) {
      const { data: latestMessage, error } = await supabase
        .from('messages')
        .select('id')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
        throw error;
      }

      if (latestMessage) {
        messageId = latestMessage.id;
      }
    }

    if (messageId) {
      // Update or insert user_channel_state
      const { error } = await supabase
        .from('user_channel_states')
        .upsert({
          channel_id: channelId,
          user_id: userId,
          last_read_message_id: messageId,
          last_read_at: new Date().toISOString()
        }, { 
          onConflict: 'channel_id,user_id'
        });

      if (error) {
        throw error;
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error marking channel as read:', error);
    return { success: false, error };
  }
}

// Get unread message count for a channel
export async function getUnreadMessageCount(
  channelId: string,
  userId: string
): Promise<number> {
  try {
    // Get user's last read message timestamp
    const { data: userState, error: stateError } = await supabase
      .from('user_channel_states')
      .select('last_read_at')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .maybeSingle();

    if (stateError) {
      throw stateError;
    }

    // If no state exists, all messages are unread
    if (!userState || !userState.last_read_at) {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channelId);

      if (error) {
        throw error;
      }

      return count || 0;
    }

    // Count messages since last read
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId)
      .gt('created_at', userState.last_read_at);

    if (error) {
      throw error;
    }

    return count || 0;
  } catch (error) {
    console.error('Error getting unread message count:', error);
    return 0;
  }
}

// Add members to private channel
export async function addChannelMembers(
  channelId: string,
  userIds: string[]
): Promise<{ success: boolean, error?: any }> {
  try {
    const memberRecords = userIds.map(userId => ({
      channel_id: channelId,
      user_id: userId
    }));

    const { error } = await supabase
      .from('channel_members')
      .insert(memberRecords);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error adding channel members:', error);
    return { success: false, error };
  }
}

// Remove member from private channel
export async function removeChannelMember(
  channelId: string,
  userId: string
): Promise<{ success: boolean, error?: any }> {
  try {
    const { error } = await supabase
      .from('channel_members')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error removing channel member:', error);
    return { success: false, error };
  }
}

// Initialize default channels for a new project
export async function initializeDefaultChannels(
  projectId: string,
  organizationId: string
): Promise<{ success: boolean, data?: Channel[], error?: any }> {
  try {
    // Call the database function to create default channels
    const { error: functionError } = await supabase.rpc('create_default_project_channels', {
      p_project_id: projectId,
      p_organization_id: organizationId
    });

    if (functionError) {
      throw functionError;
    }

    // Get the newly created channels
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error initializing default channels:', error);
    return { success: false, error };
  }
}

// Delete a channel
export async function deleteChannel(channelId: string): Promise<{ success: boolean, error?: any }> {
  try {
    const { error } = await supabase
      .from('channels')
      .delete()
      .eq('id', channelId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting channel:', error);
    return { success: false, error };
  }
}

// Update a channel
export async function updateChannel(
  channelId: string,
  updates: { name?: string; description?: string; is_private?: boolean }
): Promise<{ success: boolean, data?: Channel, error?: any }> {
  try {
    const { data, error } = await supabase
      .from('channels')
      .update(updates)
      .eq('id', channelId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error updating channel:', error);
    return { success: false, error };
  }
}

// Delete a message
export async function deleteMessage(messageId: string): Promise<{ success: boolean, error?: any }> {
  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting message:', error);
    return { success: false, error };
  }
}

// Edit a message
export async function editMessage(
  messageId: string,
  content: string
): Promise<{ success: boolean, data?: Message, error?: any }> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', messageId)
      .select(`
        *,
        message_attachments(*)
      `)
      .single();

    if (error) {
      throw error;
    }

    // Transform the data to match the Message interface
    const message = {
      ...data,
      metadata: {
        ...data.metadata,
        attachments: data.message_attachments || []
      }
    };

    return { success: true, data: message };
  } catch (error) {
    console.error('Error editing message:', error);
    return { success: false, error };
  }
}

// Get channel members
export async function getChannelMembers(
  channelId: string
): Promise<{ success: boolean, data?: ChannelMember[], error?: any }> {
  try {
    const { data, error } = await supabase
      .from('channel_members')
      .select('*')
      .eq('channel_id', channelId);

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching channel members:', error);
    return { success: false, error };
  }
}

// Subscribe to new messages in a channel
export function subscribeToChannel(
  channelId: string,
  callback: (message: Message) => void
) {
  return supabase
    .channel(`channel-${channelId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${channelId}`
      },
      async (payload) => {
        const message = payload.new as Message;
        
        // Fetch attachments if any
        if (message) {
          const { data } = await supabase
            .from('message_attachments')
            .select('*')
            .eq('message_id', message.id);
            
          if (data && data.length > 0) {
            message.metadata = {
              ...message.metadata,
              attachments: data
            };
          }
          
          callback(message);
        }
      }
    )
    .subscribe();
}

// Subscribe to channel updates
export function subscribeToChannelUpdates(
  projectId: string,
  callback: (channel: Channel) => void
) {
  return supabase
    .channel(`project-channels-${projectId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'channels',
        filter: `project_id=eq.${projectId}`
      },
      (payload) => {
        if (payload.new) {
          callback(payload.new as Channel);
        }
      }
    )
    .subscribe();
}

// Subscribe to channel read status updates
export function subscribeToChannelReadStatus(
  channelId: string,
  userId: string,
  callback: (state: UserChannelState) => void
) {
  return supabase
    .channel(`channel-status-${channelId}-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_channel_states',
        filter: `channel_id=eq.${channelId},user_id=eq.${userId}`
      },
      (payload) => {
        if (payload.new) {
          callback(payload.new as UserChannelState);
        }
      }
    )
    .subscribe();
}
