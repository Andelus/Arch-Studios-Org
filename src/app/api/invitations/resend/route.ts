import { supabase } from '@/lib/supabase';
import { createInvitation } from '@/lib/invitation-service';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';

/**
 * API handler to resend an invitation
 * 
 * POST /api/invitations/resend
 * 
 * Body:
 * - invitationId: string - The ID of the invitation to resend
 */
export async function POST(req: NextRequest) {
  try {
    // Get the request body
    const { invitationId } = await req.json();

    if (!invitationId) {
      return Response.json(
        { error: "Missing required field: invitationId" },
        { status: 400 }
      );
    }

    // Get the authenticated user
    const { userId } = await auth();
    
    if (!userId) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Use the imported supabase client

    // Get the invitation
    const { data: invitation, error: invitationError } = await supabase
      .from('team_invitations')
      .select(`
        id,
        project_id,
        email,
        role,
        permission,
        inviter_id,
        status
      `)
      .eq('id', invitationId)
      .eq('status', 'pending')
      .single();

    if (invitationError || !invitation) {
      return Response.json(
        { error: "Invitation not found or no longer valid" },
        { status: 404 }
      );
    }

    // Get the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('name')
      .eq('id', invitation.project_id)
      .single();

    if (projectError) {
      return Response.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Create a new invitation
    const newInvitation = await createInvitation({
      projectId: invitation.project_id,
      projectName: project.name,
      email: invitation.email,
      role: invitation.role,
      permission: invitation.permission as 'admin' | 'editor' | 'viewer',
      inviterId: userId,
      inviterName: 'Team Member'
    });

    if (!newInvitation) {
      return Response.json(
        { error: "Failed to resend invitation" },
        { status: 500 }
      );
    }

    // Mark the old invitation as expired
    await supabase
      .from('team_invitations')
      .update({ status: 'expired' })
      .eq('id', invitationId);

    return Response.json({
      success: true,
      message: "Invitation resent successfully"
    });
  } catch (error) {
    console.error('Error resending invitation:', error);
    return Response.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Auth is now imported from @clerk/nextjs/server
