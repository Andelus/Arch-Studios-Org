import { supabase } from './supabase';

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

    // Insert the asset into the database
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
    // Validate required fields
    if (!userId) {
      return {
        success: false,
        error: 'Missing required field: userId'
      };
    }

    // Build the query
    let query = supabase
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
    // Validate required fields
    if (!userId || !assetId) {
      return {
        success: false,
        error: 'Missing required fields: userId or assetId'
      };
    }

    // Delete the asset
    const { error } = await supabase
      .from('user_assets')
      .delete()
      .eq('id', assetId)
      .eq('user_id', userId); // Ensure the user owns this asset

    if (error) {
      console.error('Error deleting user asset:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception deleting user asset:', error);
    return { success: false, error };
  }
}
