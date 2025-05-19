"use client";

import { useState, useEffect, useRef } from 'react';
import styles from './NotificationCenter.module.css';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'team_invitation' | 'invitation_accepted' | 'invitation_reminder';
  title: string;
  message: string;
  time: string; // ISO timestamp
  isRead: boolean;
  link?: string;
  metadata?: Record<string, any>; // Additional data that might be useful for rendering
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDismiss: (id: string) => void;
}

export default function NotificationCenter({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const detailViewRef = useRef<HTMLDivElement>(null);
  
  // Update unread count when notifications change
  useEffect(() => {
    const count = notifications.filter(notification => !notification.isRead).length;
    setUnreadCount(count);
  }, [notifications]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          detailViewRef.current && !detailViewRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedNotification) {
          setTimeout(() => setSelectedNotification(null), 300); // Wait for animation to finish
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedNotification]);
  
  const handleToggle = () => {
    setIsOpen(!isOpen);
    // Close detail view when closing dropdown
    if (isOpen && selectedNotification) {
      setSelectedNotification(null);
    }
  };
  
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    setSelectedNotification(notification);
  };
  
  const handleBackToList = () => {
    setSelectedNotification(null);
  };
  
  const getTimeDisplay = (time: string) => {
    const date = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 30) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };
  
  const getDetailedTimeDisplay = (time: string) => {
    const date = new Date(time);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  
  const getNotificationIcon = (type: 'info' | 'success' | 'warning' | 'error' | 'team_invitation' | 'invitation_accepted' | 'invitation_reminder') => {
    switch (type) {
      case 'info':
        return 'fas fa-info-circle';
      case 'success':
        return 'fas fa-check-circle';
      case 'warning':
        return 'fas fa-exclamation-triangle';
      case 'error':
        return 'fas fa-times-circle';
      case 'team_invitation':
        return 'fas fa-user-plus';
      case 'invitation_accepted':
        return 'fas fa-user-check';
      case 'invitation_reminder':
        return 'fas fa-bell';
      default:
        return 'fas fa-info-circle';
    }
  };
  
  return (
    <div className={styles.notificationCenter}>
      <button className={styles.notificationToggle} onClick={handleToggle}>
        <i className="fas fa-bell"></i>
        {unreadCount > 0 && (
          <span className={styles.notificationBadge}>{unreadCount}</span>
        )}
      </button>
      
      {isOpen && (
        <div 
          className={styles.notificationsDropdown} 
          ref={dropdownRef}
          style={{ display: selectedNotification ? 'none' : 'flex' }}
        >
          <div className={styles.notificationsHeader}>
            <h3>Notifications</h3>
            {notifications.length > 0 && (
              <button 
                className={styles.markAllRead}
                onClick={onMarkAllAsRead}
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className={styles.notificationsList}>
            {notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <i className="fas fa-bell-slash"></i>
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id} 
                  className={`${styles.notificationItem} ${!notification.isRead ? styles.unread : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={`${styles.notificationType} ${styles[notification.type]}`}>
                    <i className={getNotificationIcon(notification.type)}></i>
                  </div>
                  <div className={styles.notificationContent}>
                    <div className={styles.notificationHeader}>
                      <h4>{notification.title}</h4>
                      <span className={styles.notificationTime}>
                        {getTimeDisplay(notification.time)}
                      </span>
                    </div>
                    <p>{notification.message}</p>
                    {notification.link && (
                      <a href={notification.link} className={styles.notificationLink}>
                        View Details
                      </a>
                    )}
                  </div>
                  <button 
                    className={styles.dismissButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(notification.id);
                    }}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Notification Detail View */}
      {isOpen && selectedNotification && (
        <div 
          className={styles.notificationDetailView} 
          ref={detailViewRef}
        >
          <div className={styles.detailHeader}>
            <button 
              className={styles.backButton}
              onClick={handleBackToList}
            >
              <i className="fas fa-arrow-left"></i>
            </button>
            <h3>Notification Details</h3>
            <button 
              className={styles.closeButton}
              onClick={() => {
                setSelectedNotification(null);
                setIsOpen(false);
              }}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          
          <div className={styles.detailContent}>
            <div className={`${styles.detailType} ${styles[selectedNotification.type]}`}>
              <i className={getNotificationIcon(selectedNotification.type)}></i>
            </div>
            <div className={styles.detailInfo}>
              <h4 className={styles.detailTitle}>{selectedNotification.title}</h4>
              <span className={styles.detailTime}>
                {getDetailedTimeDisplay(selectedNotification.time)}
              </span>
              <p className={styles.detailMessage}>{selectedNotification.message}</p>
              
              {/* Show any additional metadata if available */}
              {selectedNotification.metadata && (
                <div className={styles.metadataSection}>
                  {Object.entries(selectedNotification.metadata).map(([key, value]) => (
                    <div key={key} className={styles.metadataItem}>
                      <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </div>
                  ))}
                </div>
              )}
              
              {selectedNotification.link && (
                <a 
                  href={selectedNotification.link} 
                  className={styles.detailLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <i className="fas fa-external-link-alt"></i> Open Related Content
                </a>
              )}
            </div>
          </div>
          
          <div className={styles.detailActions}>
            {!selectedNotification.isRead && (
              <button 
                className={styles.markReadButton}
                onClick={() => onMarkAsRead(selectedNotification.id)}
              >
                <i className="fas fa-check"></i> Mark as Read
              </button>
            )}
            <button 
              className={styles.dismissNotificationButton}
              onClick={() => {
                onDismiss(selectedNotification.id);
                setSelectedNotification(null);
              }}
            >
              <i className="fas fa-trash-alt"></i> Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
