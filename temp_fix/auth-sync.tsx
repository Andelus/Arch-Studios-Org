// Enhanced auth-sync component with better JWT handling and error recovery
'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseProfileIdFromClerk } from '@/utils/clerk-supabase';

/**
 * Component that syncs Clerk authentication with Supabase.
 * It should be placed high in the component tree where authentication is needed.
 */
export function SupabaseAuthSync({ children }: { children: React.ReactNode }) {
  const { getToken, userId } = useAuth();

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
        
        if (!userId || !getToken) {
          console.log('No authenticated user or getToken not available');
          return; // Exit early if not authenticated
        }
        
        // Get the Supabase profile ID for the current user
        let supabaseProfileId;
        try {
          supabaseProfileId = await getSupabaseProfileIdFromClerk(userId);
          console.log('Retrieved Supabase profile ID:', supabaseProfileId);
        } catch (error) {
          console.error('Error getting Supabase profile ID:', error);
          return; // Exit if we can't get the profile ID
        }
        
        // First try to get token from sessionStorage for consistency
        let token = null;
        let tokenIsValid = false;
        
        if (typeof window !== 'undefined') {
          try {
            token = sessionStorage.getItem('supabase_auth_token');
            if (token) {
              console.log('Found existing token in sessionStorage');
              
              // Check if token is expired or has incorrect claims
              try {
                const [, payloadBase64] = token.split('.').slice(0, 2);
                const payload = JSON.parse(atob(payloadBase64));
                const expTime = payload.exp * 1000; // Convert to milliseconds
                
                // Check expiration and sub claim
                if (Date.now() >= expTime - 60000) { // If token expires in the next minute or already expired
                  console.log('Existing token is expired or about to expire, requesting fresh token');
                  token = null; // Force getting a fresh token
                } else if (payload.sub !== supabaseProfileId) {
                  console.log('Token has incorrect sub claim, requesting fresh token');
                  token = null;
                } else {
                  tokenIsValid = true;
                }
              } catch (e) {
                console.error('Error parsing existing token:', e);
                token = null; // Force getting a fresh token on error
              }
            }
          } catch (e) {
            console.error('Error accessing sessionStorage:', e);
          }
        }
        
        // Get a fresh token if needed
        if (!token || !tokenIsValid) {
          console.log('Requesting fresh token from Clerk');
          token = await getToken({ 
            template: 'supabase',
            skipCache: true // Force fresh token to ensure correct claims
          });
          
          if (!token) {
            console.warn('No token received from Clerk for Supabase auth');
            return;
          }
          
          console.log('Received fresh token from Clerk for Supabase auth');
        }
        
        // Always store token in sessionStorage for use across the app
        if (typeof window !== 'undefined' && token) {
          try {
            sessionStorage.setItem('supabase_auth_token', token);
            console.log('Successfully stored auth token for header-based authentication');
            
            // Create a test client with the token
            const testClient = createClient(
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
            
            // Test if we can access the projects and notifications tables
            const projectsResult = await testClient
              .from('projects')
              .select('*', { count: 'exact', head: true });
              
            if (projectsResult.error) {
              console.error('Failed to access projects table:', projectsResult.error.message);
            } else {
              console.log('Successfully accessed projects table');
            }
            
            // Test notifications table as well
            const notificationResult = await testClient
              .from('notifications')
              .select('*', { count: 'exact', head: true });
              
            if (notificationResult.error) {
              console.error('Failed to access notifications table:', notificationResult.error.message);
            } else {
              console.log('Successfully accessed notifications table');
            }
          } catch (e) {
            console.error('Error in token verification process:', e);
          }
        }
      } catch (error) {
        console.error('Failed to sync Clerk authentication with Supabase:', error);
      }
    };

    // Initial setup
    setupSupabaseAuth();

    // Add listener for auth changes - refresh token every 15 minutes to avoid expiration issues
    const intervalId = setInterval(setupSupabaseAuth, 1000 * 60 * 15);

    return () => clearInterval(intervalId);
  }, [getToken, userId]);

  return <>{children}</>;
}
