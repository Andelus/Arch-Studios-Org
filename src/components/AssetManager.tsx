"use client";

import { useState } from 'react';
import styles from './AssetManager.module.css';

interface Asset {
  id: string;
  name: string;
  type: 'document' | 'image' | 'video' | 'model' | 'other';
  url: string;
  thumbnailUrl?: string;
  dateUploaded: string;
  uploadedBy: string;
  size: string;
  description?: string;
  tags: string[];
}

interface AssetManagerProps {
  assets: Asset[];
  projectId: string;
  onAssetUpload: (file: File, description: string, tags: string[]) => void;
  onDeleteAsset: (assetId: string) => void;
  onEditAsset: (assetId: string, updates: Partial<Asset>) => void;
}

export default function AssetManager({
  assets,
  projectId,
  onAssetUpload,
  onDeleteAsset,
  onEditAsset
}: AssetManagerProps) {
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  // Filter assets based on type and search query
  const filteredAssets = assets.filter(asset => {
    const matchesType = !filterType || asset.type === filterType;
    const matchesQuery = !searchQuery || 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.description && asset.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      asset.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesType && matchesQuery;
  });
  
  const handleSelectAsset = (assetId: string) => {
    if (selectedAssets.includes(assetId)) {
      setSelectedAssets(selectedAssets.filter(id => id !== assetId));
    } else {
      setSelectedAssets([...selectedAssets, assetId]);
    }
  };
  
  const handleSelectAll = () => {
    if (selectedAssets.length === filteredAssets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(filteredAssets.map(asset => asset.id));
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };
  
  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = (e.target as HTMLInputElement).value.trim();
      if (tag && !uploadTags.includes(tag)) {
        setUploadTags([...uploadTags, tag]);
        (e.target as HTMLInputElement).value = '';
      }
    }
  };
  
  const removeTag = (tagToRemove: string) => {
    setUploadTags(uploadTags.filter(tag => tag !== tagToRemove));
  };
  
  const handleUpload = () => {
    if (uploadFile) {
      onAssetUpload(uploadFile, uploadDescription, uploadTags);
      closeUploadModal();
    }
  };
  
  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
    setUploadFile(null);
    setUploadDescription('');
    setUploadTags([]);
  };
  
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'document': return 'fas fa-file-alt';
      case 'image': return 'fas fa-image';
      case 'video': return 'fas fa-video';
      case 'model': return 'fas fa-cube';
      default: return 'fas fa-file';
    }
  };
  
  return (
    <div className={styles.assetManager}>
      <div className={styles.assetManagerHeader}>
        <h2>Project Assets</h2>
        
        <div className={styles.assetFilters}>
          <div className={styles.searchBar}>
            <i className="fas fa-search"></i>
            <input 
              type="text" 
              placeholder="Search assets..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className={styles.filterTypeDropdown}>
            <select 
              value={filterType || ''} 
              onChange={(e) => setFilterType(e.target.value || null)}
            >
              <option value="">All Types</option>
              <option value="document">Documents</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="model">3D Models</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        
        <button 
          className={styles.uploadButton}
          onClick={() => setIsUploadModalOpen(true)}
        >
          <i className="fas fa-cloud-upload-alt"></i> Upload Assets
        </button>
      </div>
      
      <div className={styles.assetActions}>
        <label className={styles.selectAllCheckbox}>
          <input 
            type="checkbox" 
            checked={selectedAssets.length > 0 && selectedAssets.length === filteredAssets.length}
            onChange={handleSelectAll}
          />
          Select All
        </label>
        
        {selectedAssets.length > 0 && (
          <div className={styles.bulkActions}>
            <button 
              className={styles.deleteButton}
              onClick={() => {
                if (window.confirm(`Delete ${selectedAssets.length} selected assets?`)) {
                  selectedAssets.forEach(assetId => onDeleteAsset(assetId));
                  setSelectedAssets([]);
                }
              }}
            >
              <i className="fas fa-trash"></i> Delete Selected
            </button>
            <button className={styles.downloadButton}>
              <i className="fas fa-download"></i> Download Selected
            </button>
          </div>
        )}
      </div>
      
      <div className={styles.assetGrid}>
        {filteredAssets.map(asset => (
          <div 
            key={asset.id} 
            className={`${styles.assetItem} ${selectedAssets.includes(asset.id) ? styles.selected : ''}`}
          >
            <div className={styles.assetItemHeader}>
              <input 
                type="checkbox" 
                checked={selectedAssets.includes(asset.id)}
                onChange={() => handleSelectAsset(asset.id)}
              />
              <div className={styles.assetActions}>
                <button 
                  className={styles.iconButton}
                  onClick={() => window.open(asset.url, '_blank')}
                >
                  <i className="fas fa-external-link-alt"></i>
                </button>
                <button 
                  className={styles.iconButton}
                  onClick={() => {
                    if (window.confirm(`Delete asset "${asset.name}"?`)) {
                      onDeleteAsset(asset.id);
                    }
                  }}
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
            
            <div className={styles.assetContent}>
              {asset.thumbnailUrl ? (
                <img src={asset.thumbnailUrl} alt={asset.name} className={styles.assetThumbnail} />
              ) : (
                <div className={styles.assetIcon}>
                  <i className={getFileIcon(asset.type)}></i>
                </div>
              )}
              <h4 className={styles.assetName}>{asset.name}</h4>
              {asset.description && <p className={styles.assetDescription}>{asset.description}</p>}
            </div>
            
            <div className={styles.assetFooter}>
              <div className={styles.assetMetadata}>
                <span className={styles.assetSize}>{asset.size}</span>
                <span className={styles.assetDate}>
                  {new Date(asset.dateUploaded).toLocaleDateString()}
                </span>
              </div>
              {asset.tags.length > 0 && (
                <div className={styles.assetTags}>
                  {asset.tags.slice(0, 2).map(tag => (
                    <span key={tag} className={styles.tagBadge}>{tag}</span>
                  ))}
                  {asset.tags.length > 2 && <span className={styles.moreTags}>+{asset.tags.length - 2}</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {filteredAssets.length === 0 && (
        <div className={styles.noAssets}>
          <i className="fas fa-folder-open"></i>
          <p>No assets match your filters</p>
          <button 
            className={styles.uploadButton}
            onClick={() => setIsUploadModalOpen(true)}
          >
            Upload Assets
          </button>
        </div>
      )}
      
      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className={styles.uploadModalBackdrop}>
          <div className={styles.uploadModal}>
            <div className={styles.uploadModalHeader}>
              <h3>Upload Asset</h3>
              <button className={styles.closeButton} onClick={closeUploadModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className={styles.uploadModalContent}>
              <div className={styles.fileDropZone}>
                {!uploadFile ? (
                  <div className={styles.dropZoneInner}>
                    <i className="fas fa-cloud-upload-alt"></i>
                    <p>Drag & drop file here, or click to select</p>
                    <input 
                      type="file" 
                      onChange={handleFileChange}
                    />
                  </div>
                ) : (
                  <div className={styles.selectedFile}>
                    <i className={`${getFileIcon('document')} ${styles.fileIcon}`}></i>
                    <div className={styles.fileInfo}>
                      <p>{uploadFile.name}</p>
                      <span>{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <button 
                      className={styles.removeFileButton}
                      onClick={() => setUploadFile(null)}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                )}
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="description">Description (optional)</label>
                <textarea 
                  id="description" 
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Add a description for this asset..."
                  rows={3}
                ></textarea>
              </div>
              
              <div className={styles.formGroup}>
                <label>Tags (press Enter after each tag)</label>
                <div className={styles.tagInput}>
                  {uploadTags.map(tag => (
                    <div key={tag} className={styles.tagBadge}>
                      {tag}
                      <button onClick={() => removeTag(tag)}>×</button>
                    </div>
                  ))}
                  <input 
                    type="text" 
                    onKeyDown={handleTagInput}
                    placeholder={uploadTags.length ? '' : 'Add tags...'}
                  />
                </div>
              </div>
            </div>
            
            <div className={styles.uploadModalFooter}>
              <button className={styles.cancelButton} onClick={closeUploadModal}>
                Cancel
              </button>
              <button 
                className={styles.uploadButton} 
                onClick={handleUpload}
                disabled={!uploadFile}
              >
                Upload Asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
