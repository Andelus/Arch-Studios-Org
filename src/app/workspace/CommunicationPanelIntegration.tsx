import { useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import CommunicationPanel from "@/components/CommunicationPanel";
import { useUser } from "@clerk/nextjs";

interface CommunicationPanelIntegrationProps {
  projectId: string;
  currentUserId: string;
  notifications: {
    addNotification: (
      type: "info" | "success" | "warning" | "error" | "team_invitation" | "invitation_accepted" | "invitation_reminder", 
      title: string, 
      message: string,
      link?: string,
      metadata?: Record<string, any>
    ) => Promise<string>;
  };
}

export function CommunicationPanelIntegration({
  projectId,
  currentUserId,
  notifications
}: CommunicationPanelIntegrationProps) {
  const [activeChannelId, setActiveChannelId] = useState<string>("");
  const [showChatModal, setShowChatModal] = useState(false);
  const { user } = useUser();
  
  // Listen for the triggerChatOpen event
  useEffect(() => {
    const handleTriggerChat = () => {
      setShowChatModal(true);
    };
    
    document.addEventListener('triggerChatOpen', handleTriggerChat);
    
    return () => {
      document.removeEventListener('triggerChatOpen', handleTriggerChat);
    };
  }, []);
  
  const {
    channels,
    messages,
    sendMessage,
    createChannel,
    loadChannelsForProject,
    loadMessagesForChannel,
    markChannelRead
  } = useWorkspace();

  // Load channels when the component mounts
  useEffect(() => {
    if (projectId) {
      loadChannelsForProject(projectId);
    }
  }, [projectId, loadChannelsForProject]);
  
  // Load messages when the active channel changes
  useEffect(() => {
    if (activeChannelId) {
      loadMessagesForChannel(activeChannelId);
      markChannelRead(activeChannelId);
    }
  }, [activeChannelId, loadMessagesForChannel, markChannelRead]);

  // Make sure we have initialized channels for this project
  const projectChannels = channels[projectId] || [];
  
  // Set the active channel ID if not set and channels exist
  useEffect(() => {
    if (projectChannels.length > 0 && !activeChannelId) {
      setActiveChannelId(projectChannels[0].id);
    }
  }, [projectChannels, activeChannelId]);
  
  // Convert WorkspaceMessages to the format expected by CommunicationPanel
  const activeChannelMessages = activeChannelId ? 
    (messages[activeChannelId] || []).map(msg => ({
      id: msg.id,
      content: msg.content,
      sender: msg.sender,
      timestamp: msg.timestamp,
      attachments: msg.attachments,
      isAnnouncement: msg.is_announcement
    })) : [];
  
  return (
    <CommunicationPanel
      projectId={projectId}
      currentUserId={currentUserId}
      messages={activeChannelMessages}
      channels={projectChannels.map(channel => ({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        isPrivate: channel.isPrivate,
        unreadCount: channel.unreadCount
      }))}
      onSendMessage={async (content, channelId, attachments) => {
        await sendMessage(content, channelId, attachments);
        notifications.addNotification(
          'info',
          'Message Sent',
          `Your message has been sent to the ${
            projectChannels.find(c => c.id === channelId)?.name || 'channel'
          }.`
        );
      }}
      onCreateChannel={async (name, isPrivate, description) => {
        await createChannel(projectId, name, isPrivate, description);
        notifications.addNotification(
          'success',
          'Channel Created',
          `The ${name} channel has been created successfully.`
        );
      }}
      initialChatModalOpen={showChatModal}
      onCloseChatModal={() => setShowChatModal(false)}
      onChangeChannel={(channelId) => {
        setActiveChannelId(channelId);
        markChannelRead(channelId);
      }}
    />
  );
}
