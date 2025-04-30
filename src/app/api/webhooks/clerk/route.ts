import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WebhookEvent } from '@clerk/nextjs/server';
import { Webhook } from 'svix';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
      throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
    }

    // Get the headers
    const svix_id = req.headers.get("svix-id");
    const svix_timestamp = req.headers.get("svix-timestamp");
    const svix_signature = req.headers.get("svix-signature");

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json({ error: "Error occurred -- no svix headers" }, { status: 400 });
    }

    // Get the body
    const payload = await req.json();
    const body = JSON.stringify(payload);

    // Create a new Svix instance with your secret.
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt: WebhookEvent;

    try {
      evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return NextResponse.json({ error: "Error occurred -- invalid signature" }, { status: 400 });
    }

    const { type, data } = evt;
    console.log('Webhook type:', type);

    if (type === 'user.created') {
      console.log('Processing user.created event');
      const { id, email_addresses, primary_email_address_id } = data;
      
      // Get the primary email address
      const primaryEmail = email_addresses.find(
        email => email.id === primary_email_address_id
      )?.email_address;

      if (!primaryEmail) {
        console.error('No primary email found for user:', id);
        return NextResponse.json({ error: 'No primary email found' }, { status: 400 });
      }

      console.log('Creating profile for user:', { id, email: primaryEmail });

      // Create user profile in the database
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: id,
          email: primaryEmail,
          credits_balance: 0,
          auto_buy_enabled: false,
          subscription_status: 'CANCELLED',
          current_plan_id: null,
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
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({ message: 'ok' });
}