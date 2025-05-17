'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { supabaseClientAnon } from './supabase';

/**
 * This component syncs Clerk authentication with Supabase.
 * It should be placed high in the component tree where authentication is needed.
 */
export function SupabaseAuthSync({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    // Function to set the auth cookie for Supabase based on Clerk token
    const setupSupabaseAuth = async () => {
      try {
        // Get token from Clerk using the Supabase template
        const token = await getToken({ template: 'supabase' });
        
        if (token) {
          // Set the Supabase auth session using the Clerk JWT
          const { error } = await supabaseClientAnon.auth.setSession({
            access_token: token,
            refresh_token: token, // Using same token as refresh token as it's handled by Clerk
          });
          
          if (error) {
            console.error('Error setting Supabase auth session:', error);
          } else {
            console.log('Successfully synchronized Clerk auth with Supabase');
          }
        }
      } catch (error) {
        console.error('Failed to sync Clerk authentication with Supabase:', error);
      }
    };

    // Initial setup
    setupSupabaseAuth();

    // Add listener for auth changes
    const intervalId = setInterval(setupSupabaseAuth, 1000 * 60 * 58); // Refresh nearly every hour

    return () => clearInterval(intervalId);
  }, [getToken]);

  return <>{children}</>;
}
