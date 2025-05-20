/**
 * Common Asset type definition for the Arch Studios application
 */

export interface Asset {
  id: string;
  name: string;
  type: 'document' | 'image' | 'video' | 'model' | 'other';
  url: string;
  thumbnailUrl?: string;
  dateUploaded: string;
  uploadedBy: string;
  uploaderId?: string; // Made optional to match AssetManager
  size: string;
  description?: string;
  tags: string[];
  category?: 'concept' | 'schematic' | 'documentation-ready';
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
