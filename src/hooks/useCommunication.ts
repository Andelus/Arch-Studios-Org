import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';

interface Channel {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  project_id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  content: string;
  channel_id: string;
  user_id: string;
  is_announcement: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    name: string;
    avatar: string;
  };
}

export function useCommunication(projectId?: string) {
  const { user } = useUser();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  // Load channels for a project
  const loadChannels = useCallback(async () => {
    if (!projectId || !user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setChannels(data || []);
      
      // Select the first channel by default
      if (data && data.length > 0 && !selectedChannelId) {
        setSelectedChannelId(data[0].id);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading channels:', error);
      setLoading(false);
    }
  }, [projectId, user, selectedChannelId]);

  // Load messages for a channel
  const loadMessages = useCallback(async (channelId: string) => {
    if (!channelId || !user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          channel_id,
          user_id,
          is_announcement,
          created_at,
          updated_at,
          profiles(
            display_name,
            avatar_url
          )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedMessages = data?.map(message => {
        let displayName = 'Unknown';
        let avatarUrl = '/avatars/default.jpg';
        if (Array.isArray(message.profiles) && message.profiles.length > 0) {
          displayName = message.profiles[0].display_name || 'Unknown';
          avatarUrl = message.profiles[0].avatar_url || '/avatars/default.jpg';
        }
        return {
          id: message.id,
          content: message.content,
          channel_id: message.channel_id,
          user_id: message.user_id,
          is_announcement: message.is_announcement,
          created_at: message.created_at,
          updated_at: message.updated_at,
          user: message.profiles ? {
            name: displayName,
            avatar: avatarUrl
          } : undefined
        };
      }) || [];

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, [user]);

  // Load initial channels
  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // Load messages when a channel is selected
  useEffect(() => {
    if (selectedChannelId) {
      loadMessages(selectedChannelId);
    } else {
      setMessages([]);
    }
  }, [selectedChannelId, loadMessages]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!projectId || !user) return;

    // Subscribe to channels
    const channelsSubscription = supabase
      .channel(`channels-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: `project_id=eq.${projectId}`
        },
        () => {
          loadChannels();
        }
      )
      .subscribe();

    // Subscribe to messages for the current channel
    let messagesSubscription: any;
    
    if (selectedChannelId) {
      messagesSubscription = supabase
        .channel(`messages-${selectedChannelId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `channel_id=eq.${selectedChannelId}`
          },
          () => {
            loadMessages(selectedChannelId);
          }
        )
        .subscribe();
    }

    return () => {
      channelsSubscription.unsubscribe();
      if (messagesSubscription) {
        messagesSubscription.unsubscribe();
      }
    };
  }, [projectId, user, selectedChannelId, loadChannels, loadMessages]);

  // Create a new channel
  const createChannel = async (channelData: {
    name: string;
    description?: string;
    isPrivate: boolean;
  }) => {
    if (!projectId || !user) {
      throw new Error('Project or user not available');
    }

    try {
      // Get organization ID from the project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('organization_id')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      const { data: newChannel, error } = await supabase
        .from('channels')
        .insert({
          name: channelData.name,
          description: channelData.description || null,
          is_private: channelData.isPrivate,
          project_id: projectId,
          organization_id: projectData.organization_id
        })
        .select()
        .single();

      if (error) throw error;

      // Add welcome message
      await supabase
        .from('messages')
        .insert({
          content: `Welcome to the ${channelData.name} channel!`,
          channel_id: newChannel.id,
          user_id: user.id,
          is_announcement: true
        });

      // Reload channels (this will happen via real-time subscription)
      return newChannel;
    } catch (error) {
      console.error('Error creating channel:', error);
      throw error;
    }
  };

  // Send a message
  const sendMessage = async (content: string) => {
    if (!selectedChannelId || !user) {
      throw new Error('Channel or user not available');
    }

    try {
      const { data: newMessage, error } = await supabase
        .from('messages')
        .insert({
          content,
          channel_id: selectedChannelId,
          user_id: user.id,
          is_announcement: false
        })
        .select()
        .single();

      if (error) throw error;

      // Message will be added via real-time subscription
      return newMessage;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  return {
    channels,
    selectedChannelId,
    setSelectedChannelId,
    messages,
    loading,
    createChannel,
    sendMessage
  };
}
