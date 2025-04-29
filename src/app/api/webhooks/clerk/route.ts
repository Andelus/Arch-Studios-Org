import { WebhookEvent } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

console.log('Webhook handler loaded');

// Initialize Supabase client with debug logging
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

export async function POST(req: Request) {
  console.log('Webhook received');
  
  try {
    // Log environment variables (without sensitive data)
    console.log('Environment check:', {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasWebhookSecret: !!process.env.CLERK_WEBHOOK_SECRET
    });

    const payload = await req.json();
    console.log('Raw payload:', payload);

    if (payload.type === 'user.created') {
      console.log('Processing user.created event');
      const userId = payload.data.id;
      const email = payload.data.email_addresses[0]?.email_address;
      
      console.log('Creating profile for:', { userId, email });

      // Test Supabase connection first
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);

      if (testError) {
        console.error('Supabase connection test failed:', testError);
        throw testError;
      }

      console.log('Supabase connection test successful');

      // Create the profile
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          credits_balance: 0,
          auto_buy_enabled: false,
          free_image_used: false,
          free_model_used: false,
          subscription_status: 'CANCELLED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('Supabase error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('Profile created successfully:', data);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Profile created successfully',
        data: data
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Event type not handled:', payload.type);
    return new Response(JSON.stringify({ message: 'Event type not handled' }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Error in webhook:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 