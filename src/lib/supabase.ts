import { createClient } from '@supabase/supabase-js';
import { isBrowser } from '@/utils/environment';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Make sure we have the required environment variables
if (!supabaseUrl) {
  console.error('NEXT_PUBLIC_SUPABASE_URL is missing in environment variables');
}

if (!supabaseAnonKey) {
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in environment variables');
}

if (!supabaseServiceKey && !isBrowser) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing in environment variables (server-side only)');
}

// Create the supabase clients
export const supabaseClientAnon = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: false,  // Disable session persistence - we'll handle auth via headers
      autoRefreshToken: false, // Disable token refresh - Clerk handles this
      detectSessionInUrl: false, // Disable URL detection
      flowType: 'pkce',
      storage: {
        // Prevent any session storage since we're using Clerk
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
      }
    },
    global: {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  }
);

// The server role client should only be used on the server
const supabaseClient = isBrowser
  ? supabaseClientAnon // In browser, use the anon key
  : createClient(
      supabaseUrl || '',
      supabaseServiceKey || '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );

export const supabase = supabaseClient;

/**
 * Creates an authenticated Supabase client using the provided token
 * This approach avoids multiple GoTrueClient instances by using header-based auth
 * 
 * @param token JWT token from Clerk
 * @returns Supabase client with authentication headers
 */
export function getAuthenticatedClient(token?: string) {
  // If no token is provided and we're in browser context, try to get from sessionStorage or localStorage
  if (!token && typeof window !== 'undefined') {
    try {
      // Try sessionStorage first, then localStorage as fallback
      token = sessionStorage.getItem('supabase_auth_token') || 
              localStorage.getItem('supabase_auth_token') || 
              undefined;
      
      if (token) {
        console.log('Retrieved auth token from browser storage');
        
        // Validate token expiration if possible
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiryTime = payload.exp * 1000; // Convert to milliseconds
          
          if (expiryTime && expiryTime < Date.now()) {
            console.warn('Token has expired, removing from storage');
            sessionStorage.removeItem('supabase_auth_token');
            localStorage.removeItem('supabase_auth_token');
            token = undefined;
          }
        } catch (err) {
          console.warn('Could not validate token expiration', err);
        }
      }
    } catch (e) {
      console.error('Error reading token from browser storage:', e);
    }
  }
  
  // If we have a token, create a client with auth headers
  if (token) {
    return createClient(
      supabaseUrl || '',
      supabaseAnonKey || '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey || ''
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      }
    );
  }
  
  // Otherwise return the anon client
  return supabaseClientAnon;
}
