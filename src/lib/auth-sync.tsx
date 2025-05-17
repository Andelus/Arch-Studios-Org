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
        // Log when we're attempting to sync auth
        console.log('Setting up Supabase auth sync with Clerk...');
        
        // Check if Supabase environment is properly configured
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          console.error('Supabase environment variables missing in auth sync component');
          return; // Exit early if env vars are missing
        }
        
        // Get token from Clerk using the Supabase template
        const token = await getToken({ template: 'supabase' });
        
        // Log token details for debugging (only in development)
        if (process.env.NODE_ENV === 'development' && token) {
          const [header, payload] = token.split('.').slice(0, 2);
          console.log('JWT Header:', JSON.parse(atob(header)));
          console.log('JWT Payload:', JSON.parse(atob(payload)));
        }
        
        if (token) {
          console.log('Received token from Clerk for Supabase auth');
          
          // Set the Supabase auth session using the Clerk JWT
          // First verify the current session state
          const currentSession = await supabaseClientAnon.auth.getSession();
          console.log('Current session state:', currentSession.data.session ? 'Active' : 'None');

          // Set the new session
          const { error, data } = await supabaseClientAnon.auth.setSession({
            access_token: token,
            refresh_token: token, // Using same token as refresh token as it's handled by Clerk
          });
          
          if (error) {
            console.error('Error setting Supabase auth session:', error);
            // Log additional error details
            if (error.message) console.error('Error message:', error.message);
            if (error.status) console.error('Error status:', error.status);
          } else {
            console.log('Successfully set new Supabase auth session');
            
            // Verify the session was set correctly
            const { data: { session }, error: verifyError } = await supabaseClientAnon.auth.getSession();
            if (verifyError) {
              console.error('Error verifying session:', verifyError);
            } else if (session) {
              console.log('Verified session is active with user:', session.user?.id);
              // Test an authenticated request
              const { data: testData, error: testError } = await supabaseClientAnon.auth.getUser();
              if (testError) {
                console.error('Test auth request failed:', testError);
              } else {
                console.log('Test auth request succeeded:', testData);
              }
            } else {
              console.warn('Session verification failed - no active session found after setting it');
            }
          }
        } else {
          console.warn('No token received from Clerk for Supabase auth');
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
