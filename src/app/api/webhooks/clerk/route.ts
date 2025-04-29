import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Webhook } from 'svix';
import { headers } from 'next/headers';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // Get the headers
    const headerPayload = await headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json({ error: "Error occurred -- no svix headers" }, { status: 400 });
    }

    // Get the body
    const payload = await req.json();
    const body = JSON.stringify(payload);

    // Create a new Svix instance with your webhook secret
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);

    let evt: any;

    // Verify the webhook payload
    try {
      evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return NextResponse.json({ error: "Error occurred" }, { status: 400 });
    }

    const { type, data } = evt;
    console.log('Webhook type:', type);

    if (type === 'user.created') {
      console.log('Processing user.created event');
      const { id, email_addresses } = data;
      const email = email_addresses[0]?.email_address;

      console.log('Creating profile for user:', { id, email });

      // Create user profile in the database
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: id,
          email: email,
          credits_balance: 0,
          auto_buy_enabled: false,
          free_image_used: false,
          free_model_used: false,
          subscription_status: 'CANCELLED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Database Insert Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Create initial credit transaction
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: id,
          amount: 0,
          transaction_type: 'PURCHASE',
          description: 'Initial account creation'
        });

      if (transactionError) {
        console.error('Transaction Creation Error:', transactionError);
        // Don't fail the webhook if transaction creation fails
      }

      console.log('Profile and initial transaction created successfully');
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