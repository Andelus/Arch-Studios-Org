/**
 * Service for handling team invitations
 */

import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';
import { sendTeamInvitation } from './notification-service';
import { environment } from '@/utils/environment';
import { rateLimit } from '@/utils/rate-limit';

// Constants
const MAX_PENDING_INVITATIONS_PER_PROJECT = 20;

// Create rate limiters
const invitationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  maxRequests: 10, // 10 invitations per hour per user
  message: 'Too many invitations created. Please try again later.'
});

// Create a separate limiter for resending invitations
const resendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minute window
  maxRequests: 5, // 5 resends per 10 minutes
  message: 'Too many invitation resend attempts. Please try again later.'
});

interface CreateInvitationParams {
  projectId: string;
  projectName: string;
  email: string;
  role: string;
  permission: 'admin' | 'editor' | 'viewer';
  inviterId: string;
  inviterName: string;
}

interface Invitation {
  id: string;
  project_id: string;
  email: string;
  role: string;
  permission: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  expires_at: string;
}

/**
 * Create a new team invitation and send an email to the invitee
 * 
 * @param params Invitation parameters
 * @returns The created invitation or null if it failed
 */
export async function createInvitation(params: CreateInvitationParams): Promise<Invitation | null> {
  try {
    // Validate inputs
    if (!params.email || !params.email.includes('@')) {
      console.error('Invalid email address provided');
      return null;
    }
    
    if (!params.projectId || !params.inviterId) {
      console.error('Missing required parameters');
      return null;
    }
    
    // Validate permission is one of the allowed values
    const validPermissions = ['admin', 'editor', 'viewer'];
    if (!validPermissions.includes(params.permission)) {
      console.error('Invalid permission specified:', params.permission);
      return null;
    }
    
    // Apply rate limiting
    const rateLimitResult = await invitationLimiter.check(params.inviterId);
    if (rateLimitResult.isLimited) {
      console.warn('Rate limit exceeded for invitation creation. User:', params.inviterId, 
        'Remaining:', rateLimitResult.remainingRequests,
        'Reset at:', new Date(rateLimitResult.resetTime).toISOString());
      return null;
    }
    
    // Check pending invitations count for the project
    const { count, error: countError } = await supabase
      .from('team_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', params.projectId)
      .eq('status', 'pending');
    
    if (countError) {
      console.error('Failed to count pending invitations:', countError);
      return null;
    }
    
    if (count && count >= MAX_PENDING_INVITATIONS_PER_PROJECT) {
      console.error(`Maximum pending invitations (${MAX_PENDING_INVITATIONS_PER_PROJECT}) reached for project:`, params.projectId);
      return null;
    }
    
    // Check if the user already has a pending invitation
    const { data: existingInvitation, error: existingError } = await supabase
      .from('team_invitations')
      .select('id, created_at')
      .eq('project_id', params.projectId)
      .eq('email', params.email)
      .eq('status', 'pending')
      .maybeSingle();
    
    if (existingError) {
      console.error('Error checking for existing invitation:', existingError);
    } else if (existingInvitation) {
      console.log('User already has a pending invitation:', existingInvitation.id);
      // Return the existing invitation instead of creating a new one
      return existingInvitation as Invitation;
    }
    
    // Generate a unique invitation token
    const invitationId = uuidv4();
    
    // Calculate expiration date (7 days from now or configured days)
    const createdAt = new Date();
    const expiresAt = new Date(createdAt);
    expiresAt.setDate(expiresAt.getDate() + environment.INVITATION_EXPIRY_DAYS);
    
    // Store the invitation in the database
    const { data: invitation, error } = await supabase
      .from('team_invitations')
      .insert({
        id: invitationId,
        project_id: params.projectId,
        email: params.email,
        role: params.role,
        permission: params.permission,
        inviter_id: params.inviterId,
        status: 'pending',
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to create invitation:', error);
      return null;
    }
    
    // Check if the user already exists in the system by email
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', params.email)
      .maybeSingle();
    
    // If the user already exists in the system, add them directly to the project
    if (existingUser) {
      // Add the user directly to the project team
      const { error: teamError } = await supabase
        .from('project_members')
        .insert({
          project_id: params.projectId,
          user_id: existingUser.id,
          role: params.role,
          permission: params.permission,
          created_at: createdAt.toISOString(),
          invited_by: params.inviterId
        });
      
      if (teamError) {
        console.error('Failed to add user directly to project:', teamError);
        // Continue with invitation process as fallback
      } else {
        // Log the direct addition
        await logInvitationActivity('accept', invitationId, params.inviterId, {
          project_id: params.projectId,
          email: params.email,
          user_id: existingUser.id,
          role: params.role,
          permission: params.permission
        });
        
        // Send an in-app notification to the user
        const inviteLink = `/workspace/project/${params.projectId}`;
        
        const notificationSent = await sendTeamInvitation(
          params.email,
          params.inviterName,
          params.projectName,
          params.role,
          inviteLink
        );
        
        if (!notificationSent) {
          console.error('Failed to send notification to user');
        }
        
        // Update the invitation to accepted status
        await supabase
          .from('team_invitations')
          .update({ status: 'accepted' })
          .eq('id', invitationId);
        
        return invitation as Invitation;
      }
    }
    
    // For users who don't exist in the system yet, create a notification that will be shown when they register
    const baseUrl = environment.APP_URL;
    const inviteLink = `${baseUrl}/invitation/accept?token=${invitationId}`;
    
    // Send the invitation notification
    const notificationSent = await sendTeamInvitation(
      params.email,
      params.inviterName,
      params.projectName,
      params.role,
      inviteLink
    );
    
    if (!notificationSent) {
      console.error('Failed to create invitation notification');
      // Log the failure but don't fail the operation - they can resend later
      await logInvitationActivity('create_email_failed', invitationId, params.inviterId, {
        project_id: params.projectId,
        email: params.email,
      });
    } else {
      // Log successful invitation
      await logInvitationActivity('create', invitationId, params.inviterId, {
        project_id: params.projectId,
        email: params.email,
        role: params.role,
        permission: params.permission
      });
    }
    
    return invitation as Invitation;
  } catch (error) {
    console.error('Invitation creation error:', error);
    return null;
  }
}

/**
 * Validate an invitation token and return the invitation if valid
 * 
 * @param token The invitation token to validate
 * @returns The invitation if valid, null if invalid or expired
 */
export async function validateInvitation(token: string): Promise<Invitation | null> {
  try {
    const { data: invitation, error } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('id', token)
      .eq('status', 'pending')
      .single();
    
    if (error || !invitation) {
      return null;
    }
    
    // Check if invitation has expired
    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < new Date()) {
      // Update the invitation status to expired
      await supabase
        .from('team_invitations')
        .update({ status: 'expired' })
        .eq('id', token);
      
      return null;
    }
    
    return invitation as Invitation;
  } catch (error) {
    console.error('Invitation validation error:', error);
    return null;
  }
}

/**
 * Log invitation-related activities for audit and security purposes
 * 
 * @param action The action being performed
 * @param invitationId The invitation ID
 * @param userId The user ID performing the action
 * @param details Additional details to log
 */
async function logInvitationActivity(
  action: 'create' | 'accept' | 'expire' | 'resend' | 'create_email_failed', 
  invitationId: string,
  userId: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await supabase.from('activity_logs').insert({
      action_type: `invitation_${action}`,
      user_id: userId,
      resource_id: invitationId,
      resource_type: 'invitation',
      details,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log invitation activity:', error);
    // Non-blocking - don't fail the main operation if logging fails
  }
}

/**
 * Accept an invitation and add the user to the team
 * 
 * @param token The invitation token
 * @param userId The accepting user's ID
 * @returns Success status
 */
export async function acceptInvitation(token: string, userId: string): Promise<boolean> {
  try {
    if (!token || !userId) {
      console.error('Missing required parameters for acceptInvitation');
      return false;
    }
    
    // Validate the invitation
    const invitation = await validateInvitation(token);
    if (!invitation) {
      console.error('Invalid or expired invitation token:', token);
      return false;
    }
    
    // Verify the permission is valid
    const validPermissions = ['admin', 'editor', 'viewer'];
    if (!validPermissions.includes(invitation.permission)) {
      console.error('Invalid permission in invitation:', invitation.permission);
      return false;
    }
    
    // Begin a transaction to accept the invitation
    const { error: transactionError } = await supabase.rpc('accept_team_invitation', {
      invitation_token: token,
      user_id: userId
    });

    if (transactionError) {
      console.error('Failed to accept invitation:', transactionError);
      return false;
    }
    
    // Log the acceptance
    await logInvitationActivity('accept', token, userId, {
      project_id: invitation.project_id,
      email: invitation.email,
      role: invitation.role,
      permission: invitation.permission
    });
    
    return true;
  } catch (error) {
    console.error('Accept invitation error:', error);
    return false;
  }
}

/**
 * Resend an invitation email for a pending invitation
 * 
 * @param invitationId The ID of the invitation to resend
 * @param userId The ID of the user requesting the resend
 * @returns Success status
 */
export async function resendInvitation(invitationId: string, userId: string): Promise<boolean> {
  try {
    // Apply rate limiting for resending
    const rateLimitResult = await resendLimiter.check(userId);
    if (rateLimitResult.isLimited) {
      console.warn('Rate limit exceeded for invitation resend. User:', userId,
        'Remaining:', rateLimitResult.remainingRequests,
        'Reset at:', new Date(rateLimitResult.resetTime).toISOString());
      return false;
    }
    
    // Get the invitation details
    const { data: invitation, error } = await supabase
      .from('team_invitations')
      .select('*, projects(name)')
      .eq('id', invitationId)
      .eq('status', 'pending')
      .single();
    
    if (error || !invitation) {
      console.error('Failed to get invitation for resend:', error || 'Invitation not found');
      return false;
    }
    
    // Get inviter details
    const { data: inviter } = await supabase
      .from('profiles')
      .select('full_name, display_name')
      .eq('id', invitation.inviter_id)
      .single();
    
    const inviterName = inviter?.full_name || inviter?.display_name || 'A team member';
    const projectName = invitation.projects?.name || 'Project';
    
    // Generate the invitation link
    const baseUrl = environment.APP_URL;
    const inviteLink = `${baseUrl}/invitation/accept?token=${invitationId}`;
    
    // Reset the expiration date (optional)
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + environment.INVITATION_EXPIRY_DAYS);
    
    // Update the expiration date in the database
    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({ 
        expires_at: newExpiresAt.toISOString()
      })
      .eq('id', invitationId);
    
    if (updateError) {
      console.error('Failed to update invitation expiry:', updateError);
    }
    
    // Check if the user exists in the system now (they might have registered since the initial invitation)
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', invitation.email)
      .maybeSingle();
      
    // If the user exists now, add them directly to the project
    if (existingUser) {
      // Add the user directly to the project team
      const { error: teamError } = await supabase
        .from('project_members')
        .insert({
          project_id: invitation.project_id,
          user_id: existingUser.id,
          role: invitation.role,
          permission: invitation.permission,
          created_at: new Date().toISOString(),
          invited_by: invitation.inviter_id
        });
        
      if (!teamError) {
        // Update the invitation to accepted
        await supabase
          .from('team_invitations')
          .update({ status: 'accepted' })
          .eq('id', invitationId);
          
        // Send notification to user
        await sendTeamInvitation(
          invitation.email,
          inviterName,
          projectName,
          invitation.role,
          `/workspace/project/${invitation.project_id}`
        );
        
        return true;
      }
    }
    
    // Resend the invitation notification
    const notificationSent = await sendTeamInvitation(
      invitation.email,
      inviterName,
      projectName,
      invitation.role,
      inviteLink
    );
    
    if (!notificationSent) {
      console.error('Failed to resend invitation notification');
      return false;
    }
    
    // Log the resend
    await logInvitationActivity('resend', invitationId, userId, {
      email: invitation.email,
      project_id: invitation.project_id
    });
    
    return true;
  } catch (error) {
    console.error('Invitation resend error:', error);
    return false;
  }
}
