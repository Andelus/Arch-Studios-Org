'use client';

import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { supabaseClientAnon } from './supabase';

/**
 * This component syncs Clerk authentication with Supabase.
 * It should be placed high in the component tree where authentication is needed.
 */
export function SupabaseAuthSync({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();

  useEffect(() => {
    // Function to set the auth cookie for Supabase based on Clerk token
    const setupSupabaseAuth = async () => {
      try {
        // Only proceed if auth is loaded and user is signed in
        if (!authLoaded || !userLoaded) {
          console.log('Auth not yet loaded, waiting...');
          return;
        }

        if (!isSignedIn || !user) {
          console.log('No user signed in, clearing Supabase session...');
          await supabaseClientAnon.auth.signOut();
          return;
        }

        console.log('Setting up Supabase auth sync with Clerk...', {
          userId: user.id,
          primaryEmailAddress: user.primaryEmailAddress?.emailAddress
        });
        
        // Check if Supabase environment is properly configured
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          throw new Error('Supabase environment variables missing');
        }
        
        // Get token from Clerk with proper JWT template
        const token = await getToken({
          template: 'supabase',
          skipCache: true  // Get a fresh token each time
        });
        
        if (!token) {
          throw new Error('Failed to get Supabase token from Clerk');
        }

        // Log JWT details for debugging
        try {
          const tokenParts = token.split('.');
          const header = JSON.parse(atob(tokenParts[0]));
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log('JWT Header:', header);
          console.log('JWT Payload:', payload);
        } catch (e) {
          console.warn('Could not parse JWT for debugging:', e);
        }

        // Set the Supabase auth session using the Clerk JWT
        const { error: sessionError } = await supabaseClientAnon.auth.setSession({
          access_token: token,
          refresh_token: token, // Using same token as refresh token as it's handled by Clerk
        });
        
        if (sessionError) {
          throw new Error(`Error setting Supabase session: ${sessionError.message}`);
        }

        // Verify the session was set correctly
        const { data: { session }, error: verifyError } = await supabaseClientAnon.auth.getSession();
        
        if (verifyError) {
          throw new Error(`Error verifying session: ${verifyError.message}`);
        }

        if (!session?.user) {
          throw new Error('Session verification failed - no active session found');
        }

        console.log('Successfully synced auth with Supabase', {
          supabaseUserId: session.user.id,
          role: session.user.role,
          email: session.user.email,
        });

      } catch (error) {
        console.error('Auth sync error:', error instanceof Error ? error.message : error);
        // Clear the session on error to prevent invalid states
        await supabaseClientAnon.auth.signOut().catch(console.error);
      }
    };

    // Initial setup
    setupSupabaseAuth();

    // Add listener for auth changes
    const intervalId = setInterval(setupSupabaseAuth, 1000 * 60 * 50); // Refresh every 50 minutes

    return () => {
      clearInterval(intervalId);
      // Clear Supabase session on unmount
      supabaseClientAnon.auth.signOut().catch(console.error);
    };
  }, [getToken, authLoaded, userLoaded, isSignedIn, user]);

  return <>{children}</>;
}
