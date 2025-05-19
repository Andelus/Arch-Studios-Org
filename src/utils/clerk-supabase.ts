// Utility functions for mapping between Clerk and Supabase IDs
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Updates the public metadata for a Clerk user
 * @param userId The Clerk user ID
 * @param metadata The metadata to update
 */
export async function updateClerkUserMetadata(userId: string, metadata: Record<string, any>) {
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

/**
 * Gets the Supabase profile ID from a Clerk user ID
 * If the user doesn't have a profile ID, it creates one and stores it in Clerk metadata
 * @param clerkUserId The Clerk user ID
 * @returns The Supabase profile ID (UUID)
 */
export async function getSupabaseProfileIdFromClerk(clerkUserId: string): Promise<string> {
  try {
    const userResponse = await fetch(`https://api.clerk.dev/v1/users/${clerkUserId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!userResponse.ok) {
      throw new Error(`Failed to fetch Clerk user data: ${userResponse.statusText}`);
    }
    
    const userData = await userResponse.json();
    const supabaseProfileId = userData.public_metadata?.supabase_profile_id;
    
    if (!supabaseProfileId) {
      // If no Supabase profile ID exists in metadata, generate a new one
      console.warn(`No Supabase profile ID found for Clerk user: ${clerkUserId}. Generating new UUID.`);
      const newUuid = uuidv4();
      
      // Check if profile already exists for this user in another way
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', userData.email_addresses[0].email_address)
        .maybeSingle();
      
      // If profile exists, use that ID
      const profileId = existingProfile?.id || newUuid;
      
      // Store the profile ID in Clerk metadata
      await updateClerkUserMetadata(clerkUserId, {
        supabase_profile_id: profileId
      });
      
      console.log(`Stored Supabase profile ID for user: ${clerkUserId}`);
      return profileId;
    }
    
    return supabaseProfileId;
  } catch (error) {
    console.error('Error getting Supabase profile ID:', error);
    throw error;
  }
}

/**
 * Gets Clerk user ID from a Supabase profile ID by querying Clerk users
 * @param supabaseProfileId The Supabase profile UUID
 * @returns The Clerk user ID or null if not found
 */
export async function getClerkUserIdFromSupabaseProfile(supabaseProfileId: string): Promise<string | null> {
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
    
    const users = await response.json();
    
    // Find the user with the matching Supabase profile ID in public_metadata
    const matchingUser = users.find((user: any) => 
      user.public_metadata?.supabase_profile_id === supabaseProfileId
    );
    
    return matchingUser?.id || null;
  } catch (error) {
    console.error('Error getting Clerk user ID:', error);
    return null;
  }
}

/**
 * Creates or updates a user profile in Supabase and stores the mapping in Clerk
 * @param clerkUserId The Clerk user ID
 * @param email The user's email
 * @returns The Supabase profile UUID
 */
export async function ensureProfileExists(clerkUserId: string, email: string): Promise<string> {
  try {
    // First check if we have a stored UUID in Clerk metadata
    const userResponse = await fetch(`https://api.clerk.dev/v1/users/${clerkUserId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!userResponse.ok) {
      throw new Error(`Failed to fetch Clerk user data: ${userResponse.statusText}`);
    }
    
    const userData = await userResponse.json();
    const storedProfileId = userData.public_metadata?.supabase_profile_id;
    
    if (storedProfileId) {
      // Check if this profile exists in Supabase
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', storedProfileId)
        .maybeSingle();
      
      if (existingProfile) {
        return storedProfileId;
      }
      // If not found, we'll create a new one
      console.warn(`Stored profile ID ${storedProfileId} not found in database for user ${clerkUserId}`);
    }
    
    // Check if a profile with this email already exists
    const { data: existingProfileByEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    
    if (existingProfileByEmail) {
      // Update Clerk metadata with this existing profile ID
      await updateClerkUserMetadata(clerkUserId, {
        supabase_profile_id: existingProfileByEmail.id
      });
      
      return existingProfileByEmail.id;
    }
    
    // Generate a new UUID for this user
    const profileUuid = uuidv4();
    
    // Create user profile in the database
    const { error } = await supabase
      .from('profiles')
      .insert({
        id: profileUuid,
        email: email,
        credits_balance: 1000, // Give initial trial credits
        auto_buy_enabled: false,
        subscription_status: 'TRIAL',
        current_plan_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Database Insert Error:', error);
      throw new Error(`Failed to create profile: ${error.message}`);
    }

    // Store the mapping in Clerk metadata
    await updateClerkUserMetadata(clerkUserId, {
      supabase_profile_id: profileUuid
    });
    
    // Create initial credit transaction for trial credits
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: profileUuid,
        amount: 1000,
        type: 'INITIAL_TRIAL_CREDIT',
        description: 'Initial trial credits',
        created_at: new Date().toISOString()
      });
    
    return profileUuid;
  } catch (error) {
    console.error('Error ensuring profile exists:', error);
    throw error;
  }
}
