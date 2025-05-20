import { useEffect, useState, useRef } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import CommunicationPanel from "@/components/CommunicationPanel";

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
    createChannel
  } = useWorkspace();

  // Make sure we have initialized channels for this project
  const projectChannels = channels[projectId] || [];
  
  // Set the active channel ID if not set and channels exist
  useEffect(() => {
    if (projectChannels.length > 0 && !activeChannelId) {
      setActiveChannelId(projectChannels[0].id);
    }
  }, [projectChannels, activeChannelId]);
  
  return (
    <CommunicationPanel
      projectId={projectId}
      currentUserId={currentUserId}
      messages={activeChannelId ? messages[activeChannelId] || [] : []}
      channels={projectChannels.map(channel => ({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        isPrivate: channel.isPrivate,
        unreadCount: channel.unreadCount
      }))}
      onSendMessage={(content, channelId, attachments) => {
        sendMessage(content, channelId, attachments);
        notifications.addNotification(
          'info',
          'Message Sent',
          `Your message has been sent to the ${
            projectChannels.find(c => c.id === channelId)?.name || 'channel'
          }.`
        );
      }}
      onCreateChannel={(name, isPrivate, description) => {
        createChannel(projectId, name, isPrivate, description);
      }}
      initialChatModalOpen={showChatModal}
      onCloseChatModal={() => setShowChatModal(false)}
      onChangeChannel={(channelId) => setActiveChannelId(channelId)}
    />
  );
}
