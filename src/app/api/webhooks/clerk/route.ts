import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WebhookEvent } from '@clerk/nextjs/server';
import { Webhook } from 'svix';
import { v4 as uuidv4 } from 'uuid';
import { 
  updateClerkUserMetadata, 
  getSupabaseProfileIdFromClerk, 
  ensureProfileExists,
  ensureOrganizationTrialExists
} from '@/utils/clerk-supabase';

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

      try {
        // Use our utility function to create the profile and handle the mapping
        const profileId = await ensureProfileExists(id, primaryEmail);
        console.log('Profile created successfully with ID:', profileId);
        
        return NextResponse.json({ 
          message: 'Profile created successfully',
          profileId
        });
      } catch (error: any) {
        console.error('Error creating profile:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Handle organization events
    if (type === 'organization.created') {
      console.log('Processing organization.created event');
      const { id: orgId, name, slug } = data;
      
      console.log('Organization created:', { 
        orgId, 
        name, 
        slug, 
        slugGenerated: name !== slug // Check if slug was auto-generated 
      });
      
      try {
        // Insert the organization into the organizations table
        const { error } = await supabase
          .from('organizations')
          .insert({
            id: orgId,
            name,
            slug,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (error) {
          console.error('Error creating organization in database:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        // Create a trial subscription for this new organization
        const orgTrial = await ensureOrganizationTrialExists(orgId);
        console.log(`Created organization trial with ${orgTrial.trial_credits} credits for organization: ${orgId}`);
        
        return NextResponse.json({ 
          message: 'Organization created successfully with trial subscription',
          organizationId: orgId,
          trialCredits: orgTrial.trial_credits
        });
      } catch (error: any) {
        console.error('Error creating organization with trial:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
     if (type === 'organizationMembership.created') {
      console.log('Processing organizationMembership.created event');
      const { organization, public_user_data } = data;
      const clerkUserId = public_user_data.user_id;
      const organizationId = organization.id;
      
      console.log('User added to organization:', {
        organizationId,
        organizationName: organization.name,
        clerkUserId
      });
      
      try {
        // Get the Supabase UUID from our utility function
        const supabaseProfileId = await getSupabaseProfileIdFromClerk(clerkUserId);
        
        if (!supabaseProfileId) {
          console.error('No Supabase profile ID could be determined for user:', clerkUserId);
          return NextResponse.json({ error: 'No Supabase profile found for this user' }, { status: 404 });
        }
        
        console.log(`Updating profile ${supabaseProfileId} with organization ${organizationId}`);
        
        // Update the user's profile with their organization ID
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            organization_id: organizationId,
            updated_at: new Date().toISOString()
          })
          .eq('id', supabaseProfileId);
          
        if (updateError) {
          console.error('Error updating user profile with organization:', updateError);
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        
        return NextResponse.json({ 
          message: 'Organization membership processed successfully',
          profileId: supabaseProfileId,
          organizationId 
        });
      } catch (error: any) {
        console.error('Error processing organization membership:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
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