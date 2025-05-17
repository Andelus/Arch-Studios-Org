import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WebhookEvent } from '@clerk/nextjs/server';
import { Webhook } from 'svix';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Function to update Clerk user metadata
async function updateClerkUserMetadata(userId: string, authUuid: string) {
  try {
    const response = await fetch(`https://api.clerk.dev/v1/users/${userId}/metadata`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        public_metadata: {
          supabase_auth_uuid: authUuid
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to update Clerk metadata');
    }
  } catch (error) {
    console.error('Error updating Clerk metadata:', error);
    throw error;
  }
}

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

      // Generate a new UUID for authentication
      const authUuid = uuidv4();

      // Create user profile in the database
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: id,
          auth_uuid: authUuid,
          email: primaryEmail,
          credits_balance: 1000, // Give initial trial credits
          auto_buy_enabled: false,
          subscription_status: 'TRIAL',
          current_plan_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Database Insert Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Update the Clerk user's metadata with the auth_uuid
      try {
        await updateClerkUserMetadata(id, authUuid);
      } catch (error) {
        console.error('Error updating Clerk metadata:', error);
        // Don't fail the request, but log the error
      }

      // Create initial credit transaction for trial credits
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: id,
          amount: 1000,
          type: 'INITIAL_TRIAL_CREDIT',
          description: 'Initial trial credits',
          created_at: new Date().toISOString()
        });

      if (transactionError) {
        console.error('Transaction Error:', transactionError);
      }

      console.log('Profile and initial transaction created successfully');
      return NextResponse.json({ message: 'Profile created successfully' });
    }

    // Return a 200 for any other event types
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
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}