import { createClient } from '@supabase/supabase-js';
import { isBrowser } from '@/utils/environment';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables');
}

if (!supabaseServiceKey && !isBrowser) {
  throw new Error('Missing Supabase service role key in server environment');
}

// Create the supabase clients
export const supabaseClientAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: process.env.NODE_ENV === 'development',
  },
  global: {
    headers: {
      'X-Client-Info': 'clerk-supabase-nextjs',
    },
  },
});

// Create a service role client for admin operations (server-side only)
export const supabaseAdmin = !isBrowser && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          'X-Client-Info': 'clerk-supabase-service-role',
        },
      },
    })
  : null;
