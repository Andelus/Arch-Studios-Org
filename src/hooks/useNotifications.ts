"use client";

import { useState, useEffect, useCallback } from 'react';
import { Notification } from '@/components/NotificationCenter';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

// Helper function to generate a unique ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Helper to convert database notification to UI notification
const mapDatabaseNotificationToUI = (dbNotification: any): Notification => {
  return {
    id: dbNotification.id,
    type: dbNotification.type as any,
    title: dbNotification.title,
    message: dbNotification.message,
    time: dbNotification.created_at,
    isRead: dbNotification.is_read,
    link: dbNotification.link,
    metadata: dbNotification.metadata
  };
};

export function useNotifications() {
  // Initialize from localStorage for immediate state, and then fill from database
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, isSignedIn, isLoaded, getToken } = useAuth();
  
  // Function to fetch notifications from the database
  const fetchNotifications = useCallback(async () => {
    if (!isSignedIn || !userId) return;
    
    try {
      setIsLoading(true);
      
      // Get Supabase JWT from Clerk
      let client = supabase;
      
      try {
        // Only get token if getToken is available
        if (getToken) {
          const token = await getToken({ 
            template: 'supabase',
            skipCache: false // Use cached token when possible
          });
          
          if (token) {
            // Create a new Supabase client with auth header
            client = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL || '',
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              {
                auth: {
                  autoRefreshToken: false,
                  persistSession: false,
                  detectSessionInUrl: false
                },
                global: {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                  }
                }
              }
            );
          }
        }
      } catch (tokenError) {
        console.error('Error getting token:', tokenError);
        // Continue with default supabase client
      }
        
      const { data, error } = await client
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        throw error;
      }
      
      if (data) {
        const uiNotifications = data.map(mapDatabaseNotificationToUI);
        setNotifications(uiNotifications);
        
        // Also save to localStorage as a backup
        localStorage.setItem('workspace-notifications', JSON.stringify(uiNotifications));
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      // Fall back to localStorage
      const storedNotifications = localStorage.getItem('workspace-notifications');
      if (storedNotifications) {
        try {
          setNotifications(JSON.parse(storedNotifications));
        } catch (parseError) {
          console.error('Failed to parse stored notifications:', parseError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId, isSignedIn]);
  
  // Load notifications when user is authenticated
  useEffect(() => {
    if (isLoaded && isSignedIn && userId) {
      fetchNotifications();
    } else if (isLoaded && !isSignedIn) {
      // If not signed in, just use localStorage
      const storedNotifications = localStorage.getItem('workspace-notifications');
      if (storedNotifications) {
        try {
          setNotifications(JSON.parse(storedNotifications));
        } catch (error) {
          console.error('Failed to parse stored notifications:', error);
        }
      }
      setIsLoading(false);
    }
  }, [isLoaded, isSignedIn, userId, fetchNotifications]);
  
  // Add a new notification
  const addNotification = async (
    type: 'info' | 'success' | 'warning' | 'error' | 'team_invitation' | 'invitation_accepted' | 'invitation_reminder' | 
          'asset_approved' | 'asset_rejected' | 'asset_changes_requested' | 'asset_submitted',
    title: string,
    message: string,
    link?: string,
    metadata?: Record<string, any>
  ) => {
    const newNotification: Notification = {
      id: generateId(),
      type,
      title,
      message,
      time: new Date().toISOString(),
      isRead: false,
      link,
      metadata
    };
    
    // Add to local state immediately for UI responsiveness
    setNotifications(prev => [newNotification, ...prev]);
    
    // If user is signed in, also save to database
    if (isSignedIn && userId) {
      try {
        // Get Supabase JWT from Clerk
        let client = supabase;
        
        try {
          // Only get token if getToken is available
          if (getToken) {
            const token = await getToken({ 
              template: 'supabase',
              skipCache: false // Use cached token when possible
            });
            
            if (token) {
              // Create a new Supabase client with auth header
              client = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL || '',
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                {
                  auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                    detectSessionInUrl: false
                  },
                  global: {
                    headers: {
                      Authorization: `Bearer ${token}`,
                      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                    }
                  }
                }
              );
            }
          }
        } catch (tokenError) {
          console.error('Error getting token:', tokenError);
          // Continue with default supabase client
        }
          
        await client.from('notifications').insert({
          id: newNotification.id,
          user_id: userId,
          type,
          title,
          message,
          link,
          metadata,
          is_read: false,
          created_at: newNotification.time
        });
      } catch (error) {
        console.error('Failed to save notification to database:', error);
      }
    }
    
    // Always save to localStorage as a backup
    localStorage.setItem(
      'workspace-notifications', 
      JSON.stringify([newNotification, ...notifications].slice(0, 100))
    );
    
    return newNotification.id;
  };
  
  // Mark a notification as read
  const markAsRead = async (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, isRead: true } : notification
      )
    );
    
    // Update localStorage
    localStorage.setItem(
      'workspace-notifications',
      JSON.stringify(notifications.map(n => n.id === id ? { ...n, isRead: true } : n))
    );
    
    // If user is signed in, update in database
    if (isSignedIn && userId) {
      try {
        // Get Supabase JWT from Clerk
        let client = supabase;
        
        try {
          // Only get token if getToken is available
          if (getToken) {
            const token = await getToken({ 
              template: 'supabase',
              skipCache: false // Use cached token when possible
            });
            
            if (token) {
              // Create a new Supabase client with auth header
              client = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL || '',
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                {
                  auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                    detectSessionInUrl: false
                  },
                  global: {
                    headers: {
                      Authorization: `Bearer ${token}`,
                      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                    }
                  }
                }
              );
            }
          }
        } catch (tokenError) {
          console.error('Error getting token:', tokenError);
          // Continue with default supabase client
        }
          
        await client
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id)
          .eq('user_id', userId);
      } catch (error) {
        console.error('Failed to update notification in database:', error);
      }
    }
  };
  
  // Mark all notifications as read
  const markAllAsRead = async () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, isRead: true }))
    );
    
    // Update localStorage
    localStorage.setItem(
      'workspace-notifications',
      JSON.stringify(notifications.map(n => ({ ...n, isRead: true })))
    );
    
    // If user is signed in, update all in database
    if (isSignedIn && userId) {
      try {
        // Get Supabase JWT from Clerk
        let client = supabase;
        
        try {
          // Only get token if getToken is available
          if (getToken) {
            const token = await getToken({ 
              template: 'supabase',
              skipCache: false // Use cached token when possible
            });
            
            if (token) {
              // Create a new Supabase client with auth header
              client = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL || '',
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                {
                  auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                    detectSessionInUrl: false
                  },
                  global: {
                    headers: {
                      Authorization: `Bearer ${token}`,
                      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                    }
                  }
                }
              );
            }
          }
        } catch (tokenError) {
          console.error('Error getting token:', tokenError);
          // Continue with default supabase client
        }
          
        await client
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', userId)
          .eq('is_read', false);
      } catch (error) {
        console.error('Failed to update notifications in database:', error);
      }
    }
  };
  
  // Dismiss a notification
  const dismissNotification = async (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
    
    // Update localStorage
    localStorage.setItem(
      'workspace-notifications',
      JSON.stringify(notifications.filter(n => n.id !== id))
    );
    
    // If user is signed in, delete from database
    if (isSignedIn && userId) {
      try {
        // Get Supabase JWT from Clerk
        let client = supabase;
        
        try {
          // Only get token if getToken is available
          if (getToken) {
            const token = await getToken({ 
              template: 'supabase',
              skipCache: false // Use cached token when possible
            });
            
            if (token) {
              // Create a new Supabase client with auth header
              client = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL || '',
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                {
                  auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                    detectSessionInUrl: false
                  },
                  global: {
                    headers: {
                      Authorization: `Bearer ${token}`,
                      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                    }
                  }
                }
              );
            }
          }
        } catch (tokenError) {
          console.error('Error getting token:', tokenError);
          // Continue with default supabase client
        }
          
        await client
          .from('notifications')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
      } catch (error) {
        console.error('Failed to delete notification from database:', error);
      }
    }
  };
  
  // Clear all notifications
  const clearAllNotifications = async () => {
    setNotifications([]);
    
    // Update localStorage
    localStorage.setItem('workspace-notifications', JSON.stringify([]));
    
    // If user is signed in, delete all from database
    if (isSignedIn && userId) {
      try {
        // Get Supabase JWT from Clerk
        let client = supabase;
        
        try {
          // Only get token if getToken is available
          if (getToken) {
            const token = await getToken({ 
              template: 'supabase',
              skipCache: false // Use cached token when possible
            });
            
            if (token) {
              // Create a new Supabase client with auth header
              client = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL || '',
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                {
                  auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                    detectSessionInUrl: false
                  },
                  global: {
                    headers: {
                      Authorization: `Bearer ${token}`,
                      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                    }
                  }
                }
              );
            }
          }
        } catch (tokenError) {
          console.error('Error getting token:', tokenError);
          // Continue with default supabase client
        }
          
        await client
          .from('notifications')
          .delete()
          .eq('user_id', userId);
      } catch (error) {
        console.error('Failed to delete notifications from database:', error);
      }
    }
  };
  
  return {
    notifications,
    isLoading,
    addNotification,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAllNotifications,
    refreshNotifications: fetchNotifications
  };
}
