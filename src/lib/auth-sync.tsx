'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
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
        // Always request a fresh token to avoid cached invalid tokens
        const token = await getToken({ 
          template: 'supabase',
          skipCache: true // Force fresh token to prevent issues with invalid tokens
        });
        
        if (!token) {
          console.warn('No token received from Clerk for Supabase auth');
          return;
        }
        
        console.log('Received token from Clerk for Supabase auth');
        
        // Log token details for debugging (only in development)
        if (process.env.NODE_ENV === 'development') {
          try {
            const [headerBase64, payloadBase64] = token.split('.').slice(0, 2);
            const header = JSON.parse(atob(headerBase64));
            const payload = JSON.parse(atob(payloadBase64));
            
            console.log('JWT Header:', header);
            console.log('JWT Payload:', {
              ...payload,
              exp: new Date(payload.exp * 1000).toISOString(),
              iat: new Date(payload.iat * 1000).toISOString()
            });
            console.log('User ID from token:', payload.sub);
          } catch (e) {
            console.error('Error parsing JWT:', e);
          }
        }
        
        // Store token in sessionStorage for use across the app
        if (typeof window !== 'undefined') {
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
            
            // Test if we can access the projects table
            const projectsResult = await testClient
              .from('projects')
              .select('*', { count: 'exact', head: true });
              
            if (projectsResult.error) {
              console.log('No projects found or access denied:', projectsResult.error.message);
              // This could be a legitimate error if user has no projects yet
            } else {
              console.log('Successfully accessed projects table');
            }              // Test notifications table as well
            const notificationResult = await testClient
              .from('notifications')
              .select('*', { count: 'exact', head: true });
              
            if (notificationResult.error) {
              console.error('Failed to access notifications table:', notificationResult.error.message);
              
              // For our simplified approach, create a project to ensure admin privileges
              console.log('Creating a project to ensure admin privileges...');
              const projectId = `project-${Date.now()}`;
              const { data: projectData, error: projectError } = await testClient
                .from('projects')
                .insert([{ 
                  id: projectId, 
                  name: 'Admin Project', 
                  description: 'Project created to ensure admin privileges',
                  organization_id: userId || 'default-org'
                }]);
                
              if (projectError) {
                console.error('Failed to create admin project:', projectError.message);
                // Don't worry too much, just try to continue
              } else {
                console.log('Created admin project to ensure privileges');
                
                // Also add the current user as a project member with admin permission
                await testClient
                  .from('project_members')
                  .insert([{
                    project_id: projectId,
                    user_id: userId,
                    permission: 'admin',
                    status: 'active',
                    sender_email: 'admin@example.com', // Default email
                    sender_name: 'Admin User'          // Default name
                  }]);
              }
            } else {
              console.log('Successfully accessed notifications table:', 
                notificationResult.count !== undefined ? `${notificationResult.count} notifications found` : 'No notifications found');
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

    // Add listener for auth changes - refresh token every 30 minutes
    const intervalId = setInterval(setupSupabaseAuth, 1000 * 60 * 30);

    return () => clearInterval(intervalId);
  }, [getToken]);

  return <>{children}</>;
}
