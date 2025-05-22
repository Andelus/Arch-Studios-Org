"use client";

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';
import { getAuthenticatedClient } from '@/lib/supabase';

/**
 * Custom hook to help with Supabase authentication via Clerk
 * This centralizes the token management and client creation
 */
export function useSupabaseAuth() {
  const { getToken, userId, isSignedIn } = useAuth();

  /**
   * Gets a fresh token from Clerk and stores it in browser storage
   */
  const refreshToken = useCallback(async () => {
    if (!isSignedIn) return null;
    
    try {
      // Get fresh token from Clerk
      const token = await getToken({ template: 'supabase' });
      
      // Store in browser storage
      if (token && typeof window !== 'undefined') {
        sessionStorage.setItem('supabase_auth_token', token);
        localStorage.setItem('supabase_auth_token', token);
        console.log('Refreshed and stored auth token');
      }
      
      return token;
    } catch (error) {
      console.error('Failed to refresh auth token:', error);
      return null;
    }
  }, [getToken, isSignedIn]);
  
  /**
   * Gets an authenticated Supabase client with a fresh token
   */
  const getClient = useCallback(async () => {
    // Get a fresh token
    const token = await refreshToken();
    
    // Return client with token
    return getAuthenticatedClient(token || undefined);
  }, [refreshToken]);
  
  /**
   * Checks if we have a valid token in browser storage
   */
  const checkToken = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    const token = sessionStorage.getItem('supabase_auth_token') || 
                  localStorage.getItem('supabase_auth_token');
                  
    if (!token) return false;
    
    // Try to validate token expiration
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      
      // Check if token is expired or will expire soon (in the next minute)
      if (expiryTime && (expiryTime < Date.now() || expiryTime < Date.now() + 60000)) {
        console.warn('Auth token is expired or about to expire');
        return false;
      }
      
      return true;
    } catch (err) {
      console.warn('Could not validate token expiration', err);
      return false;
    }
  }, []);
  
  return {
    userId,
    isSignedIn,
    refreshToken,
    getClient,
    checkToken
  };
}
