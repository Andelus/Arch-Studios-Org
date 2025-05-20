/**
 * Notification service for handling team invitations and other notifications
 * This replaces the email-based notification system with in-app notifications
 */

import { supabase } from './supabase';

// Types
interface NotificationData {
  user_id?: string;
  email?: string;
  type: 'team_invitation' | 'invitation_accepted' | 'invitation_reminder' | 'system' | 
        'asset_approved' | 'asset_rejected' | 'asset_changes_requested' | 'asset_submitted';
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  is_read?: boolean;
}

/**
 * Send an in-app notification to a user
 * 
 * @param data Notification data
 * @returns Promise resolving to success status
 */
export async function sendNotification(data: NotificationData): Promise<boolean> {
  try {
    // Prepare notification record
    const notificationRecord = {
      user_id: data.user_id,
      email: data.email, 
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
      metadata: data.metadata,
      is_read: data.is_read || false,
      created_at: new Date().toISOString()
    };
    
    // Insert notification into the database
    const { error } = await supabase
      .from('notifications')
      .insert(notificationRecord);
      
    if (error) {
      console.error('Failed to create notification:', error);
      return false;
    }
    
    // If we're in development mode, log the notification
    if (process.env.NODE_ENV !== 'production') {
      console.log('Notification sent:', notificationRecord);
    }
    
    return true;
  } catch (error) {
    console.error('Notification sending error:', error);
    return false;
  }
}

/**
 * Send a team invitation notification
 * 
 * @param email Recipient email address
 * @param inviterName Name of the person sending the invitation
 * @param projectName Name of the project they're invited to
 * @param role Role they're invited as
 * @param inviteLink Link for accepting the invitation
 * @returns Promise resolving to success status
 */
export async function sendTeamInvitation(
  email: string,
  inviterName: string,
  projectName: string,
  role: string,
  inviteLink: string
): Promise<boolean> {
  // Sanitize inputs
  const sanitizedProjectName = (projectName || 'Project').trim();
  const sanitizedRole = (role || 'team member').trim();
  const sanitizedInviterName = (inviterName || 'A team member').trim();
  
  // Look up user by email to get their ID if they already exist in the system
  const { data: user } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  
  // Create the notification
  return sendNotification({
    user_id: user?.id, // Will be null if user doesn't exist yet
    email: email, // For users who haven't registered yet
    type: 'team_invitation',
    title: `You're invited to join ${sanitizedProjectName}`,
    message: `${sanitizedInviterName} has invited you to join ${sanitizedProjectName} as ${sanitizedRole}.`,
    link: inviteLink,
    metadata: {
      inviter_name: sanitizedInviterName,
      project_name: sanitizedProjectName,
      role: sanitizedRole
    }
  });
}

/**
 * Send an invitation reminder notification
 * 
 * @param email Recipient email address
 * @param projectName Name of the project
 * @param inviteLink Link for accepting the invitation
 * @returns Promise resolving to success status
 */
export async function sendInvitationReminder(
  email: string,
  projectName: string,
  inviteLink: string
): Promise<boolean> {
  const { data: user } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  
  return sendNotification({
    user_id: user?.id,
    email: email,
    type: 'invitation_reminder',
    title: `Reminder: You're invited to ${projectName}`,
    message: `You have a pending invitation to join ${projectName}. Click to respond.`,
    link: inviteLink,
    metadata: {
      project_name: projectName
    }
  });
}

/**
 * Send a notification when an invitation is accepted
 * 
 * @param projectId The project ID
 * @param projectName The project name
 * @param userEmail Email of the user who accepted the invitation
 * @param userName Name of the user who accepted the invitation
 * @param role Role of the user
 * @param inviterId ID of the user who sent the invitation
 * @returns Promise resolving to success status
 */
export async function sendInvitationAcceptedNotification(
  projectId: string,
  projectName: string,
  userEmail: string,
  userName: string,
  role: string,
  inviterId: string
): Promise<boolean> {
  return sendNotification({
    user_id: inviterId,
    type: 'invitation_accepted',
    title: `Invitation accepted: ${projectName}`,
    message: `${userName || userEmail} has accepted your invitation to join ${projectName} as ${role}.`,
    link: `/workspace/project/${projectId}/team`,
    metadata: {
      project_id: projectId,
      project_name: projectName,
      user_email: userEmail,
      user_name: userName,
      role: role
    }
  });
}

// Asset notification types
interface AssetNotificationData {
  assetId: string;
  assetName: string;
  projectId?: string;
  projectName?: string;
  reviewerId?: string;
  reviewerName?: string;
  uploaderId: string;
  comments?: string;
}

/**
 * Send a notification about an asset being approved
 * 
 * @param data Information about the approved asset
 * @returns Promise resolving to success status
 */
export async function sendAssetApprovedNotification(data: AssetNotificationData): Promise<boolean> {
  try {
    const message = data.comments 
      ? `Your asset "${data.assetName}" has been approved by ${data.reviewerName}. Comment: ${data.comments}`
      : `Your asset "${data.assetName}" has been approved by ${data.reviewerName}.`;
      
    return await sendNotification({
      user_id: data.uploaderId,
      type: 'asset_approved',
      title: 'Asset Approved',
      message,
      link: `/workspace/assets/${data.assetId}`,
      metadata: {
        assetId: data.assetId,
        assetName: data.assetName,
        projectId: data.projectId,
        projectName: data.projectName,
        reviewerId: data.reviewerId,
        reviewerName: data.reviewerName,
        comments: data.comments
      }
    });
  } catch (error) {
    console.error('Failed to send asset approved notification:', error);
    return false;
  }
}

/**
 * Send a notification about an asset being rejected
 * 
 * @param data Information about the rejected asset
 * @returns Promise resolving to success status
 */
export async function sendAssetRejectedNotification(data: AssetNotificationData): Promise<boolean> {
  if (!data.comments) {
    console.error('Comments are required for rejected assets');
    return false;
  }
  
  try {
    return await sendNotification({
      user_id: data.uploaderId,
      type: 'asset_rejected',
      title: 'Asset Rejected',
      message: `Your asset "${data.assetName}" has been rejected by ${data.reviewerName}. Reason: ${data.comments}`,
      link: `/workspace/assets/${data.assetId}`,
      metadata: {
        assetId: data.assetId,
        assetName: data.assetName,
        projectId: data.projectId,
        projectName: data.projectName,
        reviewerId: data.reviewerId,
        reviewerName: data.reviewerName,
        comments: data.comments
      }
    });
  } catch (error) {
    console.error('Failed to send asset rejected notification:', error);
    return false;
  }
}

/**
 * Send a notification about an asset needing changes
 * 
 * @param data Information about the asset needing changes
 * @returns Promise resolving to success status
 */
export async function sendAssetChangesRequestedNotification(data: AssetNotificationData): Promise<boolean> {
  if (!data.comments) {
    console.error('Comments are required for change requests');
    return false;
  }
  
  try {
    return await sendNotification({
      user_id: data.uploaderId,
      type: 'asset_changes_requested',
      title: 'Asset Changes Requested',
      message: `Changes have been requested for your asset "${data.assetName}" by ${data.reviewerName}. Details: ${data.comments}`,
      link: `/workspace/assets/${data.assetId}`,
      metadata: {
        assetId: data.assetId,
        assetName: data.assetName,
        projectId: data.projectId,
        projectName: data.projectName,
        reviewerId: data.reviewerId,
        reviewerName: data.reviewerName,
        comments: data.comments
      }
    });
  } catch (error) {
    console.error('Failed to send asset changes requested notification:', error);
    return false;
  }
}

/**
 * Send a notification about an asset being submitted for review
 * 
 * @param data Information about the submitted asset
 * @param reviewerIds Array of user IDs who should receive the notification
 * @returns Promise resolving to success status
 */
export async function sendAssetSubmittedNotification(
  data: Omit<AssetNotificationData, 'reviewerId' | 'reviewerName'>, 
  reviewerIds: string[]
): Promise<boolean> {
  try {
    // Send notifications to all reviewers
    const results = await Promise.all(reviewerIds.map(reviewerId => 
      sendNotification({
        user_id: reviewerId,
        type: 'asset_submitted',
        title: 'Asset Submitted for Review',
        message: `A new asset "${data.assetName}" has been submitted for review.`,
        link: `/workspace/assets/${data.assetId}`,
        metadata: {
          assetId: data.assetId,
          assetName: data.assetName,
          projectId: data.projectId,
          projectName: data.projectName,
          uploaderId: data.uploaderId
        }
      })
    ));
    
    // Return true if all notifications were sent successfully
    return results.every(result => result);
  } catch (error) {
    console.error('Failed to send asset submitted notifications:', error);
    return false;
  }
}
