import React, { useState } from 'react';
import styles from './CommunicationPanel.module.css';

interface FileUploadProps {
  file: File;
  onRemove: () => void;
  uploadProgress?: number;
}

export const FileUploadItem: React.FC<FileUploadProps> = ({ 
  file, 
  onRemove, 
  uploadProgress 
}) => {
  // Determine file icon based on type
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return 'fas fa-image';
    if (fileType === 'application/pdf') return 'fas fa-file-pdf';
    if (fileType.includes('word') || fileType === 'application/msword' || 
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') 
      return 'fas fa-file-word';
    if (fileType.includes('excel') || fileType === 'application/vnd.ms-excel' || 
        fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') 
      return 'fas fa-file-excel';
    if (fileType.includes('zip') || fileType === 'application/zip' || 
        fileType === 'application/x-zip-compressed')
      return 'fas fa-file-archive';
    return 'fas fa-file';
  };

  return (
    <div className={styles.attachmentPreviewItem}>
      <i className={getFileIcon(file.type)}></i>
      <span className={styles.attachmentPreviewName}>
        {file.name}
      </span>
      {uploadProgress !== undefined && (
        <div className={styles.uploadProgress}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}
      <button 
        type="button"
        className={styles.removeAttachmentButton}
        onClick={onRemove}
      >
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

export default FileUploadItem;
