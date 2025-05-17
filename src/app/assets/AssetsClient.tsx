"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './Assets.module.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { getUserAssets, deleteUserAsset, AssetType, UserAsset } from '@/lib/asset-manager';
import SimpleModelViewer from '@/components/SimpleModelViewer';
import { useAuth } from '@clerk/nextjs';

interface AssetsClientProps {
  userId: string;
}

export default function AssetsClient({ userId }: AssetsClientProps) {
  const [assets, setAssets] = useState<UserAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AssetType | 'all'>('all');
  const [selectedAsset, setSelectedAsset] = useState<UserAsset | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const router = useRouter();
  const { getToken } = useAuth();

  // Fetch assets whenever userId or filter changes
  useEffect(() => {
    const fetchAssets = async () => {
      setLoading(true);
      setFetchError(null);
      
      try {
        console.log('Fetching assets for user:', userId, 'with filter:', filter);
        
        // Get the authentication token from Clerk
        const token = await getToken({ template: 'supabase' });
        console.log('Auth token available:', !!token);
        
        const { success, data, error } = await getUserAssets(
          userId, 
          filter !== 'all' ? filter as AssetType : undefined
        );
        
        if (success && data) {
          console.log(`Fetched ${data.length} assets successfully`);
          
          // Make sure each item has the required fields from UserAsset interface
          const typedAssets = Array.isArray(data) ? data.map(item => ({
            id: String(item.id || ''),
            user_id: String(item.user_id || ''),
            asset_type: (item.asset_type as AssetType) || 'image',
            asset_url: String(item.asset_url || ''),
            prompt: item.prompt !== undefined ? String(item.prompt) : null,
            created_at: String(item.created_at || ''),
            metadata: item.metadata || {}
          } as UserAsset)) : [];
          
          setAssets(typedAssets);
        } else {
          console.error('Error fetching assets:', error);
          // Fix: error might not have a message property, so we need to handle it safely
          setFetchError(typeof error === 'object' && error !== null && 'message' in error 
            ? String(error.message) 
            : 'Failed to fetch assets');
          setAssets([]);
        }
      } catch (error) {
        console.error('Exception fetching assets:', error);
        setFetchError('An unexpected error occurred');
        setAssets([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (userId) {
      fetchAssets();
    }
  }, [userId, filter, getToken]);

  // Apply filter change
  const handleFilterChange = (newFilter: AssetType | 'all') => {
    setFilter(newFilter);
  };

  // Delete an asset
  const handleDeleteAsset = async () => {
    if (!selectedAsset) return;
    
    try {
      const { success, error } = await deleteUserAsset(userId, selectedAsset.id);
      
      if (success) {
        // Remove the asset from the local state
        setAssets(assets.filter(asset => asset.id !== selectedAsset.id));
        setShowDeleteModal(false);
        setSelectedAsset(null);
      } else {
        console.error('Error deleting asset:', error);
        // You may want to show an error message to the user
      }
    } catch (error) {
      console.error('Exception deleting asset:', error);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Handle clicking on an asset to view/use it
  const handleAssetClick = (asset: UserAsset) => {
    setSelectedAsset(asset);
    setShowViewModal(true);
  };

  // Use an asset in a different page
  const useAssetInApp = (asset: UserAsset) => {
    if (!asset) return;

    // Different actions depending on asset type
    switch (asset.asset_type) {
      case 'image':
        router.push(`/image?referenceImage=${encodeURIComponent(asset.asset_url)}`);
        break;
      case '3d':
        router.push(`/3d?imageUrl=${encodeURIComponent(asset.asset_url)}`);
        break;
      case 'multi_view':
        // For multi-view, we can either:
        // 1. Use the first image as a reference if viewImages exist in metadata
        // 2. Or use the main asset URL directly
        const multiViewData = asset.metadata?.viewImages || [];
        if (multiViewData.length > 0) {
          // If there's image data in the viewImages, use the first one as reference
          const firstImage = multiViewData[0]?.imagePreview || multiViewData[0]?.image || asset.asset_url;
          router.push(`/image/multi-view?referenceImage=${encodeURIComponent(firstImage)}`);
        } else {
          // Otherwise use the main asset URL
          router.push(`/image/multi-view?referenceImage=${encodeURIComponent(asset.asset_url)}`);
        }
        break;
    }
  };

  // Get the appropriate style for asset type label
  const getAssetTypeStyle = (type: AssetType) => {
    switch (type) {
      case 'image':
        return styles.assetTypeImage;
      case '3d':
        return styles.assetType3d;
      case 'multi_view':
        return styles.assetTypeMultiView;
      default:
        return '';
    }
  };

  // Render the list of assets as cards
  const renderAssets = () => {
    if (loading) {
      return (
        <div className={styles.loadingState}>
          <i className="fas fa-circle-notch fa-spin fa-3x"></i>
        </div>
      );
    }
    
    if (fetchError) {
      return (
        <div className={styles.errorState || styles.emptyState}>
          <i className="fas fa-exclamation-triangle"></i>
          <h3 className={styles.errorStateTitle || styles.emptyStateTitle}>Error loading assets</h3>
          <p className={styles.errorStateDesc || styles.emptyStateDesc}>
            {fetchError}
          </p>
          <button 
            onClick={() => setFilter(filter)} // This will trigger a re-fetch
            className={styles.errorStateButton || styles.emptyStateButton}
          >
            Try Again
          </button>
        </div>
      );
    }

    if (assets.length === 0) {
      return (
        <div className={styles.emptyState}>
          <i className="fas fa-folder-open"></i>
          <h3 className={styles.emptyStateTitle}>No assets found</h3>
          <p className={styles.emptyStateDesc}>
            {filter !== 'all' 
              ? `You don't have any ${filter} assets yet.`
              : "You haven't created any assets yet. Generate some images, 3D models, or multi-views to see them here."}
          </p>
          <button 
            onClick={() => router.push('/image')} 
            className={styles.emptyStateButton}
          >
            Generate Something
          </button>
        </div>
      );
    }

    return (
      <div className={styles.assetGrid}>
        {assets.map((asset) => (
          <div key={asset.id} className={styles.assetCard}>
            <div onClick={() => handleAssetClick(asset)} style={{ cursor: 'pointer' }}>
              {asset.asset_type === '3d' ? (
                <div className={styles.assetImage}>
                  <SimpleModelViewer
                    src={asset.asset_url}
                    alt="3D Model Viewer"
                    style={{ height: '180px' }}
                    autoRotate
                    cameraControls={false}
                    ar={false}
                  />
                </div>
              ) : (
                <img 
                  src={asset.asset_url} 
                  alt={asset.prompt || 'Generated asset'} 
                  className={styles.assetImage} 
                />
              )}
              <div className={styles.assetInfo}>
                <span className={`${styles.assetType} ${getAssetTypeStyle(asset.asset_type)}`}>
                  {asset.asset_type === 'multi_view' ? 'Multi-View' : asset.asset_type.toUpperCase()}
                </span>
                <p className={styles.assetPrompt}>
                  {asset.prompt || 'Generated asset'}
                </p>
                <div className={styles.assetDate}>
                  {formatDate(asset.created_at)}
                </div>
              </div>
            </div>

            <div className={styles.assetActions}>
              <button 
                className={styles.actionButton}
                onClick={() => useAssetInApp(asset)}
              >
                <i className="fas fa-pencil-alt"></i> Use
              </button>
              <button 
                className={`${styles.actionButton} ${styles.deleteButton}`}
                onClick={() => {
                  setSelectedAsset(asset);
                  setShowDeleteModal(true);
                }}
              >
                <i className="fas fa-trash-alt"></i> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render the delete confirmation modal
  const renderDeleteModal = () => {
    if (!showDeleteModal) return null;

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>Delete Asset</h3>
            <button className={styles.closeButton} onClick={() => setShowDeleteModal(false)}>×</button>
          </div>
          <div className={styles.modalContent}>
            <p>Are you sure you want to delete this asset? This action cannot be undone.</p>
          </div>
          <div className={styles.modalFooter}>
            <button className={styles.buttonSecondary} onClick={() => setShowDeleteModal(false)}>Cancel</button>
            <button className={`${styles.buttonPrimary} ${styles.deleteButton}`} onClick={handleDeleteAsset}>Delete</button>
          </div>
        </div>
      </div>
    );
  };

  // Render the asset view modal
  const renderViewModal = () => {
    if (!showViewModal || !selectedAsset) return null;

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>
              {selectedAsset.asset_type === 'multi_view' ? 'Multi-View' : 
               selectedAsset.asset_type === '3d' ? '3D Model' : 'Image'}
            </h3>
            <button className={styles.closeButton} onClick={() => {
              setShowViewModal(false);
              setSelectedAsset(null);
            }}>×</button>
          </div>
          <div className={styles.modalContent}>
            {selectedAsset.asset_type === '3d' ? (
              <SimpleModelViewer
                src={selectedAsset.asset_url}
                alt="3D Model"
                className={styles.modelViewer}
                autoRotate
                cameraControls
              />
            ) : selectedAsset.asset_type === 'multi_view' ? (
              <div className={styles.multiViewGrid}>
                {/* Render multiple views if available in metadata */}
                {selectedAsset.metadata?.viewImages?.length > 0 ? (
                  selectedAsset.metadata.viewImages.map((view: any, index: number) => {
                    // Try to extract the first part of the base64 image preview
                    const imageUrl = view.imagePreview?.startsWith('data:image') ? 
                      selectedAsset.asset_url : // Use full image if we can't use the preview
                      view.imagePreview;
                    
                    return (
                      <div key={index}>
                        <p>{view.view}</p>
                        <img 
                          src={imageUrl}
                          alt={`${view.view} view`} 
                          style={{ width: '100%', borderRadius: '8px' }} 
                        />
                      </div>
                    );
                  })
                ) : (
                  // Fallback if no view images in metadata
                  <div>
                    <p>Main Image</p>
                    <img 
                      src={selectedAsset.asset_url}
                      alt="Multi-view image" 
                      style={{ width: '100%', borderRadius: '8px' }} 
                    />
                  </div>
                )}
              </div>
            ) : (
              <img 
                src={selectedAsset.asset_url} 
                alt={selectedAsset.prompt || 'Generated image'} 
                style={{ width: '100%', borderRadius: '8px' }} 
              />
            )}
            
            {selectedAsset.prompt && (
              <div style={{ marginTop: '15px' }}>
                <h4 style={{ marginBottom: '5px', color: '#e0e0e0' }}>Prompt</h4>
                <p style={{ color: '#bbb', fontSize: '14px' }}>{selectedAsset.prompt}</p>
              </div>
            )}
          </div>
          <div className={styles.modalFooter}>
            <button
              className={styles.buttonSecondary}
              onClick={() => {
                setShowViewModal(false);
                setSelectedAsset(null);
              }}
            >
              Close
            </button>
            <button
              className={styles.buttonPrimary}
              onClick={() => {
                useAssetInApp(selectedAsset);
                setShowViewModal(false);
              }}
            >
              Use in App
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.title}>
          <div className={styles.titleSection}>
            <button 
              onClick={() => router.push('/dashboard')} 
              className={styles.backButton}
            >
              <i className="fas fa-arrow-left"></i>
            </button>
            <h1>Your Assets</h1>
          </div>
        </div>

        <div className={styles.filterBar}>
          <button 
            className={`${styles.filterButton} ${filter === 'all' ? styles.filterButtonActive : ''}`}
            onClick={() => handleFilterChange('all')}
          >
            All
          </button>
          <button 
            className={`${styles.filterButton} ${filter === 'image' ? styles.filterButtonActive : ''}`}
            onClick={() => handleFilterChange('image')}
          >
            Images
          </button>
          <button 
            className={`${styles.filterButton} ${filter === '3d' ? styles.filterButtonActive : ''}`}
            onClick={() => handleFilterChange('3d')}
          >
            3D Models
          </button>
          <button 
            className={`${styles.filterButton} ${filter === 'multi_view' ? styles.filterButtonActive : ''}`}
            onClick={() => handleFilterChange('multi_view')}
          >
            Multi-Views
          </button>
        </div>

        {renderAssets()}
        {renderDeleteModal()}
        {renderViewModal()}
      </div>
    </div>
  );
}