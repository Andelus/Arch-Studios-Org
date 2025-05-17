import { createClient } from '@supabase/supabase-js';

const BATCH_SIZE = 100;

async function syncAuthUuids() {
  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Get all profiles with their auth_uuids
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, auth_uuid');

    if (error) throw error;
    if (!profiles?.length) {
      console.log('No profiles found to sync');
      return;
    }

    console.log(`Found ${profiles.length} profiles to sync`);

    // Process in batches
    for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
      const batch = profiles.slice(i, i + BATCH_SIZE);
      
      // Update each user in the batch
      await Promise.all(batch.map(async (profile) => {
        try {
          const response = await fetch(`https://api.clerk.dev/v1/users/${profile.id}/metadata`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              public_metadata: {
                supabase_auth_uuid: profile.auth_uuid
              }
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to update user ${profile.id}: ${response.statusText}`);
          }

          console.log(`Updated user ${profile.id} with auth_uuid ${profile.auth_uuid}`);
        } catch (error) {
          console.error(`Error updating user ${profile.id}:`, error);
        }
      }));

      console.log(`Processed batch ${i / BATCH_SIZE + 1}`);
    }

    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Error syncing auth UUIDs:', error);
  }
}

// Run the sync
syncAuthUuids();
