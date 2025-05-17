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
}

export interface UserAsset {
  id: string;
  user_id: string;
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
    
    // Always use service role client for saving assets (server operation)
    // This is important because saveUserAsset might be called from server components
    const { data, error } = await supabase
      .from('user_assets')
      .insert({
        user_id: props.userId,
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
 * Get a user's saved assets
 * 
 * @param {string} userId - User ID
 * @param {AssetType} [assetType] - Optional filter by asset type
 * @returns {Promise<{success: boolean, data?: UserAsset[], error?: any}>} Result object with assets
 */
export async function getUserAssets(userId: string, assetType?: AssetType) {
  try {
    console.log(`Fetching assets for user ${userId}, type filter: ${assetType || 'none'}`);
    
    // Validate required fields
    if (!userId) {
      return {
        success: false,
        error: 'Missing required field: userId'
      };
    }

    // Use the appropriate client - anon client for browser context (respects RLS),
    // service client for server context (bypasses RLS with service role)
    const client = isBrowser ? supabaseClientAnon : supabase;
    console.log(`Using client for ${isBrowser ? 'browser' : 'server'} context with URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    
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
      return { success: false, error };
    }

    console.log(`Successfully fetched ${data?.length || 0} assets`);
    
    return { success: true, data };
  } catch (error) {
    console.error('Exception fetching user assets:', error);
    return { success: false, error };
  }
}

/**
 * Delete a user asset
 * 
 * @param {string} userId - User ID
 * @param {string} assetId - Asset ID to delete
 * @returns {Promise<{success: boolean, error?: any}>} Result object
 */
export async function deleteUserAsset(userId: string, assetId: string) {
  try {
    console.log(`Deleting asset ${assetId} for user ${userId}`);
    
    // Validate required fields
    if (!userId || !assetId) {
      return {
        success: false,
        error: 'Missing required fields: userId or assetId'
      };
    }

    // Use the appropriate client - anon client for browser context (respects RLS),
    // service client for server context (bypasses RLS with service role)
    const client = isBrowser ? supabaseClientAnon : supabase;
    console.log(`Using client for ${isBrowser ? 'browser' : 'server'} context with URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    
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
