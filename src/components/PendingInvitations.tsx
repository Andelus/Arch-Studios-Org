"use client";

import { useState } from 'react';
import styles from './PendingInvitations.module.css';
import { useTeamInvitations } from '@/hooks/useTeamInvitations';
import { TeamInvitation } from '@/contexts/TeamContext';

interface PendingInvitationsProps {
  projectId: string;
  invitations?: TeamInvitation[]; // Optional - if not provided, will use useTeamInvitations hook
  onResend?: (invitationId: string) => Promise<void>; // Optional - if not provided, will use hook
}

export default function PendingInvitations({
  projectId,
  invitations: propInvitations,
  onResend: propOnResend
}: PendingInvitationsProps) {
  // Use the hook if invitations are not provided as props
  const {
    invitations: hookInvitations,
    isLoading: isLoadingInvitations,
    error: invitationsError,
    resendInvitation
  } = useTeamInvitations(projectId);
  
  // Use either the props or hook values
  const invitations = propInvitations || hookInvitations;
  const onResend = propOnResend || resendInvitation;
  
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  
  // Format date to readable format
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Calculate if invitation is about to expire (less than 2 days)
  const isExpiringSoon = (expiresAt: string): boolean => {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    
    return expiryDate.getTime() - now.getTime() < twoDaysInMs;
  };
  
  // Handle resend invitation
  const handleResend = async (invitationId: string) => {
    try {
      setLoading(prev => ({ ...prev, [invitationId]: true }));
      await onResend(invitationId);
    } finally {
      setLoading(prev => ({ ...prev, [invitationId]: false }));
    }
  };
  
  // Show loading state
  if (isLoadingInvitations) {
    return (
      <div className={styles.pendingInvitations}>
        <h3 className={styles.title}>Pending Invitations</h3>
        <div className={styles.loading}>
          <i className="fas fa-spinner fa-spin"></i> Loading invitations...
        </div>
      </div>
    );
  }
  
  // Show error state
  if (invitationsError) {
    return (
      <div className={styles.pendingInvitations}>
        <h3 className={styles.title}>Pending Invitations</h3>
        <div className={styles.error}>
          <i className="fas fa-exclamation-triangle"></i> {invitationsError}
        </div>
      </div>
    );
  }
  
  // No invitations
  if (invitations.length === 0) {
    return null;
  }
  
  return (
    <div className={styles.pendingInvitations}>
      <h3 className={styles.title}>Pending Invitations</h3>
      
      <div className={styles.table}>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Permission</th>
              <th>Sent</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map(invitation => (
              <tr key={invitation.id} className={isExpiringSoon(invitation.expires_at) ? styles.expiringSoon : ''}>
                <td>{invitation.email}</td>
                <td>{invitation.role}</td>
                <td className={styles.permission}>
                  <span className={`${styles.badge} ${styles[invitation.permission]}`}>
                    {invitation.permission}
                  </span>
                </td>
                <td>{formatDate(invitation.created_at)}</td>
                <td>
                  {formatDate(invitation.expires_at)}
                  {isExpiringSoon(invitation.expires_at) && (
                    <span className={styles.expiryWarning}>
                      <i className="fas fa-exclamation-circle"></i> Expiring soon
                    </span>
                  )}
                </td>
                <td>
                  <button
                    className={styles.resendButton}
                    onClick={() => handleResend(invitation.id)}
                    disabled={loading[invitation.id]}
                  >
                    {loading[invitation.id] ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      <><i className="fas fa-paper-plane"></i> Resend</>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
