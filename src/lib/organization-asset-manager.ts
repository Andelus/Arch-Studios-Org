import { supabase } from './supabase';
import { AssetType, UserAsset } from './asset-manager';
import { isBrowser } from '@/utils/environment';

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
  plan_type: 'unlimited' | 'custom';
  amount: number;
  currency: string;
  status: 'pending' | 'active' | 'cancelled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  last_payment_date?: string;
  last_transaction_id?: string;
  storage_limit?: number | null; // null means unlimited
  asset_limit?: number | null; // null means unlimited
  created_at: string;
  updated_at: string;
}

/**
 * Check if an organization has an active subscription
 * 
 * @param {string} organizationId - Organization ID to check
 * @returns {Promise<{hasActiveSubscription: boolean, subscription?: OrganizationSubscription, error?: any}>} Result object
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

    return { 
      hasActiveSubscription: true, 
      subscription: data
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
