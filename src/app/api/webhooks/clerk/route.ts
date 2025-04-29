import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Explicitly set to Node.js runtime
export const runtime = 'nodejs';

// Verify environment variables
console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  console.log('Webhook received');
  
  try {
    // Verify environment variables are available
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = await req.json();
    console.log('Webhook body:', body);

    const { type, data } = body;

    if (type === 'user.created') {
      console.log('Processing user.created event');
      const { id, email_addresses } = data;
      const email = email_addresses[0]?.email_address;

      console.log('Creating profile for user:', { id, email });

      const { error } = await supabaseClient
        .from('profiles')
        .insert({
          id: id,
          email: email,
          credits: 0,
          current_plan: 'FREE',
          auto_buy: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Supabase Insert Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('Profile created successfully');
      return NextResponse.json({ message: 'Profile created successfully' });
    }

    console.log('Event type not processed:', type);
    return NextResponse.json({ message: 'Event received but not processed' });
  } catch (error) {
    console.error('Webhook Handler Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  console.log('OPTIONS request received');
  return NextResponse.json({ message: 'ok' });
} 