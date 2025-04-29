import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { type, data } = await req.json();

    if (type === 'user.created') {
      const { id, email_addresses } = data;
      const email = email_addresses[0]?.email_address;

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

      return NextResponse.json({ message: 'Profile created successfully' });
    }

    return NextResponse.json({ message: 'Event received but not processed' });
  } catch (error) {
    console.error('Webhook Handler Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({ message: 'ok' });
} 