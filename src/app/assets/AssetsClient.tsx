'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import ModelViewer from '@/components/ModelViewer';
import { supabase } from '@/lib/supabase';
import styles from './Assets.module.css';

// Define the Asset interface
interface Asset {
  id: string;
  user_id: string;
  asset_url: string;
  asset_type: 'image' | '3d' | 'multi_view';
  prompt?: string;
  created_at: string;
}

// Asset type constants
const ASSET_TYPES = {
  ALL: 'all',
  IMAGE: 'image',
  MULTI_VIEW: 'multi_view',
  THREE_D: '3d',
};

export default function AssetsClient() {
  const { user, isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(ASSET_TYPES.ALL);
  
  // Fetch assets when the component mounts or when the active tab changes
  useEffect(() => {
    if (!isLoaded) return;
    
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
    
    fetchAssets();
  }, [isLoaded, isSignedIn, activeTab, user?.id]);
  
  // Function to fetch assets from Supabase
  const fetchAssets = async () => {
    setLoading(true);
    
    try {
      if (!user?.id) {
        console.error('User ID is not available');
        return;
      }

      let query = supabase
        .from('user_assets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      // Apply filter if not on the "All" tab
      if (activeTab !== ASSET_TYPES.ALL) {
        query = query.eq('asset_type', activeTab);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching assets:', error);
        console.error('Error details:', JSON.stringify(error));
        return;
      }
      
      // Properly map the unknown data to the Asset type
      const typedData = Array.isArray(data) 
        ? data.map(item => ({
            id: String(item.id),
            user_id: String(item.user_id),
            asset_url: String(item.asset_url),
            asset_type: String(item.asset_type) as 'image' | '3d' | 'multi_view',
            prompt: item.prompt ? String(item.prompt) : undefined,
            created_at: String(item.created_at)
          })) 
        : [];
      
      setAssets(typedData);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
      console.error('Error details:', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };
  
  // Function to format date in a readable way
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  // Get the asset type CSS class
  const getAssetTypeClass = (assetType: string): string => {
    switch (assetType) {
      case 'image':
        return styles.typeImage;
      case '3d':
        return styles.type3d;
      case 'multi_view':
        return styles.typeMultiView;
      default:
        return '';
    }
  };
  
  // Function to get asset type display name
  const getAssetTypeDisplayName = (assetType: string): string => {
    switch (assetType) {
      case 'image':
        return 'Image';
      case '3d':
        return '3D Model';
      case 'multi_view':
        return 'Multi View';
      default:
        return assetType;
    }
  };
  
  // Handle opening an asset 
  const handleOpenAsset = (asset: Asset): void => {
    if (asset.asset_type === 'image') {
      router.push(`/image?url=${encodeURIComponent(asset.asset_url)}`);
    } else if (asset.asset_type === 'multi_view') {
      router.push(`/coming-soon?url=${encodeURIComponent(asset.asset_url)}`);
    } else if (asset.asset_type === '3d') {
      router.push(`/3d?url=${encodeURIComponent(asset.asset_url)}`);
    }
  };
  
  // Truncate the prompt text if needed
  const getTruncatedPrompt = (prompt: string | undefined, maxLength = 100): string => {
    if (!prompt) return '';
    return prompt.length > maxLength ? `${prompt.substring(0, maxLength)}...` : prompt;
  };
  
  // Render empty state when no assets are found
  const renderEmptyState = () => (
    <div className={styles.emptyState}>
      <div className={styles.emptyStateIcon}>📁</div>
      <h3 className={styles.emptyStateTitle}>No assets found</h3>
      <p>Generate some images or 3D models to see them here.</p>
    </div>
  );
  
  // Render the asset grid
  const renderAssetGrid = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="ml-2">Loading...</span>
        </div>
      );
    }
    
    if (assets.length === 0) {
      return renderEmptyState();
    }
    
    return (
      <div className={styles.grid}>
        {assets.map((asset) => (
          <div key={asset.id} className={styles.asset}>
            <div className={styles.assetImageContainer}>
              {asset.asset_type === '3d' ? (
                <div className={styles.modelViewer}>
                  <ModelViewer originalModelUrl={asset.asset_url} />
                </div>
              ) : (
                <Image
                  src={asset.asset_url}
                  alt={asset.prompt || 'Generated asset'}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className={styles.assetImage}
                />
              )}
            </div>
            <div className={styles.assetContent}>
              <div className={styles.assetTitle}>
                <span>{getAssetTypeDisplayName(asset.asset_type)}</span>
                <span className={`${styles.assetType} ${getAssetTypeClass(asset.asset_type)}`}>
                  {asset.asset_type === 'multi_view' ? 'Multi' : asset.asset_type}
                </span>
              </div>
              <div className={styles.assetDate}>{formatDate(asset.created_at)}</div>
              {asset.prompt && (
                <div className={styles.assetPrompt}>{getTruncatedPrompt(asset.prompt)}</div>
              )}
              <div className={styles.assetActions}>
                <button 
                  className={styles.assetButton}
                  onClick={() => handleOpenAsset(asset)}
                >
                  Open
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Assets</h1>
      </div>
      
      <div className={styles.tabs}>
        <div 
          className={`${styles.tab} ${activeTab === ASSET_TYPES.ALL ? styles.tabActive : ''}`}
          onClick={() => setActiveTab(ASSET_TYPES.ALL)}
        >
          All
        </div>
        <div 
          className={`${styles.tab} ${activeTab === ASSET_TYPES.IMAGE ? styles.tabActive : ''}`}
          onClick={() => setActiveTab(ASSET_TYPES.IMAGE)}
        >
          Images
        </div>
        <div 
          className={`${styles.tab} ${activeTab === ASSET_TYPES.THREE_D ? styles.tabActive : ''}`}
          onClick={() => setActiveTab(ASSET_TYPES.THREE_D)}
        >
          3D Models
        </div>
        <div 
          className={`${styles.tab} ${activeTab === ASSET_TYPES.MULTI_VIEW ? styles.tabActive : ''}`}
          onClick={() => setActiveTab(ASSET_TYPES.MULTI_VIEW)}
        >
          Multi View
        </div>
      </div>
      
      {renderAssetGrid()}
    </div>
  );
}
