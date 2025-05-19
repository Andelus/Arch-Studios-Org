// Sync Clerk user IDs with Supabase Profile UUIDs
// This script ensures all Clerk users have a proper UUID in Supabase
// and the mapping is stored in Clerk metadata

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
const BATCH_SIZE = 100;

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ClerkUser {
  id: string;
  email_addresses: {
    id: string;
    email_address: string;
  }[];
  primary_email_address_id: string;
  public_metadata: {
    supabase_profile_id?: string;
  };
}

async function updateClerkUserMetadata(userId: string, metadata: Record<string, any>) {
  try {
    const response = await fetch(`https://api.clerk.dev/v1/users/${userId}/metadata`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        public_metadata: metadata
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update Clerk metadata: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating Clerk metadata:', error);
    throw error;
  }
}

async function getClerkUsers(): Promise<ClerkUser[]> {
  try {
    const response = await fetch('https://api.clerk.dev/v1/users', {
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Clerk users: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching Clerk users:', error);
    throw error;
  }
}

async function syncAuthUuids() {
  try {
    console.log('Starting UUID sync between Clerk and Supabase...');
    
    // Get all Clerk users
    const clerkUsers = await getClerkUsers();
    console.log(`Found ${clerkUsers.length} Clerk users`);
    
    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < clerkUsers.length; i += BATCH_SIZE) {
      const batch = clerkUsers.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(clerkUsers.length / BATCH_SIZE)}`);
      
      // Process each user in the batch
      await Promise.all(batch.map(async (user) => {
        const primaryEmail = user.email_addresses.find(
          email => email.id === user.primary_email_address_id
        )?.email_address;
        
        if (!primaryEmail) {
          console.warn(`User ${user.id} has no primary email. Skipping.`);
          return;
        }
        
        // Check if user already has Supabase profile ID in metadata
        const existingProfileId = user.public_metadata?.supabase_profile_id;
        
        if (existingProfileId) {
          // Verify this ID exists in Supabase
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', existingProfileId)
            .maybeSingle();
            
          if (existingProfile) {
            console.log(`User ${user.id} already has valid profile ID ${existingProfileId}`);
            return;
          } else {
            console.warn(`User ${user.id} has invalid profile ID ${existingProfileId}. Will create new.`);
          }
        }
        
        // Check if a profile with this email already exists
        const { data: existingProfileByEmail } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', primaryEmail)
          .maybeSingle();
        
        if (existingProfileByEmail) {
          // Update Clerk metadata with this existing profile ID
          await updateClerkUserMetadata(user.id, {
            supabase_profile_id: existingProfileByEmail.id
          });
          
          console.log(`Updated user ${user.id} with existing profile ID ${existingProfileByEmail.id}`);
          return;
        }
        
        // If we get here, we need to create a new profile
        const newProfileId = uuidv4();
        
        // Create user profile in the database
        const { error } = await supabase
          .from('profiles')
          .insert({
            id: newProfileId,
            email: primaryEmail,
            credits_balance: 1000,
            auto_buy_enabled: false,
            subscription_status: 'TRIAL',
            current_plan_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error(`Error creating profile for user ${user.id}:`, error);
          return;
        }

        // Store the mapping in Clerk metadata
        await updateClerkUserMetadata(user.id, {
          supabase_profile_id: newProfileId
        });
        
        // Create initial credit transaction
        await supabase
          .from('credit_transactions')
          .insert({
            user_id: newProfileId,
            amount: 1000,
            type: 'INITIAL_TRIAL_CREDIT',
            description: 'Initial trial credits',
            created_at: new Date().toISOString()
          });
        
        console.log(`Created new profile ${newProfileId} for user ${user.id}`);
      }));
    }
    
    console.log('UUID sync completed successfully');
  } catch (error) {
    console.error('Error in sync script:', error);
    process.exit(1);
  }
}

// Run the sync
syncAuthUuids().catch(error => {
  console.error('Fatal error running sync:', error);
  process.exit(1);
});
