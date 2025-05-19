import { supabase } from './supabase';
import { AssetType, UserAsset } from './asset-manager';
import { isBrowser } from '@/utils/environment';
import { 
  hasEnoughOrganizationTrialCredits, 
  deductOrganizationTrialCredits 
} from '@/utils/clerk-supabase';

// Implementation of getAuthClient directly in this file
function getAuthClient(headers?: HeadersInit) {
  // If headers provided, we'd normally create a client with those headers
  // But for simplicity, we'll just return the default client
  return supabase;
}

/**
 * Get organization-wide assets for a user's organization
 * 
 * @param {string} organizationId - Organization ID
 * @param {AssetType} [assetType] - Optional filter by asset type
 * @param {HeadersInit} [headers] - Optional headers for authentication
 * @returns {Promise<UserAsset[]>} Array of organization assets
 */
export async function getOrganizationAssets(
  organizationId: string,
  assetType?: AssetType,
  headers?: HeadersInit
): Promise<UserAsset[]> {
  try {
    console.log(`Fetching assets for organization ${organizationId}, type filter: ${assetType || 'none'}`);
    
    // Validate required fields
    if (!organizationId) {
      console.error('Missing required field: organizationId');
      return [];
    }

    // Get the appropriate client with authentication
    const client = getAuthClient(headers);
    
    // Build the query
    let query = client
      .from('user_assets')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    // Add asset type filter if provided
    if (assetType) {
      query = query.eq('asset_type', assetType);
    }

    // Execute the query
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching organization assets:', error);
      return [];
    }

    console.log(`Successfully fetched ${data?.length || 0} organization assets`);
    
    return data as UserAsset[] || [];
  } catch (error) {
    console.error('Exception fetching organization assets:', error);
    return [];
  }
}

/**
 * Represents an organization subscription
 */
export interface OrganizationSubscription {
  id: string;
  organization_id: string;
  plan_type: 'unlimited' | 'custom' | 'trial';
  amount: number;
  currency: string;
  status: 'pending' | 'active' | 'cancelled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  last_payment_date?: string;
  last_transaction_id?: string;
  storage_limit?: number | null; // null means unlimited
  asset_limit?: number | null; // null means unlimited
  is_trial?: boolean;
  trial_credits?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Check if an organization has an active subscription
 * 
 * @param {string} organizationId - Organization ID to check
 * @returns {Promise<{hasActiveSubscription: boolean, subscription?: OrganizationSubscription, isTrial?: boolean, trialCredits?: number, error?: any}>} Result object
 */
export async function checkOrganizationSubscription(organizationId: string) {
  try {
    console.log(`Checking subscription for organization ${organizationId}`);
    
    // Validate required fields
    if (!organizationId) {
      return {
        hasActiveSubscription: false,
        error: 'Missing required field: organizationId'
      };
    }

    // Use service role client for security
    const { data, error } = await supabase
      .from('organization_subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // If error is "No rows found", it means no active subscription
      if (error.code === 'PGRST116') {
        return { hasActiveSubscription: false };
      }
      
      console.error('Error checking organization subscription:', error);
      return { hasActiveSubscription: false, error };
    }

    // Check if this is a trial subscription
    const isTrial = data.is_trial === true;
    const trialCredits = isTrial ? (data.trial_credits || 0) : 0;
    
    return { 
      hasActiveSubscription: true, 
      subscription: data,
      isTrial,
      trialCredits
    };
  } catch (error) {
    console.error('Exception checking organization subscription:', error);
    return { hasActiveSubscription: false, error };
  }
}

/**
 * Get total storage used by an organization
 * 
 * @param {string} organizationId - Organization ID to check
 * @returns {Promise<{totalStorage: number, totalAssets: number, error?: any}>} Result object
 */
export async function getOrganizationStorageUsage(organizationId: string) {
  try {
    console.log(`Getting storage usage for organization ${organizationId}`);
    
    // Validate required fields
    if (!organizationId) {
      return {
        totalStorage: 0, 
        totalAssets: 0,
        error: 'Missing required field: organizationId'
      };
    }

    // Call the RPC function to get organization usage statistics
    const { data, error } = await supabase
      .rpc('get_organization_usage_statistics', { org_id: organizationId });

    if (error) {
      console.error('Error getting organization storage usage:', error);
      return { 
        totalStorage: 0, 
        totalAssets: 0,
        error 
      };
    }

    return { 
      totalStorage: data.totalStorageUsed || 0, 
      totalAssets: data.totalAssets || 0
    };
  } catch (error) {
    console.error('Exception getting organization storage usage:', error);
    return { totalStorage: 0, totalAssets: 0, error };
  }
}

/**
 * Handle model generation for an organization
 * Checks if the organization can generate a model (either has active subscription or enough trial credits)
 * If using trial, deducts 10 credits per model generation
 * 
 * @param {string} organizationId - Organization ID
 * @param {string} modelType - Type of model being generated (e.g., '3d', 'multi_view')
 * @returns {Promise<{canGenerate: boolean, trialCreditsUsed?: boolean, creditsRemaining?: number, error?: string}>} Result object
 */
export async function handleOrganizationModelGeneration(organizationId: string, modelType: string = '3d'): Promise<{
  canGenerate: boolean;
  trialCreditsUsed?: boolean;
  creditsRemaining?: number;
  error?: string;
}> {
  try {
    console.log(`Processing model generation for org ${organizationId}, type: ${modelType}`);
    
    if (!organizationId) {
      return { canGenerate: false, error: 'Missing required field: organizationId' };
    }
    
    // Check subscription status
    const { hasActiveSubscription, subscription, isTrial, trialCredits, error } = 
      await checkOrganizationSubscription(organizationId);
    
    // If no active subscription at all
    if (!hasActiveSubscription) {
      return { 
        canGenerate: false, 
        error: 'No active subscription found for this organization' 
      };
    }
    
    // If it's a paid subscription, allow generation without checking credits
    if (!isTrial) {
      return { canGenerate: true };
    }
    
    // Check if trial has enough credits (need 10 credits per model)
    if (trialCredits === undefined || trialCredits < 10) {
      return { 
        canGenerate: false, 
        trialCreditsUsed: true,
        creditsRemaining: trialCredits || 0,
        error: 'Insufficient trial credits. Please upgrade to continue generating models.' 
      };
    }
    
    // Deduct 10 credits from the organization's trial balance
    const deductionSuccess = await deductOrganizationTrialCredits(
      organizationId,
      10,
      `${modelType.toUpperCase()} model generation`
    );
    
    if (!deductionSuccess) {
      return { 
        canGenerate: false, 
        error: 'Failed to process trial credit deduction' 
      };
    }
    
    // Return success with credits remaining
    return { 
      canGenerate: true, 
      trialCreditsUsed: true,
      creditsRemaining: trialCredits - 10
    };
  } catch (error) {
    console.error('Error handling organization model generation:', error);
    return { 
      canGenerate: false, 
      error: 'Failed to process model generation request' 
    };
  }
}
