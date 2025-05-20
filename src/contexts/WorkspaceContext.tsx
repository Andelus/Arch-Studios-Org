"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useUser } from '@clerk/nextjs';
import { 
  Channel as ChatChannel, 
  Message as ChatMessage, 
  MessageAttachment, 
  createChannel as createChatChannel,
  getChannelsForProject, 
  getMessagesForChannel,
  sendMessage as sendChatMessage,
  initializeDefaultChannels,
  subscribeToChannel,
  subscribeToChannelUpdates,
  markChannelAsRead,
  getUnreadMessageCount,
  deleteChannel as deleteChatChannel,
  updateChannel as updateChatChannel
} from '@/lib/chat-service';
import { supabase } from '@/lib/supabase';
import { Asset } from '@/types/asset';

// Workspace message interface that combines ChatMessage with UI-specific properties
interface WorkspaceMessage {
  id: string;
  content: string;
  channel_id: string;
  user_id: string;
  is_announcement: boolean;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
  
  // UI-specific properties 
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  timestamp: string;
  attachments?: {
    id: string;
    name: string;
    url: string;
    type: string;
  }[];
}

// Workspace channel interface that combines ChatChannel with UI-specific properties
interface WorkspaceChannel {
  id: string;
  name: string;
  description?: string;
  is_private: boolean;
  project_id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  
  // UI-specific properties
  unreadCount?: number;
  isPrivate: boolean; // Duplicate of is_private for UI compatibility
}

interface WorkspaceContextType {
  // Asset Management
  projectAssets: Record<string, Asset[]>;
  uploadAsset: (
    projectId: string, 
    file: File, 
    description: string,
    tags: string[],
    category?: 'concept' | 'schematic' | 'documentation-ready'
  ) => Promise<void>;
  deleteAsset: (projectId: string, assetId: string) => void;
  editAsset: (projectId: string, assetId: string, updates: Partial<Asset>) => void;
  approveAsset: (projectId: string, assetId: string, comment?: string) => void;
  rejectAsset: (projectId: string, assetId: string, comment: string) => void;
  requestChanges: (projectId: string, assetId: string, comment: string) => void;
  initializeProject: (projectId: string, organizationId: string) => Promise<void>;
  
  // Communication
  channels: Record<string, WorkspaceChannel[]>;
  messages: Record<string, WorkspaceMessage[]>;
  sendMessage: (content: string, channelId: string, attachments?: File[]) => Promise<void>;
  createChannel: (
    projectId: string,
    name: string, 
    isPrivate: boolean, 
    description?: string
  ) => Promise<void>;
  updateChannel: (
    channelId: string,
    updates: { name?: string; description?: string; isPrivate?: boolean }
  ) => Promise<void>;
  deleteChannel: (channelId: string) => Promise<void>;
  markChannelRead: (channelId: string) => Promise<void>;
  
  // Active state
  activeView: 'project' | 'tasks' | 'assets' | 'communication';
  setActiveView: (view: 'project' | 'tasks' | 'assets' | 'communication') => void;
  
  // Utility
  loadChannelsForProject: (projectId: string) => Promise<void>;
  loadMessagesForChannel: (channelId: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

// Sample data for asset development
const SAMPLE_ASSETS: Record<string, Asset[]> = {
  'proj-1': [
    {
      id: 'asset-1',
      name: 'Facade Design.pdf',
      type: 'document' as const,
      url: '/assets/facade-design.pdf',
      dateUploaded: '2025-05-14T15:30:00Z',
      uploadedBy: 'Alex Johnson',
      uploaderId: 'user-1',
      size: '2.4 MB',
      description: 'Final facade design with updated client requirements',
      tags: ['facade', 'client-approved', 'final'],
      status: 'approved'
    },
    {
      id: 'asset-2',
      name: 'Lobby Visualization.jpg',
      type: 'image' as const,
      url: '/assets/lobby-viz.jpg',
      thumbnailUrl: '/assets/thumbnails/lobby-viz-thumb.jpg',
      dateUploaded: '2025-05-12T10:15:00Z',
      uploadedBy: 'Maria Garcia',
      uploaderId: 'user-2',
      size: '3.8 MB',
      tags: ['interior', 'visualization', 'lobby'],
      status: 'approved'
    },
    {
      id: 'asset-3',
      name: 'Building Model v2.2.glb',
      type: 'model' as const,
      url: '/assets/building-model-v2.2.glb',
      dateUploaded: '2025-05-10T09:45:00Z',
      uploadedBy: 'Sam Patel',
      uploaderId: 'user-3',
      size: '15.7 MB',
      description: 'Updated 3D model with roof garden and solar panels',
      tags: ['3D-model', 'exterior', 'update'],
      status: 'pending'
    }
  ],
  'proj-2': [
    {
      id: 'asset-4',
      name: 'Site Plan.pdf',
      type: 'document' as const,
      url: '/assets/site-plan.pdf',
      dateUploaded: '2025-05-16T11:20:00Z',
      uploadedBy: 'Alex Johnson',
      uploaderId: 'user-1',
      size: '1.8 MB',
      description: 'Site plan with topography and landscape elements',
      tags: ['site-plan', 'landscape'],
      status: 'changes-requested'
    }
  ]
};

export const WorkspaceProvider: React.FC<{
  children: React.ReactNode,
  initialProjectId?: string
}> = ({ children, initialProjectId }) => {
  const [projectAssets, setProjectAssets] = useState<Record<string, Asset[]>>(SAMPLE_ASSETS);
  const [channels, setChannels] = useState<Record<string, WorkspaceChannel[]>>({});
  const [messages, setMessages] = useState<Record<string, WorkspaceMessage[]>>({});
  const [activeView, setActiveView] = useState<'project' | 'tasks' | 'assets' | 'communication'>('project');
  const [subscriptions, setSubscriptions] = useState<Record<string, any>>({});
  
  const { addNotification } = useNotifications();
  const { user } = useUser();
  
  const generateId = (prefix: string) => {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  };
  
  // Asset Management Functions
  const uploadAsset = async (
    projectId: string,
    file: File,
    description: string,
    tags: string[],
    category?: 'concept' | 'schematic' | 'documentation-ready'
  ) => {
    // In a real app, we'd upload to storage and get a URL
    const fileType = file.type.split('/')[0];
    // Convert to one of the allowed types
    const assetType = fileType === 'image' ? 'image' : 
                      fileType === 'video' ? 'video' : 
                      fileType === 'model' ? 'model' :
                      fileType === 'application' && file.name.endsWith('.pdf') ? 'document' :
                      'other';
                      
    const newAsset: Asset = {
      id: generateId('asset'),
      name: file.name,
      type: assetType,
      url: URL.createObjectURL(file),
      dateUploaded: new Date().toISOString(),
      uploadedBy: user?.fullName || 'Current User',
      uploaderId: user?.id || 'current-user',
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      description,
      tags,
      category,
      status: 'pending'
    };
    
    // Add thumbnail if it's an image
    if (file.type.startsWith('image/')) {
      newAsset.thumbnailUrl = newAsset.url;
    }
    
    // Update state
    setProjectAssets(prev => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), newAsset]
    }));
    
    // Notify
    addNotification(
      'success',
      'Asset Uploaded',
      `${file.name} has been uploaded successfully and is pending approval.`
    );
  };
  
  const deleteAsset = (projectId: string, assetId: string) => {
    // Update state by filtering out the asset
    setProjectAssets(prev => ({
      ...prev,
      [projectId]: prev[projectId].filter(asset => asset.id !== assetId)
    }));
    
    // Notify
    addNotification(
      'info',
      'Asset Deleted',
      'The asset has been successfully deleted.'
    );
  };
  
  const editAsset = (projectId: string, assetId: string, updates: Partial<Asset>) => {
    // Update state by mapping through assets and updating the matching one
    setProjectAssets(prev => ({
      ...prev,
      [projectId]: prev[projectId].map(asset => 
        asset.id === assetId ? { ...asset, ...updates } : asset
      )
    }));
    
    // Notify
    addNotification(
      'success',
      'Asset Updated',
      'The asset has been successfully updated.'
    );
  };
  
  // Asset Review Functions
  const approveAsset = (projectId: string, assetId: string, comment?: string) => {
    // Update state by mapping through assets and updating the matching one
    setProjectAssets(prev => ({
      ...prev,
      [projectId]: prev[projectId].map(asset => 
        asset.id === assetId ? {
          ...asset,
          status: 'approved',
          approvalData: {
            ...asset.approvalData,
            reviewerId: user?.id || 'current-user',
            reviewerName: user?.fullName || 'Current User',
            reviewDate: new Date().toISOString(),
            comments: comment || 'Approved without comments'
          }
        } : asset
      )
    }));
    
    // Get asset information for improved notification
    const asset = projectAssets[projectId]?.find(asset => asset.id === assetId);
    const assetName = asset?.name || 'Asset';
    const uploader = asset?.uploaderId;
    
    // Notify reviewer
    addNotification(
      'success',
      'Asset Approved',
      `You've approved "${assetName}".`,
      undefined,
      {
        assetId,
        projectId,
        action: 'approve'
      }
    );
    
    // In a real app, we would also send a notification to the uploader
    // This simulates notifying the uploader
    addNotification(
      'success',
      'Asset Approved',
      `Your asset "${assetName}" has been approved.`,
      undefined,
      {
        assetId,
        projectId,
        action: 'approval-notification',
        forUser: uploader
      }
    );
  };
  
  const rejectAsset = (projectId: string, assetId: string, comment: string) => {
    // Update state by mapping through assets and updating the matching one
    setProjectAssets(prev => ({
      ...prev,
      [projectId]: prev[projectId].map(asset => 
        asset.id === assetId ? {
          ...asset,
          status: 'rejected',
          approvalData: {
            ...asset.approvalData,
            reviewerId: user?.id || 'current-user',
            reviewerName: user?.fullName || 'Current User',
            reviewDate: new Date().toISOString(),
            comments: comment
          }
        } : asset
      )
    }));
    
    // Get asset information for improved notification
    const asset = projectAssets[projectId]?.find(asset => asset.id === assetId);
    const assetName = asset?.name || 'Asset';
    const uploader = asset?.uploaderId;
    
    // Notify reviewer
    addNotification(
      'warning',
      'Asset Rejected',
      `You've rejected "${assetName}".`,
      undefined,
      {
        assetId,
        projectId,
        action: 'reject'
      }
    );
    
    // In a real app, we would also send a notification to the uploader
    // This simulates notifying the uploader
    addNotification(
      'error',
      'Asset Rejected',
      `Your asset "${assetName}" has been rejected. Please check the review comments.`,
      undefined,
      {
        assetId,
        projectId,
        action: 'reject-notification',
        forUser: uploader
      }
    );
  };
  
  const requestChanges = (projectId: string, assetId: string, comment: string) => {
    // Update state by mapping through assets and updating the matching one
    setProjectAssets(prev => ({
      ...prev,
      [projectId]: prev[projectId].map(asset => 
        asset.id === assetId ? {
          ...asset,
          status: 'changes-requested',
          approvalData: {
            ...asset.approvalData,
            reviewerId: user?.id || 'current-user',
            reviewerName: user?.fullName || 'Current User',
            reviewDate: new Date().toISOString(),
            comments: comment
          }
        } : asset
      )
    }));
    
    // Get asset information for improved notification
    const asset = projectAssets[projectId]?.find(asset => asset.id === assetId);
    const assetName = asset?.name || 'Asset';
    const uploader = asset?.uploaderId;
    
    // Notify reviewer
    addNotification(
      'info',
      'Changes Requested',
      `You've requested changes to "${assetName}".`,
      undefined,
      {
        assetId,
        projectId,
        action: 'request-changes'
      }
    );
    
    // In a real app, we would also send a notification to the uploader
    // This simulates notifying the uploader
    addNotification(
      'warning',
      'Changes Requested',
      `A reviewer has requested changes to your asset "${assetName}". Please check the review comments.`,
      undefined,
      {
        assetId,
        projectId,
        action: 'changes-requested-notification',
        forUser: uploader
      }
    );
  };
  
  // Communication Functions - Updated to use chat-service
  const loadChannelsForProject = useCallback(async (projectId: string) => {
    if (!user) {
      console.warn("Cannot load channels: User not authenticated");
      return;
    }
    
    try {
      console.log(`Loading channels for project: ${projectId}, user: ${user.id}`);
      const { data, error } = await getChannelsForProject(projectId, user.id);
      if (error) {
        console.error("Error loading channels:", error);
        throw new Error(`Failed to load channels: ${error.message || 'Unknown error'}`);
      }
      
      if (!data || data.length === 0) {
        console.log(`No channels found for project: ${projectId}. This may be normal for a new project.`);
      }
      
      if (data) {
        // Convert to WorkspaceChannel format
        const workspaceChannels = data.map(channel => ({
          ...channel,
          isPrivate: channel.is_private,
          unreadCount: channel.unread_count || 0
        }));
        
        // Update channels state
        setChannels(prev => ({
          ...prev,
          [projectId]: workspaceChannels
        }));
        
        // Subscribe to channel updates
        const unsubscribe = subscribeToChannelUpdates(projectId, (updatedChannel) => {
          setChannels(prev => {
            const projectChannels = prev[projectId] || [];
            const channelIndex = projectChannels.findIndex(c => c.id === updatedChannel.id);
            
            if (channelIndex >= 0) {
              // Update existing channel
              const updatedChannels = [...projectChannels];
              updatedChannels[channelIndex] = {
                ...updatedChannel,
                isPrivate: updatedChannel.is_private,
                unreadCount: updatedChannels[channelIndex].unreadCount
              };
              return {
                ...prev,
                [projectId]: updatedChannels
              };
            } else {
              // Add new channel
              return {
                ...prev,
                [projectId]: [...projectChannels, {
                  ...updatedChannel,
                  isPrivate: updatedChannel.is_private,
                  unreadCount: 0
                }]
              };
            }
          });
        });
        
        // Store the subscription for cleanup
        setSubscriptions(prev => ({
          ...prev,
          [`channel-updates-${projectId}`]: unsubscribe
        }));
      }
    } catch (error: any) {
      console.error('Error loading channels for project:', error);
      
      // Set default channels array to avoid UI issues
      setChannels(prev => ({
        ...prev,
        [projectId]: prev[projectId] || []
      }));
      
      const errorMessage = error?.message || 'Unknown error occurred';
      
      addNotification(
        'warning',
        'Channel loading issue',
        `Could not load communication channels. ${errorMessage}. Please try refreshing the page.`
      );
    }
  }, [user, addNotification]);
  
  const loadMessagesForChannel = useCallback(async (channelId: string) => {
    try {
      const { data, error } = await getMessagesForChannel(channelId);
      if (error) throw error;
      
      if (data) {
        // Convert to WorkspaceMessage format
        const workspaceMessages = data.map(message => {
          // Create message attachments if any
          const attachments = message.metadata?.attachments?.map((attachment: MessageAttachment) => ({
            id: attachment.id,
            name: attachment.file_name,
            url: attachment.file_url,
            type: attachment.file_type
          }));
          
          return {
            ...message,
            sender: {
              id: message.user_id,
              name: message.metadata?.sender_name || 'Unknown',
              avatar: message.metadata?.sender_avatar
            },
            timestamp: message.created_at,
            attachments
          };
        });
        
        // Update messages state
        setMessages(prev => ({
          ...prev,
          [channelId]: workspaceMessages
        }));
        
        // Mark channel as read
        if (user) {
          await markChannelAsRead(channelId, user.id);
          
          // Update local unread count
          const projectId = Object.keys(channels).find(pId => 
            channels[pId]?.some(channel => channel.id === channelId)
          );
          
          if (projectId) {
            setChannels(prev => ({
              ...prev,
              [projectId]: prev[projectId].map(channel => 
                channel.id === channelId ? { ...channel, unreadCount: 0 } : channel
              )
            }));
          }
        }
        
        // Subscribe to new messages
        const unsubscribe = subscribeToChannel(channelId, (newMessage) => {
          // Convert the new message to WorkspaceMessage format
          const attachments = newMessage.metadata?.attachments?.map((attachment: MessageAttachment) => ({
            id: attachment.id,
            name: attachment.file_name,
            url: attachment.file_url,
            type: attachment.file_type
          }));
          
          const workspaceMessage: WorkspaceMessage = {
            ...newMessage,
            sender: {
              id: newMessage.user_id,
              name: newMessage.metadata?.sender_name || 'Unknown',
              avatar: newMessage.metadata?.sender_avatar
            },
            timestamp: newMessage.created_at,
            attachments
          };
          
          // Update messages
          setMessages(prev => ({
            ...prev,
            [channelId]: [...(prev[channelId] || []), workspaceMessage]
          }));
          
          // Update unread count for the channel if this is not from the current user
          if (user && newMessage.user_id !== user.id) {
            const channelProjectId = Object.keys(channels).find(projectId => 
              channels[projectId]?.some(channel => channel.id === channelId)
            );
            
            if (channelProjectId) {
              setChannels(prev => {
                const projectChannels = prev[channelProjectId] || [];
                return {
                  ...prev,
                  [channelProjectId]: projectChannels.map(channel => 
                    channel.id === channelId 
                      ? { ...channel, unreadCount: (channel.unreadCount || 0) + 1 }
                      : channel
                  )
                };
              });
            }
          }
        });
        
        // Store the subscription for cleanup
        setSubscriptions(prev => ({
          ...prev,
          [`message-updates-${channelId}`]: unsubscribe
        }));
      }
    } catch (error) {
      console.error('Error loading messages for channel:', error);
      addNotification(
        'error',
        'Failed to load messages',
        'There was an error loading the messages for this channel.'
      );
    }
  }, [user, channels, addNotification]);
  
  const sendMessage = useCallback(async (content: string, channelId: string, attachments?: File[]) => {
    if (!user) {
      addNotification(
        'error',
        'Not authenticated',
        'You need to be logged in to send messages.'
      );
      return;
    }
    
    try {
      const { data, error } = await sendChatMessage(
        channelId, 
        user.id, 
        content,
        false, // Not an announcement
        user.fullName || undefined,
        user.imageUrl || undefined,
        attachments
      );
      
      if (error) throw error;
      
      // Message will be added via subscription, no need to update state here
      
    } catch (error) {
      console.error('Error sending message:', error);
      addNotification(
        'error',
        'Failed to send message',
        'There was an error sending your message. Please try again.'
      );
    }
  }, [user, addNotification]);
  
  const createChannel = useCallback(async (
    projectId: string,
    name: string,
    isPrivate: boolean,
    description?: string
  ) => {
    if (!user) return;
    
    // Get organization ID from Supabase for the current user and project
    const { data: orgData, error: orgError } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .single();
      
    if (orgError) {
      console.error('Error getting organization ID:', orgError);
      addNotification(
        'error',
        'Failed to create channel',
        'Could not determine organization information.'
      );
      return;
    }
    
    const organizationId = orgData.organization_id;
    if (!organizationId) {
      addNotification(
        'error',
        'Failed to create channel',
        'Organization ID not found for this project.'
      );
      return;
    }
    
    try {
      const initialMembers = isPrivate ? [user.id] : [];
      
      const { data, error } = await createChatChannel(
        projectId,
        organizationId,
        name,
        isPrivate,
        description,
        initialMembers
      );
      
      if (error) throw error;
      
      // Channel will be added via subscription, no need to update state here
      
      addNotification(
        'success',
        'Channel Created',
        `The ${name} channel has been created successfully.`
      );
    } catch (error) {
      console.error('Error creating channel:', error);
      addNotification(
        'error',
        'Failed to create channel',
        'There was an error creating the channel. Please try again.'
      );
    }
  }, [user, addNotification]);
  
  const updateChannel = useCallback(async (
    channelId: string, 
    updates: { name?: string; description?: string; isPrivate?: boolean }
  ) => {
    try {
      const { data, error } = await updateChatChannel(channelId, {
        name: updates.name,
        description: updates.description,
        is_private: updates.isPrivate
      });
      
      if (error) throw error;
      
      // Channel will be updated via subscription, no need to update state here
      
      addNotification(
        'success',
        'Channel Updated',
        'The channel has been updated successfully.'
      );
    } catch (error) {
      console.error('Error updating channel:', error);
      addNotification(
        'error',
        'Failed to update channel',
        'There was an error updating the channel. Please try again.'
      );
    }
  }, [addNotification]);
  
  const deleteChannel = useCallback(async (channelId: string) => {
    try {
      // Find out which project this channel belongs to
      let projectId = '';
      for (const [pId, projectChannels] of Object.entries(channels)) {
        if (projectChannels.some(channel => channel.id === channelId)) {
          projectId = pId;
          break;
        }
      }
      
      // Delete the channel
      const { error } = await deleteChatChannel(channelId);
      if (error) throw error;
      
      // Update local state
      if (projectId) {
        setChannels(prev => ({
          ...prev,
          [projectId]: (prev[projectId] || []).filter(channel => channel.id !== channelId)
        }));
      }
      
      // Remove messages for this channel
      setMessages(prev => {
        const newMessages = { ...prev };
        delete newMessages[channelId];
        return newMessages;
      });
      
      // Clean up subscriptions
      if (subscriptions[`message-updates-${channelId}`]) {
        subscriptions[`message-updates-${channelId}`]();
        setSubscriptions(prev => {
          const newSubs = { ...prev };
          delete newSubs[`message-updates-${channelId}`];
          return newSubs;
        });
      }
      
      addNotification(
        'info',
        'Channel Deleted',
        'The channel has been deleted successfully.'
      );
    } catch (error) {
      console.error('Error deleting channel:', error);
      addNotification(
        'error',
        'Failed to delete channel',
        'There was an error deleting the channel. Please try again.'
      );
    }
  }, [channels, subscriptions, addNotification]);
  
  const markChannelRead = useCallback(async (channelId: string) => {
    if (!user) return;
    
    try {
      await markChannelAsRead(channelId, user.id);
      
      // Update local unread count
      const projectId = Object.keys(channels).find(pId => 
        channels[pId]?.some(channel => channel.id === channelId)
      );
      
      if (projectId) {
        setChannels(prev => ({
          ...prev,
          [projectId]: prev[projectId].map(channel => 
            channel.id === channelId ? { ...channel, unreadCount: 0 } : channel
          )
        }));
      }
    } catch (error) {
      console.error('Error marking channel as read:', error);
    }
  }, [user, channels]);
  
  // Initialize a new project with default assets and channels
  const initializeProject = useCallback(async (projectId: string, organizationId: string) => {
    // Initialize empty assets array for this project
    setProjectAssets(prev => ({
      ...prev,
      [projectId]: []
    }));
    
    // Create default channels
    try {
      console.log(`Initializing default channels for project: ${projectId}, organization: ${organizationId}`);
      const { data, error } = await initializeDefaultChannels(projectId, organizationId);
      
      if (error) {
        console.error("Error initializing default channels:", error);
        throw new Error(`Failed to initialize channels: ${error.message || 'Unknown error'}`);
      }
      
      console.log(`Default channels created successfully for project: ${projectId}`);
      
      // Load channels for the project
      if (user) {
        await loadChannelsForProject(projectId);
      }
    } catch (error: any) {
      console.error('Error initializing project channels:', error);
      addNotification(
        'warning',
        'Channel Setup Issue',
        `Unable to set up communication channels: ${error?.message || 'Unknown error'}. Please try again or contact support.`
      );
    }
  }, [user, loadChannelsForProject, addNotification]);
  
  // Clean up subscriptions when component unmounts
  useEffect(() => {
    return () => {
      // Unsubscribe from all subscriptions
      Object.values(subscriptions).forEach(unsubscribe => {
        // Handle both function types and RealtimeChannel types
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        } else if (unsubscribe && typeof unsubscribe.unsubscribe === 'function') {
          unsubscribe.unsubscribe();
        }
      });
    };
  }, [subscriptions]);

  return (
    <WorkspaceContext.Provider value={{
      // Asset Management
      projectAssets,
      uploadAsset,
      deleteAsset,
      editAsset,
      approveAsset,
      rejectAsset,
      requestChanges,
      initializeProject,
      
      // Communication
      channels,
      messages,
      sendMessage,
      createChannel,
      updateChannel,
      deleteChannel,
      markChannelRead,
      
      // Active state
      activeView,
      setActiveView,
      
      // Utility
      loadChannelsForProject,
      loadMessagesForChannel
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
