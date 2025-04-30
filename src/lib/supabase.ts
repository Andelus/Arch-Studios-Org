import { createClient } from '@supabase/supabase-js';

// Check for environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create a Supabase client if environment variables are available
// Otherwise, create a mock client that will provide appropriate error messages
let supabaseClient: ReturnType<typeof createClient>;

if (supabaseUrl && supabaseKey) {
  // Create a single instance of the Supabase client to be reused across the application
  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false
    }
  });
} else {
  // For build-time and environments without proper configuration
  // This prevents build errors while still providing useful runtime errors
  console.warn('Supabase configuration is missing in environment variables');
  
  // Mock client that will throw appropriate errors when used
  supabaseClient = {
    from: () => {
      throw new Error('Supabase configuration is missing in environment variables');
    },
    // Add other methods as needed
  } as any;
}

export const supabase = supabaseClient;
