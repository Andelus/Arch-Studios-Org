"use client";

import { useState, useCallback, useEffect } from 'react';
import { useTeam, TeamInvitation } from '@/contexts/TeamContext';
import { useNotifications } from '@/hooks/useNotifications';

interface UseTeamInvitationsResult {
  invitations: TeamInvitation[];
  isLoading: boolean;
  error: string | null;
  resendInvitation: (invitationId: string) => Promise<boolean>;
  refreshInvitations: () => Promise<void>;
}

/**
 * Hook for managing team invitations
 * 
 * @param projectId The ID of the project to get invitations for
 * @returns Functions and state for working with invitations
 */
export function useTeamInvitations(projectId: string): UseTeamInvitationsResult {
  const { pendingInvitations, fetchPendingInvitations, resendInvitation } = useTeam();
  const { addNotification } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get invitations for this project
  const invitations = pendingInvitations[projectId] || [];
  
  // Function to refresh invitations
  const refreshInvitations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await fetchPendingInvitations(projectId);
    } catch (err) {
      setError('Failed to fetch invitations');
      console.error('Error fetching invitations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, fetchPendingInvitations]);
  
  // Wrapper for resendInvitation that handles notifications
  const handleResendInvitation = useCallback(async (invitationId: string) => {
    try {
      const result = await resendInvitation(invitationId);
      if (result) {
        addNotification(
          'success',
          'Invitation resent',
          'The invitation has been resent successfully.'
        );
      } else {
        addNotification(
          'error',
          'Failed to resend',
          'There was a problem resending the invitation. Please try again.'
        );
      }
      return result;
    } catch (err) {
      addNotification(
        'error',
        'Error resending invitation',
        'An unexpected error occurred. Please try again later.'
      );
      console.error('Error resending invitation:', err);
      return false;
    }
  }, [resendInvitation, addNotification]);
  
  // Fetch invitations when the component mounts
  useEffect(() => {
    refreshInvitations();
  }, [refreshInvitations]);
  
  return {
    invitations,
    isLoading,
    error,
    resendInvitation: handleResendInvitation,
    refreshInvitations
  };
}
