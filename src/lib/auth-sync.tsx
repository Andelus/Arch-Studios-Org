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
          
          // Instead of setting a session, we'll store the token for use in the headers
          // This avoids creating multiple GoTrueClient instances
          
          // Store token in sessionStorage for use across the app
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('supabase_auth_token', token);
              console.log('Successfully stored auth token for header-based authentication');
              
              // Test authentication is working by logging JWT payload
              const [header, payload] = token.split('.').slice(0, 2);
              const decoded = JSON.parse(atob(payload));
              console.log('Auth token contains user ID:', decoded.sub);
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
