'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { supabaseClientAnon } from './supabase';

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
        
        if (!userId) {
          console.log('No authenticated user, clearing any existing tokens');
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('supabase_auth_token');
            localStorage.removeItem('supabase_auth_token');
          }
          return;
        }
        
        // Get token with specific claims required by Supabase
        const token = await getToken({
          template: 'supabase',
        });
        
        // Log token details for debugging (only in development)
        if (process.env.NODE_ENV === 'development' && token) {
          try {
            const [header, payload] = token.split('.').slice(0, 2);
            const decodedHeader = JSON.parse(atob(header));
            const decodedPayload = JSON.parse(atob(payload));
            
            // Validate essential claims
            const hasRequiredClaims = 
              decodedPayload.role === 'authenticated' &&
              decodedPayload.sub &&
              decodedPayload.aud === 'authenticated';
              
            if (!hasRequiredClaims) {
              console.warn('JWT missing required claims:', {
                role: decodedPayload.role,
                sub: decodedPayload.sub,
                aud: decodedPayload.aud
              });
            }
            
            console.log('JWT Header:', decodedHeader);
            console.log('JWT Payload:', decodedPayload);
            
            // Extract and store the email separately as a more reliable identifier
            if (decodedPayload.email) {
              if (typeof window !== 'undefined') {
                localStorage.setItem('user_email', decodedPayload.email);
              }
            }
          } catch (e) {
            console.error('Error decoding token:', e);
          }
        }
        
        if (token) {
          console.log('Received token from Clerk for Supabase auth');
          
          // Store token in both sessionStorage and localStorage for redundancy
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('supabase_auth_token', token);
              localStorage.setItem('supabase_auth_token', token); 
              console.log('Successfully stored auth token for header-based authentication');
              
              // Validate token immediately with Supabase to ensure it works
              console.log('Validating token with Supabase...');
              fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                }
              })
              .then(response => {
                if (response.ok) {
                  console.log('✅ Token validation successful');
                } else {
                  console.error('❌ Token validation failed:', response.status, response.statusText);
                  // Clear tokens if validation fails
                  sessionStorage.removeItem('supabase_auth_token');
                  localStorage.removeItem('supabase_auth_token');
                }
                return response.json();
              })
              .then(data => {
                if (data) {
                  console.log('API response data available');
                }
              })
              .catch(err => {
                console.error('❌ Token validation error:', err);
              });
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
  }, [getToken, userId]);

  return <>{children}</>;
}
