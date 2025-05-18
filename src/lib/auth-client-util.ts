import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseClientAnon } from './supabase';
import { isBrowser } from '@/utils/environment';

/**
 * Helper function to get an authenticated client using headers or stored token
 */ 
export function getAuthClient(headers?: HeadersInit) {
  // If headers provided, create client with those headers
  if (headers) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: headers as Record<string, string>,
        },
      }
    );
  }
  
  // If in browser and no headers provided, try to get token from sessionStorage
  if (isBrowser) {
    try {
      const token = typeof window !== 'undefined' ? 
        sessionStorage.getItem('supabase_auth_token') : null;
        
      if (token) {
        return createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: {
                Authorization: `Bearer ${token}`,
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! 
              },
            },
          }
        );
      }
    } catch (e) {
      console.error('Error getting token from sessionStorage:', e);
    }
  }
  
  // Fallback to appropriate client for context
  return isBrowser ? supabaseClientAnon : supabase;
}
