"use client";

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTeam } from '@/contexts/TeamContext';

/**
 * AuthNotificationHandler component
 * 
 * This component is responsible for checking user notifications
 * and processing any pending team invitations when the user logs in.
 */
export default function AuthNotificationHandler() {
  const { userId, isLoaded, isSignedIn } = useAuth();
  const { checkUserNotifications } = useTeam();
  
  // When the user logs in, check for notifications and process invitations
  useEffect(() => {
    const handleUserLogin = async () => {
      if (isLoaded && isSignedIn && userId) {
        try {
          // In a real app, you'd get the email from a proper API endpoint
          // This is simplified for demonstration purposes
          const email = localStorage.getItem('userEmail') || 'user@example.com';
          
          // Check for notifications and process any pending invitations
          await checkUserNotifications(userId, email);
        } catch (error) {
          console.error('Failed to process notifications:', error);
        }
      }
    };
    
    handleUserLogin();
  }, [isLoaded, isSignedIn, userId, checkUserNotifications]);
  
  // This component doesn't render anything visible
  return null;
}
