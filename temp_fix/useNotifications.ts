import { useState, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  is_read: boolean;
  metadata?: Record<string, any>;
  link?: string;
  user_id?: string;
  email?: string;
}

/**
 * Enhanced useNotifications hook with improved token handling
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { isSignedIn, user: clerkUser } = useUser();
  const { userId, getToken } = useAuth();
  
  // Function to get an authenticated Supabase client
  const getAuthenticatedClient = useCallback(async () => {
    if (!getToken) return supabase;
    
    try {
      // First check if we have a valid token in sessionStorage
      let token: string | null = null;
      let tokenIsValid = false;
      
      if (typeof window !== 'undefined') {
        try {
          token = sessionStorage.getItem('supabase_auth_token');
          
          if (token) {
            // Check if token is expired
            try {
              const [, payloadBase64] = token.split('.').slice(0, 2);
              const payload = JSON.parse(atob(payloadBase64));
              const expTime = payload.exp * 1000;
              
              if (Date.now() < expTime - 60000) {
                // Token is valid and not about to expire
                tokenIsValid = true;
              }
            } catch (e) {
              console.error('Error checking token expiration:', e);
            }
          }
        } catch (e) {
          console.error('Error accessing sessionStorage:', e);
        }
      }
      
      // Get a fresh token if needed
      if (!token || !tokenIsValid) {
        token = await getToken({ 
          template: 'supabase',
          skipCache: false
        });
      }
      
      // If we have a token, create a client with auth headers
      if (token) {
        return createClient(
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
    } catch (e) {
      console.error('Error getting authenticated client:', e);
    }
    
    // Fallback to default client
    return supabase;
  }, [getToken]);
  
  // Fetch notifications from database and localStorage
  const fetchNotifications = useCallback(async () => {
    // Always load from localStorage first for immediate UI display
    if (typeof window !== 'undefined') {
      try {
        const localNotifs = localStorage.getItem('workspace-notifications');
        if (localNotifs) {
          setNotifications(JSON.parse(localNotifs));
        }
      } catch (e) {
        console.error('Error parsing localStorage notifications:', e);
      }
    }
    
    // Then fetch from database if user is signed in
    if (isSignedIn && userId) {
      try {
        const client = await getAuthenticatedClient();
        
        // Query for user's notifications using both user_id and email
        const { data, error } = await client
          .from('notifications')
          .select('*')
          .or(`user_id.eq.${userId},email.eq.${clerkUser?.primaryEmailAddress?.emailAddress || ''}`)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching notifications:', error);
          return;
        }
        
        if (data && data.length > 0) {
          setNotifications(data);
          // Also update localStorage for persistence
          localStorage.setItem('workspace-notifications', JSON.stringify(data));
        }
      } catch (error) {
        console.error('Failed to fetch notifications from database:', error);
      }
    }
  }, [isSignedIn, userId, clerkUser?.primaryEmailAddress?.emailAddress, getAuthenticatedClient]);
  
  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, is_read: true })));
    
    // Update localStorage
    if (typeof window !== 'undefined') {
      try {
        const localNotifs = localStorage.getItem('workspace-notifications');
        if (localNotifs) {
          const parsed = JSON.parse(localNotifs);
          localStorage.setItem(
            'workspace-notifications',
            JSON.stringify(parsed.map((n: Notification) => ({ ...n, is_read: true })))
          );
        }
      } catch (e) {
        console.error('Error updating localStorage notifications:', e);
      }
    }
    
    // If user is signed in, update database
    if (isSignedIn && userId) {
      try {
        const client = await getAuthenticatedClient();
        
        await client
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', userId)
          .eq('is_read', false);
      } catch (error) {
        console.error('Failed to update notifications in database:', error);
      }
    }
  }, [isSignedIn, userId, getAuthenticatedClient]);
  
  // Dismiss a notification
  const dismissNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
    
    // Update localStorage
    if (typeof window !== 'undefined') {
      try {
        const localNotifs = localStorage.getItem('workspace-notifications');
        if (localNotifs) {
          const parsed = JSON.parse(localNotifs);
          localStorage.setItem(
            'workspace-notifications',
            JSON.stringify(parsed.filter((n: Notification) => n.id !== id))
          );
        }
      } catch (e) {
        console.error('Error updating localStorage notifications:', e);
      }
    }
    
    // If user is signed in, delete from database
    if (isSignedIn && userId) {
      try {
        const client = await getAuthenticatedClient();
        
        await client
          .from('notifications')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
      } catch (error) {
        console.error('Failed to delete notification from database:', error);
      }
    }
  }, [isSignedIn, userId, getAuthenticatedClient]);
  
  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    setNotifications([]);
    
    // Update localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('workspace-notifications', JSON.stringify([]));
    }
    
    // If user is signed in, delete all from database
    if (isSignedIn && userId) {
      try {
        const client = await getAuthenticatedClient();
        
        await client
          .from('notifications')
          .delete()
          .eq('user_id', userId);
      } catch (error) {
        console.error('Failed to delete notifications from database:', error);
      }
    }
  }, [isSignedIn, userId, getAuthenticatedClient]);
  
  // Fetch notifications on mount and when auth state changes
  useEffect(() => {
    fetchNotifications();
    
    // Also set up a polling interval for real-time notifications
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
    
    return () => clearInterval(interval);
  }, [fetchNotifications]);
  
  return {
    notifications,
    unreadCount: notifications.filter(n => !n.is_read).length,
    markAllAsRead,
    dismissNotification,
    clearAllNotifications,
    refresh: fetchNotifications
  };
}
