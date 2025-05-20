import { useEffect, useState, useRef } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import AssetManager from "@/components/AssetManager";

interface AssetManagerIntegrationProps {
  projectId: string;
  isAdmin: boolean;
  notifications: {
    addNotification: (
      type: 'info' | 'success' | 'warning' | 'error' | 'team_invitation' | 'invitation_accepted' | 'invitation_reminder' | 
            'asset_approved' | 'asset_rejected' | 'asset_changes_requested' | 'asset_submitted', 
      title: string, 
      message: string, 
      link?: string,
      metadata?: Record<string, any>
    ) => void;
  };
}

export function AssetManagerIntegration({ 
  projectId,
  isAdmin,
  notifications
}: AssetManagerIntegrationProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const assetManagerRef = useRef<any>(null);
  
  // Listen for the triggerAssetUpload event
  useEffect(() => {
    const handleTriggerUpload = () => {
      setShowUploadModal(true);
    };
    
    document.addEventListener('triggerAssetUpload', handleTriggerUpload);
    
    return () => {
      document.removeEventListener('triggerAssetUpload', handleTriggerUpload);
    };
  }, []);
  const {
    projectAssets,
    uploadAsset,
    deleteAsset,
    editAsset,
    approveAsset,
    rejectAsset,
    requestChanges
  } = useWorkspace();

  return (
    <AssetManager
      assets={projectAssets[projectId] || []}
      projectId={projectId}
      currentUserRole={isAdmin ? 'admin' : 'contributor'}
      initialUploadModalOpen={showUploadModal}
      onCloseUploadModal={() => setShowUploadModal(false)}
      onAssetUpload={async (file, description, tags, category) => {
        try {
          await uploadAsset(projectId, file, description, tags, category);
          
          // Find the newly uploaded asset
          const assetName = file.name;
          
          if (isAdmin) {
            // Self-notify for admin users
            notifications.addNotification(
              'asset_submitted',
              'New Asset Uploaded',
              `You uploaded "${assetName}" successfully.`,
              `/workspace/projects/${projectId}`,
              { projectId }
            );
          } else {
            // Notify when asset is submitted for approval
            notifications.addNotification(
              'success',
              'Asset Submitted for Review',
              `Your asset "${assetName}" has been submitted for review.`,
              `/workspace/projects/${projectId}`,
              { projectId, status: 'pending' }
            );
          }
        } catch (error) {
          console.error('Error uploading asset:', error);
          notifications.addNotification(
            'error',
            'Upload Failed',
            'There was an error uploading your asset. Please try again.'
          );
        }
      }}
      onDeleteAsset={async (assetId) => {
        try {
          await deleteAsset(projectId, assetId);
          notifications.addNotification(
            'info',
            'Asset Deleted',
            'The asset has been deleted successfully.'
          );
        } catch (error) {
          console.error('Error deleting asset:', error);
          notifications.addNotification(
            'error',
            'Deletion Failed',
            'There was an error deleting the asset. Please try again.'
          );
        }
      }}
      onEditAsset={async (assetId, updates) => {
        try {
          await editAsset(projectId, assetId, updates);
          notifications.addNotification(
            'success',
            'Asset Updated',
            `The asset "${updates.name || 'asset'}" has been updated successfully.`,
            `/workspace/projects/${projectId}`
          );
        } catch (error) {
          console.error('Error updating asset:', error);
          notifications.addNotification(
            'error',
            'Update Failed',
            'There was an error updating the asset. Please try again.'
          );
        }
      }}
      onApproveAsset={async (assetId, comment) => {
        try {
          // Find the asset in the current list to get its name
          const asset = projectAssets[projectId]?.find(a => a.id === assetId);
          const assetName = asset?.name || 'asset';
          
          await approveAsset(projectId, assetId, comment);
          
          notifications.addNotification(
            'asset_approved',
            'Asset Approved',
            `You approved "${assetName}".`,
            `/workspace/projects/${projectId}`,
            { 
              assetId,
              projectId,
              comment
            }
          );
        } catch (error) {
          console.error('Error approving asset:', error);
          notifications.addNotification(
            'error',
            'Approval Failed',
            'There was an error approving the asset. Please try again.'
          );
          throw error;
        }
      }}
      onRejectAsset={async (assetId, comment) => {
        try {
          // Find the asset in the current list to get its name
          const asset = projectAssets[projectId]?.find(a => a.id === assetId);
          const assetName = asset?.name || 'asset';
          
          await rejectAsset(projectId, assetId, comment);
          
          notifications.addNotification(
            'asset_rejected',
            'Asset Rejected',
            `You rejected "${assetName}" with feedback.`,
            `/workspace/projects/${projectId}`,
            { 
              assetId,
              projectId,
              comment
            }
          );
        } catch (error) {
          console.error('Error rejecting asset:', error);
          notifications.addNotification(
            'error',
            'Rejection Failed',
            'There was an error rejecting the asset. Please try again.'
          );
          throw error;
        }
      }}
      onRequestChanges={async (assetId, comment) => {
        try {
          // Find the asset in the current list to get its name
          const asset = projectAssets[projectId]?.find(a => a.id === assetId);
          const assetName = asset?.name || 'asset';
          
          await requestChanges(projectId, assetId, comment);
          
          notifications.addNotification(
            'asset_changes_requested',
            'Changes Requested',
            `You requested changes to "${assetName}".`,
            `/workspace/projects/${projectId}`,
            { 
              assetId,
              projectId,
              comment
            }
          );
        } catch (error) {
          console.error('Error requesting changes:', error);
          notifications.addNotification(
            'error',
            'Request Failed',
            'There was an error requesting changes to the asset. Please try again.'
          );
          throw error;
        }
      }}
    />
  );
}
