"use client";

import { useState, useRef, useEffect } from 'react';
import styles from './CommunicationPanel.module.css';

interface Message {
  id: string;
  content: string;
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
  isAnnouncement?: boolean;
}

interface Channel {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  unreadCount?: number;
}

interface CommunicationPanelProps {
  projectId: string;
  currentUserId: string;
  messages: Message[];
  channels: Channel[];
  onSendMessage: (content: string, channelId: string, attachments?: File[]) => void;
  onCreateChannel: (name: string, isPrivate: boolean, description?: string) => void;
}

export default function CommunicationPanel({
  projectId,
  currentUserId,
  messages,
  channels,
  onSendMessage,
  onCreateChannel
}: CommunicationPanelProps) {
  const [activeChannelId, setActiveChannelId] = useState<string>(channels[0]?.id || '');
  const [messageInput, setMessageInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [newChannelIsPrivate, setNewChannelIsPrivate] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Auto scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, activeChannelId]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim() || attachments.length > 0) {
      onSendMessage(messageInput.trim(), activeChannelId, attachments.length > 0 ? attachments : undefined);
      setMessageInput('');
      setAttachments([]);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };
  
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (newChannelName.trim()) {
      onCreateChannel(newChannelName.trim(), newChannelIsPrivate, newChannelDescription.trim() || undefined);
      setNewChannelName('');
      setNewChannelDescription('');
      setNewChannelIsPrivate(false);
      setIsCreatingChannel(false);
    }
  };
  
  // Filter messages for active channel
  const channelMessages = messages.filter(msg => {
    const channel = channels.find(c => c.id === activeChannelId);
    if (!channel) return false;
    
    // General channel includes announcements
    if (channel.name === 'General') {
      return true;
    }
    
    // Other channels don't show announcements
    return !msg.isAnnouncement;
  });
  
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };
  
  const activeChannel = channels.find(c => c.id === activeChannelId);
  
  return (
    <div className={styles.communicationPanel}>
      <div className={styles.sidebar}>
        <div className={styles.channelHeader}>
          <h3>Channels</h3>
          <button 
            className={styles.addChannelButton}
            onClick={() => setIsCreatingChannel(true)}
          >
            <i className="fas fa-plus"></i>
          </button>
        </div>
        
        <div className={styles.channelList}>
          {channels.map(channel => (
            <div
              key={channel.id}
              className={`${styles.channelItem} ${activeChannelId === channel.id ? styles.active : ''}`}
              onClick={() => setActiveChannelId(channel.id)}
            >
              <div className={styles.channelIcon}>
                {channel.isPrivate ? (
                  <i className="fas fa-lock"></i>
                ) : (
                  <i className="fas fa-hashtag"></i>
                )}
              </div>
              <div className={styles.channelInfo}>
                <span className={styles.channelName}>{channel.name}</span>
                {channel.unreadCount && channel.unreadCount > 0 && (
                  <span className={styles.unreadBadge}>{channel.unreadCount}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className={styles.messageArea}>
        <div className={styles.messageHeader}>
          <div className={styles.channelTitle}>
            {activeChannel?.isPrivate ? (
              <i className="fas fa-lock"></i>
            ) : (
              <i className="fas fa-hashtag"></i>
            )}
            <h3>{activeChannel?.name || 'Select a channel'}</h3>
          </div>
          {activeChannel?.description && (
            <div className={styles.channelDescription}>
              {activeChannel.description}
            </div>
          )}
        </div>
        
        <div className={styles.messageList}>
          {channelMessages.length > 0 ? (
            channelMessages.map((message, index) => (
              <div 
                key={message.id} 
                className={`${styles.messageItem} ${
                  message.sender.id === currentUserId ? styles.ownMessage : ''
                } ${message.isAnnouncement ? styles.announcement : ''}`}
              >
                {message.isAnnouncement && (
                  <div className={styles.announcementBanner}>
                    <i className="fas fa-bullhorn"></i> Announcement
                  </div>
                )}
                <div className={styles.messageContent}>
                  <div className={styles.messageSender}>
                    {message.sender.avatar ? (
                      <img src={message.sender.avatar} alt={message.sender.name} />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {message.sender.name.charAt(0)}
                      </div>
                    )}
                    <span className={styles.senderName}>{message.sender.name}</span>
                    <span className={styles.messageTime}>{formatTime(message.timestamp)}</span>
                  </div>
                  <p className={styles.messageText}>{message.content}</p>
                  
                  {message.attachments && message.attachments.length > 0 && (
                    <div className={styles.attachmentList}>
                      {message.attachments.map(attachment => (
                        <div key={attachment.id} className={styles.attachmentItem}>
                          <div className={styles.attachmentIcon}>
                            {attachment.type.startsWith('image/') ? (
                              <i className="fas fa-image"></i>
                            ) : attachment.type.includes('pdf') ? (
                              <i className="fas fa-file-pdf"></i>
                            ) : (
                              <i className="fas fa-file"></i>
                            )}
                          </div>
                          <span className={styles.attachmentName}>{attachment.name}</span>
                          <a 
                            href={attachment.url} 
                            download 
                            className={styles.attachmentDownload}
                          >
                            <i className="fas fa-download"></i>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>
                <i className="fas fa-comments"></i>
              </div>
              <p>No messages yet in this channel.</p>
              <p className={styles.emptyStateSubtitle}>Be the first to send a message!</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form className={styles.messageInput} onSubmit={handleSendMessage}>
          {attachments.length > 0 && (
            <div className={styles.attachmentPreview}>
              {attachments.map((file, index) => (
                <div key={index} className={styles.attachmentPreviewItem}>
                  <span className={styles.attachmentPreviewName}>{file.name}</span>
                  <button 
                    type="button"
                    className={styles.removeAttachmentButton}
                    onClick={() => removeAttachment(index)}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className={styles.messageInputRow}>
            <button 
              type="button" 
              className={styles.attachButton}
              onClick={() => fileInputRef.current?.click()}
            >
              <i className="fas fa-paperclip"></i>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }} 
                multiple 
              />
            </button>
            <input 
              type="text"
              placeholder={`Message ${activeChannel?.name || '...'}`}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
            />
            <button 
              type="submit" 
              className={styles.sendButton} 
              disabled={!messageInput.trim() && attachments.length === 0}
            >
              <i className="fas fa-paper-plane"></i>
            </button>
          </div>
        </form>
      </div>
      
      {/* Create Channel Modal */}
      {isCreatingChannel && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Create New Channel</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setIsCreatingChannel(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <form className={styles.modalContent} onSubmit={handleCreateChannel}>
              <div className={styles.formGroup}>
                <label htmlFor="channel-name">Channel Name</label>
                <input 
                  id="channel-name"
                  type="text" 
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. project-updates" 
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="channel-description">Description (optional)</label>
                <input 
                  id="channel-description"
                  type="text" 
                  value={newChannelDescription}
                  onChange={(e) => setNewChannelDescription(e.target.value)}
                  placeholder="What is this channel about?"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox" 
                    checked={newChannelIsPrivate}
                    onChange={(e) => setNewChannelIsPrivate(e.target.checked)}
                  />
                  <span>Make private</span>
                </label>
                <p className={styles.formHint}>
                  Private channels are only visible to invited team members.
                </p>
              </div>
              
              <div className={styles.modalFooter}>
                <button 
                  type="button" 
                  className={styles.cancelButton}
                  onClick={() => setIsCreatingChannel(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={styles.createButton}
                  disabled={!newChannelName.trim()}
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
