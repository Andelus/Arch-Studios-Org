'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { supabaseClientAnon } from './supabase';
import { createClient } from '@supabase/supabase-js';

/**
 * This component syncs Clerk authentication with Supabase.
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
        
        // Get token from Clerk using the Supabase template
        const token = await getToken({ 
          template: 'supabase',
          skipCache: false // Use cached token if available to prevent generating too many tokens
        });
        
        // Log token details for debugging (only in development)
        if (process.env.NODE_ENV === 'development' && token) {
          const [header, payload] = token.split('.').slice(0, 2);
          try {
            console.log('JWT Header:', JSON.parse(atob(header)));
            console.log('JWT Payload:', JSON.parse(atob(payload)));
          } catch (e) {
            console.error('Error parsing JWT:', e);
          }
        }
        
        if (token) {
          console.log('Received token from Clerk for Supabase auth');
          
          // Instead of setting a session, we'll store the token for use in the headers
          // This avoids creating multiple GoTrueClient instances
          
          // Store token in sessionStorage for use across the app
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('supabase_auth_token', token);
              console.log('Successfully stored auth token for header-based authentication');
              
              // Test authentication is working by logging JWT payload
              try {
                const [header, payload] = token.split('.').slice(0, 2);
                const decoded = JSON.parse(atob(payload));
                console.log('Auth token contains user ID:', decoded.sub);
                
                // Create a single client for testing token auth
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
                
                // Make a simple authenticated request to verify token works
                testClient.auth.getUser().then(result => {
                  if (result.error) {
                    console.error('Auth verification failed:', result.error);
                    // If token verification fails, clear the stored token
                    sessionStorage.removeItem('supabase_auth_token');
                  } else {
                    console.log('Auth token verified successfully with Supabase');
                  }
                });
              } catch (e) {
                console.error('Error decoding token:', e);
              }
            } catch (e) {
              console.error('Error storing token:', e);
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
