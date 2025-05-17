import { createClient } from '@supabase/supabase-js';

// Check for environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// We need to use service role key for server operations and anon key for client operations
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Default to service key, but also keep the anon client for client-side operations
let supabaseClient: ReturnType<typeof createClient>;
export let supabaseClientAnon: ReturnType<typeof createClient>; 

if (supabaseUrl && supabaseServiceKey) {
  // Create a single instance of the Supabase client to be reused across the application
  // Service role bypasses RLS - use for server-side operations
  supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
  
  // Create an anon client for client-side operations that respect RLS
  if (supabaseAnonKey) {
    supabaseClientAnon = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    });
  }
} else {
  // For build-time and environments without proper configuration
  // This prevents build errors while still providing useful runtime errors
  console.warn('Supabase configuration is missing in environment variables');
  
  // Mock clients that will throw appropriate errors when used
  const mockClient = {
    from: () => {
      throw new Error('Supabase configuration is missing in environment variables');
    },
    auth: {
      getSession: () => {
        throw new Error('Supabase configuration is missing in environment variables');
      }
    }
    // Add other methods as needed
  } as any;
  
  supabaseClient = mockClient;
  supabaseClientAnon = mockClient;
}

export const supabase = supabaseClient;
