"use client";

import { useState, forwardRef, useImperativeHandle } from 'react';
import styles from './AssetManager.module.css';
import ModelViewer from './ModelViewer';

interface Asset {
  id: string;
  name: string;
  type: 'document' | 'image' | 'video' | 'model' | 'other';
  url: string;
  thumbnailUrl?: string;
  dateUploaded: string;
  uploadedBy: string;
  uploaderId?: string;
  size: string;
  description?: string;
  tags: string[];
  status?: 'pending' | 'approved' | 'rejected' | 'changes-requested';
  approvalData?: {
    reviewerId?: string;
    reviewerName?: string;
    reviewDate?: string;
    comments?: string;
    category?: 'concept' | 'schematic' | 'documentation-ready';
  };
  version?: number;
  previousVersions?: string[];
}

interface AssetManagerProps {
  assets: Asset[];
  projectId: string;
  onAssetUpload: (file: File, description: string, tags: string[], category?: 'concept' | 'schematic' | 'documentation-ready') => void;
  onDeleteAsset: (assetId: string) => void;
  onEditAsset: (assetId: string, updates: Partial<Asset>) => void;
  onApproveAsset?: (assetId: string, comment?: string) => void;
  onRejectAsset?: (assetId: string, comment: string) => void;
  onRequestChanges?: (assetId: string, comment: string) => void;
  currentUserRole?: 'admin' | 'reviewer' | 'contributor' | 'viewer';
  initialUploadModalOpen?: boolean;
  onCloseUploadModal?: () => void;
}

const AssetManager = forwardRef<{openUploadModal: () => void}, AssetManagerProps>(({
  assets,
  projectId,
  onAssetUpload,
  onDeleteAsset,
  onEditAsset,
  onApproveAsset,
  onRejectAsset,
  onRequestChanges,
  currentUserRole = 'contributor',
  initialUploadModalOpen = false,
  onCloseUploadModal
}, ref) => {
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(initialUploadModalOpen);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<'concept' | 'schematic' | 'documentation-ready' | undefined>(undefined);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  
  // Expose methods to parent components via ref
  useImperativeHandle(ref, () => ({
    openUploadModal: () => setIsUploadModalOpen(true)
  }));
  
  // Filter assets based on type, status, and search query
  const filteredAssets = assets.filter(asset => {
    const matchesType = !filterType || asset.type === filterType;
    const matchesStatus = !filterStatus || asset.status === filterStatus;
    const matchesQuery = !searchQuery || 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.description && asset.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      asset.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesType && matchesStatus && matchesQuery;
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
      onAssetUpload(uploadFile, uploadDescription, uploadTags, uploadCategory);
      closeUploadModal();
    }
  };
  
  const openPreviewModal = (asset: Asset) => {
    setPreviewAsset(asset);
    setIsPreviewModalOpen(true);
    setReviewComment('');
  };
  
  const closePreviewModal = () => {
    setIsPreviewModalOpen(false);
    setPreviewAsset(null);
    setReviewComment('');
  };
  
  const handleApproveAsset = async () => {
    if (previewAsset && onApproveAsset) {
      try {
        setIsSubmittingReview(true);
        await onApproveAsset(previewAsset.id, reviewComment);
        closePreviewModal();
      } catch (error) {
        console.error('Error approving asset:', error);
        // Handle error state here if needed
      } finally {
        setIsSubmittingReview(false);
      }
    }
  };
  
  const handleRejectAsset = async () => {
    if (previewAsset && onRejectAsset && reviewComment.trim()) {
      try {
        setIsSubmittingReview(true);
        await onRejectAsset(previewAsset.id, reviewComment);
        closePreviewModal();
      } catch (error) {
        console.error('Error rejecting asset:', error);
        // Handle error state here if needed
      } finally {
        setIsSubmittingReview(false);
      }
    }
  };
  
  const handleRequestChanges = async () => {
    if (previewAsset && onRequestChanges && reviewComment.trim()) {
      try {
        setIsSubmittingReview(true);
        await onRequestChanges(previewAsset.id, reviewComment);
        closePreviewModal();
      } catch (error) {
        console.error('Error requesting changes:', error);
        // Handle error state here if needed
      } finally {
        setIsSubmittingReview(false);
      }
    }
  };
  
  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
    setUploadFile(null);
    setUploadDescription('');
    setUploadTags([]);
    setUploadCategory(undefined);
    
    // Call the parent callback if provided
    if (onCloseUploadModal) {
      onCloseUploadModal();
    }
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
          
          <div className={styles.filterStatusDropdown}>
            <select 
              value={filterStatus || ''} 
              onChange={(e) => setFilterStatus(e.target.value || null)}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="changes-requested">Changes Requested</option>
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
            className={`${styles.assetItem} ${selectedAssets.includes(asset.id) ? styles.selected : ''} ${
              asset.status ? styles[`status-${asset.status}`] : ''
            }`}
          >
            {asset.status && (
              <div className={`${styles.assetStatus} ${styles[`status-${asset.status}`]}`}>
                {asset.status === 'pending' && (
                  <>
                    <i className="fas fa-clock"></i>
                    <span>Pending Review</span>
                  </>
                )}
                {asset.status === 'approved' && (
                  <>
                    <i className="fas fa-check-circle"></i>
                    <span>Approved</span>
                  </>
                )}
                {asset.status === 'rejected' && (
                  <>
                    <i className="fas fa-times-circle"></i>
                    <span>Rejected</span>
                  </>
                )}
                {asset.status === 'changes-requested' && (
                  <>
                    <i className="fas fa-exclamation-circle"></i>
                    <span>Changes Requested</span>
                  </>
                )}
              </div>
            )}
            <div className={styles.assetItemHeader}>
              <input 
                type="checkbox" 
                checked={selectedAssets.includes(asset.id)}
                onChange={() => handleSelectAsset(asset.id)}
              />
              <div className={styles.assetActions}>
                <button 
                  className={styles.iconButton}
                  onClick={() => openPreviewModal(asset)}
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
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={uploadCategory || ''}
                  onChange={(e) => setUploadCategory(e.target.value as any || undefined)}
                >
                  <option value="">Select a category</option>
                  <option value="concept">Concept</option>
                  <option value="schematic">Schematic</option>
                  <option value="documentation-ready">Documentation Ready</option>
                </select>
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
                className={styles.submitButton}
                onClick={() => {
                  if (uploadFile) {
                    handleUpload();
                  }
                }}
                disabled={!uploadFile}
              >
                Submit for Approval
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
      
      {/* Asset Preview Modal */}
      {isPreviewModalOpen && previewAsset && (
        <div className={styles.previewModalBackdrop}>
          <div className={styles.previewModal}>
            <div className={styles.previewModalHeader}>
              <h3>{previewAsset.name}</h3>
              <button className={styles.closeButton} onClick={closePreviewModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className={styles.previewModalContent}>
              <div className={styles.previewContainer}>
                {previewAsset.type === 'image' ? (
                  <img src={previewAsset.url} alt={previewAsset.name} className={styles.imagePreview} />
                ) : previewAsset.type === 'model' ? (
                  <div className={styles.modelViewer}>
                    <ModelViewer originalModelUrl={previewAsset.url} />
                  </div>
                ) : (
                  <div className={styles.documentPreview}>
                    <i className={getFileIcon(previewAsset.type)}></i>
                    <p>{previewAsset.name}</p>
                    <a href={previewAsset.url} target="_blank" rel="noopener noreferrer" className={styles.previewButton}>
                      Open {previewAsset.type.charAt(0).toUpperCase() + previewAsset.type.slice(1)}
                    </a>
                  </div>
                )}
              </div>
              
              <div className={styles.assetMetadata}>
                <div className={styles.metadataSection}>
                  <h4>Asset Details</h4>
                  <div className={styles.metadataGrid}>
                    <div className={styles.metadataItem}>
                      <span className={styles.metadataLabel}>Type</span>
                      <span className={styles.metadataValue}>{previewAsset.type}</span>
                    </div>
                    <div className={styles.metadataItem}>
                      <span className={styles.metadataLabel}>Size</span>
                      <span className={styles.metadataValue}>{previewAsset.size}</span>
                    </div>
                    <div className={styles.metadataItem}>
                      <span className={styles.metadataLabel}>Uploaded</span>
                      <span className={styles.metadataValue}>{new Date(previewAsset.dateUploaded).toLocaleDateString()}</span>
                    </div>
                    <div className={styles.metadataItem}>
                      <span className={styles.metadataLabel}>Uploaded By</span>
                      <span className={styles.metadataValue}>{previewAsset.uploadedBy}</span>
                    </div>
                    {previewAsset.version && (
                      <div className={styles.metadataItem}>
                        <span className={styles.metadataLabel}>Version</span>
                        <span className={styles.metadataValue}>{previewAsset.version}</span>
                      </div>
                    )}
                    {previewAsset.status && (
                      <div className={styles.metadataItem}>
                        <span className={styles.metadataLabel}>Status</span>
                        <span className={`${styles.metadataValue} ${styles[`status-${previewAsset.status}`]}`}>
                          {previewAsset.status === 'pending' && (
                            <>
                              <i className="fas fa-clock"></i> Pending Review
                            </>
                          )}
                          {previewAsset.status === 'approved' && (
                            <>
                              <i className="fas fa-check-circle"></i> Approved
                            </>
                          )}
                          {previewAsset.status === 'rejected' && (
                            <>
                              <i className="fas fa-times-circle"></i> Rejected
                            </>
                          )}
                          {previewAsset.status === 'changes-requested' && (
                            <>
                              <i className="fas fa-exclamation-circle"></i> Changes Requested
                            </>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {previewAsset.description && (
                  <div className={styles.metadataSection}>
                    <h4>Description</h4>
                    <p className={styles.description}>{previewAsset.description}</p>
                  </div>
                )}
                
                {previewAsset.tags && previewAsset.tags.length > 0 && (
                  <div className={styles.metadataSection}>
                    <h4>Tags</h4>
                    <div className={styles.tagsList}>
                      {previewAsset.tags.map(tag => (
                        <span key={tag} className={styles.tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                
                {previewAsset.approvalData?.comments && (
                  <div className={styles.metadataSection}>
                    <h4>Review Comments</h4>
                    <div className={styles.reviewComments}>
                      <p>{previewAsset.approvalData.comments}</p>
                      <div className={styles.commentMeta}>
                        by {previewAsset.approvalData.reviewerName || "Unknown"} on {
                          previewAsset.approvalData.reviewDate ? 
                          new Date(previewAsset.approvalData.reviewDate).toLocaleDateString() : "Unknown date"
                        }
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Review Section for Admins & Reviewers */}
                {(currentUserRole === 'admin' || currentUserRole === 'reviewer') && 
                 previewAsset.status === 'pending' && (
                  <div className={styles.reviewSection}>
                    <h4>Review Asset</h4>
                    <div className={styles.reviewInfo}>
                      <p className={styles.reviewTip}>
                        <i className="fas fa-info-circle"></i>
                        {previewAsset.approvalData?.category ? 
                          `Review this ${previewAsset.approvalData.category} asset` : 
                          'Provide feedback for this asset'}
                      </p>
                    </div>
                    
                    <textarea
                      placeholder="Add your review comments here..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      rows={4}
                      className={styles.reviewCommentInput}
                      disabled={isSubmittingReview}
                    ></textarea>
                    
                    <div className={styles.reviewActions}>
                      <button
                        className={`${styles.reviewButton} ${styles.approveButton}`}
                        onClick={handleApproveAsset}
                        disabled={isSubmittingReview}
                      >
                        {isSubmittingReview ? (
                          <><i className="fas fa-spinner fa-spin"></i> Approving...</>
                        ) : (
                          <><i className="fas fa-check"></i> Approve</>
                        )}
                      </button>
                      <button
                        className={`${styles.reviewButton} ${styles.rejectButton}`}
                        onClick={handleRejectAsset}
                        disabled={!reviewComment.trim() || isSubmittingReview}
                      >
                        {isSubmittingReview ? (
                          <><i className="fas fa-spinner fa-spin"></i> Rejecting...</>
                        ) : (
                          <><i className="fas fa-times"></i> Reject</>
                        )}
                      </button>
                      <button
                        className={`${styles.reviewButton} ${styles.changeButton}`}
                        onClick={handleRequestChanges}
                        disabled={!reviewComment.trim() || isSubmittingReview}
                      >
                        {isSubmittingReview ? (
                          <><i className="fas fa-spinner fa-spin"></i> Requesting...</>
                        ) : (
                          <><i className="fas fa-edit"></i> Request Changes</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className={styles.previewModalFooter}>
              <button className={styles.cancelButton} onClick={closePreviewModal}>
                Close
              </button>
              {previewAsset.status === 'changes-requested' && (
                <button className={styles.uploadButton}>
                  <i className="fas fa-cloud-upload-alt"></i> Upload New Version
                </button>
              )}
              {/* Submit for Approval button for contributors when asset status is undefined */}
              {currentUserRole === 'contributor' && !previewAsset.status && (
                <button 
                  className={`${styles.reviewButton} ${styles.approveButton}`}
                  onClick={() => {
                    // Set the asset status to 'pending' when submitting for approval
                    onEditAsset(previewAsset.id, { status: 'pending' });
                    closePreviewModal();
                  }}
                >
                  <i className="fas fa-paper-plane"></i> Submit for Approval
                </button>
              )}
              <button className={styles.downloadButton}>
                <i className="fas fa-download"></i> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// Add display name to fix ESLint error
AssetManager.displayName = 'AssetManager';

export default AssetManager;
