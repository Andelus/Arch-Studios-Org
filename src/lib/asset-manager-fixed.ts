import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseClientAnon } from './supabase';
import { isBrowser } from '@/utils/environment';

// Type definitions for user assets
export type AssetType = 'image' | '3d' | 'multi_view';

export interface SaveAssetProps {
  userId: string;
  assetType: AssetType;
  assetUrl: string;
  prompt?: string;
  metadata?: Record<string, any>;
  organizationId?: string; // Optional organization ID (if known)
}

export interface UserAsset {
  id: string;        // Keep as string since UUID is represented as string in JS/TS
  user_id: string;   // This is TEXT in the database to match Clerk user IDs
  asset_type: AssetType;
  asset_url: string;
  prompt: string | null;
  created_at: string;
  metadata: Record<string, any>;
}

/**
 * Save a user-generated asset to the database
 * 
 * @param {SaveAssetProps} props - Asset properties
 * @returns {Promise<{success: boolean, data?: UserAsset, error?: any}>} Result object
 */
export async function saveUserAsset(props: SaveAssetProps) {
  try {
    console.log(`Saving ${props.assetType} asset for user ${props.userId}`);
    
    // Validate required fields
    if (!props.userId || !props.assetType || !props.assetUrl) {
      return {
        success: false,
        error: 'Missing required fields: userId, assetType, or assetUrl'
      };
    }

    // Ensure asset type is valid
    if (!['image', '3d', 'multi_view'].includes(props.assetType)) {
      return {
        success: false,
        error: `Invalid asset type: ${props.assetType}. Must be 'image', '3d', or 'multi_view'`
      };
    }
    
    // Get the user's organization ID
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', props.userId)
      .single();
      
    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      // Continue without organization_id
    }
    
    // Always use service role client for saving assets (server operation)
    // This is important because saveUserAsset might be called from server components
    const { data, error } = await supabase
      .from('user_assets')
      .insert({
        user_id: props.userId,
        organization_id: props.organizationId || userProfile?.organization_id || null,
        asset_type: props.assetType,
        asset_url: props.assetUrl,
        prompt: props.prompt || null,
        metadata: props.metadata || {}
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving user asset:', error);
      return { success: false, error };
    }
    
    console.log(`Asset saved successfully with ID: ${data.id}`);
    return { success: true, data };
  } catch (error) {
    console.error('Exception saving user asset:', error);
    return { success: false, error };
  }
}

/**
 * Helper function to get an authenticated client using headers or stored token
 */ 
export function getAuthClient(headers?: HeadersInit) {
  // If headers provided, create client with those headers
  if (headers) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: headers as Record<string, string>,
        },
      }
    );
  }
  
  // If in browser and no headers provided, try to get token from sessionStorage
  if (isBrowser) {
    try {
      const token = typeof window !== 'undefined' ? 
        sessionStorage.getItem('supabase_auth_token') : null;
        
      if (token) {
        return createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: {
                Authorization: `Bearer ${token}`,
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! 
              },
            },
          }
        );
      }
    } catch (e) {
      console.error('Error getting token from sessionStorage:', e);
    }
  }
  
  // Fallback to appropriate client for context
  return isBrowser ? supabaseClientAnon : supabase;
}

/**
 * Get a user's saved assets
 * 
 * @param {string} userId - User ID
 * @param {AssetType} [assetType] - Optional filter by asset type
 * @param {HeadersInit} [headers] - Optional headers for authentication
 * @returns {Promise<UserAsset[]>} Array of user assets
 */
export async function getUserAssets(
  userId: string,
  assetType?: AssetType,
  headers?: HeadersInit
): Promise<UserAsset[]> {
  try {
    console.log(`Fetching assets for user ${userId}, type filter: ${assetType || 'none'}`);
    
    // Validate required fields
    if (!userId) {
      console.error('Missing required field: userId');
      return [];
    }

    // Get the appropriate client with authentication
    const client = getAuthClient(headers);
    
    console.log(`Using client for ${isBrowser ? 'browser' : 'server'} context with URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}${headers ? ' and custom headers' : ''}`);
    
    // Add debug info to track potential issues
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || (isBrowser ? !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      console.warn('Supabase configuration may be missing in environment variables');
    }

    // Build the query
    let query = client
      .from('user_assets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Add asset type filter if provided
    if (assetType) {
      query = query.eq('asset_type', assetType);
    }

    // Execute the query
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user assets:', error);
      return [];
    }

    console.log(`Successfully fetched ${data?.length || 0} assets`);
    
    return data as UserAsset[] || [];
  } catch (error) {
    console.error('Exception fetching user assets:', error);
    return [];
  }
}

/**
 * Delete a user asset
 * 
 * @param {string} userId - User ID
 * @param {string} assetId - Asset ID to delete
 * @param {HeadersInit} [headers] - Optional headers for authentication
 * @returns {Promise<{success: boolean, error?: any}>} Result object
 */
export async function deleteUserAsset(userId: string, assetId: string, headers?: HeadersInit) {
  try {
    console.log(`Deleting asset ${assetId} for user ${userId}`);
    
    // Validate required fields
    if (!userId || !assetId) {
      return {
        success: false,
        error: 'Missing required fields: userId or assetId'
      };
    }

    // Get the authenticated client using our helper function
    const client = getAuthClient(headers);
    
    console.log(`Using client for ${isBrowser ? 'browser' : 'server'} context with URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}${headers ? ' and custom headers' : ''}`);
    
    // Add debug info to track potential issues
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || (isBrowser ? !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      console.warn('Supabase configuration may be missing in environment variables');
    }

    // Delete the asset
    const { error } = await client
      .from('user_assets')
      .delete()
      .eq('id', assetId)
      .eq('user_id', userId); // Ensure the user owns this asset

    if (error) {
      console.error('Error deleting user asset:', error);
      return { success: false, error };
    }

    console.log(`Asset ${assetId} deleted successfully`);
    return { success: true };
  } catch (error) {
    console.error('Exception deleting user asset:', error);
    return { success: false, error };
  }
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
