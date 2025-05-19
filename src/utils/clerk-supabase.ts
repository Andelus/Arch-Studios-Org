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

/**
 * Ensures an organization has a trial subscription
 * Creates a trial subscription with 1000 credits if one doesn't exist
 * @param organizationId The Clerk organization ID
 * @returns The organization subscription data
 */
export async function ensureOrganizationTrialExists(organizationId: string): Promise<{id: string, trial_credits: number, is_trial: boolean}> {
  try {
    // Check if organization already has a subscription
    const { data: existingSubscription } = await supabase
      .from('organization_subscriptions')
      .select('id, trial_credits, is_trial')
      .eq('organization_id', organizationId)
      .maybeSingle();
    
    if (existingSubscription) {
      return existingSubscription;
    }
    
    // Create a new trial subscription
    const subscriptionId = uuidv4();
    const { error } = await supabase
      .from('organization_subscriptions')
      .insert({
        id: subscriptionId,
        organization_id: organizationId,
        plan_type: 'trial',
        amount: 0,
        status: 'active',
        is_trial: true,
        trial_credits: 1000,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error creating organization trial subscription:', error);
      throw new Error(`Failed to create organization trial: ${error.message}`);
    }
    
    // Log the creation of trial subscription
    console.log(`Created trial subscription for organization: ${organizationId}`);
    
    // Add an entry in transactions table
    await supabase
      .from('organization_subscription_transactions')
      .insert({
        organization_id: organizationId,
        tx_ref: `trial-${subscriptionId}`,
        amount: 0,
        currency: 'USD',
        status: 'completed',
        payment_provider_response: { type: 'trial_activation' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    return {
      id: subscriptionId,
      trial_credits: 1000,
      is_trial: true
    };
  } catch (error) {
    console.error('Error ensuring organization trial exists:', error);
    throw error;
  }
}

/**
 * Checks if an organization has sufficient trial credits
 * @param organizationId The organization ID
 * @param requiredCredits The number of credits required for the operation
 * @returns True if the organization has sufficient trial credits
 */
export async function hasEnoughOrganizationTrialCredits(
  organizationId: string, 
  requiredCredits: number = 10
): Promise<boolean> {
  try {
    const { data: subscription } = await supabase
      .from('organization_subscriptions')
      .select('is_trial, trial_credits, status')
      .eq('organization_id', organizationId)
      .single();
    
    if (!subscription) {
      return false;
    }
    
    // If not a trial or not active, we're not checking credits
    if (!subscription.is_trial || subscription.status !== 'active') {
      return true; // Assuming paid subscriptions don't need credit checks
    }
    
    return subscription.trial_credits >= requiredCredits;
  } catch (error) {
    console.error('Error checking organization trial credits:', error);
    return false;
  }
}

/**
 * Deducts credits from an organization's trial balance
 * @param organizationId The organization ID
 * @param credits The number of credits to deduct
 * @param description The reason for the deduction
 * @returns True if deduction was successful
 */
export async function deductOrganizationTrialCredits(
  organizationId: string, 
  credits: number = 10,
  description: string = 'Model generation'
): Promise<boolean> {
  try {
    // Get current credits
    const { data: subscription } = await supabase
      .from('organization_subscriptions')
      .select('id, is_trial, trial_credits, status')
      .eq('organization_id', organizationId)
      .single();
    
    if (!subscription || !subscription.is_trial || subscription.status !== 'active') {
      return false;
    }
    
    if (subscription.trial_credits < credits) {
      return false;
    }
    
    // Update subscription with new credit balance
    const { error } = await supabase
      .from('organization_subscriptions')
      .update({
        trial_credits: subscription.trial_credits - credits,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);
    
    if (error) {
      console.error('Error deducting organization trial credits:', error);
      return false;
    }
    
    // Create a transaction record for this deduction
    await supabase
      .from('organization_subscription_transactions')
      .insert({
        organization_id: organizationId,
        tx_ref: `deduction-${uuidv4()}`,
        amount: 0, // No money involved in trial credit usage
        currency: 'USD',
        status: 'completed',
        payment_provider_response: { 
          type: 'trial_credit_usage',
          credits_used: credits,
          description
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    return true;
  } catch (error) {
    console.error('Error deducting organization trial credits:', error);
    return false;
  }
}
