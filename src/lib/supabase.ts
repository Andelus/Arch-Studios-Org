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
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
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
