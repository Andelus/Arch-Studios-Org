"use client";

import { useState, useEffect } from 'react';
import styles from './TeamManagementModal.module.css';
import PendingInvitations from './PendingInvitations';
import { useTeam, TeamInvitation } from '@/contexts/TeamContext';

interface Member {
  id: string;
  name: string;
  avatar: string;
  role: string;
  status: 'online' | 'offline' | 'away';
  permission: 'admin' | 'editor' | 'viewer';
}

interface TeamManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentMembers: Member[];
  onAddMember: (email: string, role: string, permission: 'admin' | 'editor' | 'viewer') => void;
  onUpdateMember: (memberId: string, updates: Partial<Member>) => void;
  onRemoveMember: (memberId: string) => void;
}

const PERMISSIONS = [
  { id: 'admin', name: 'Admin', description: 'Can manage team, edit all content, and change settings' },
  { id: 'editor', name: 'Editor', description: 'Can edit content but cannot manage team or settings' },
  { id: 'viewer', name: 'Viewer', description: 'Can view but not edit content or settings' }
];

export default function TeamManagementModal({
  isOpen,
  onClose,
  projectId,
  currentMembers,
  onAddMember,
  onUpdateMember,
  onRemoveMember
}: TeamManagementModalProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'invite'>('members');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [invitePermission, setInvitePermission] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  
  // Get pending invitations from the Team context
  const { pendingInvitations, fetchPendingInvitations, resendInvitation } = useTeam();
  
  // Fetch pending invitations when the modal opens
  useEffect(() => {
    if (isOpen && projectId) {
      fetchPendingInvitations(projectId);
    }
  }, [isOpen, projectId, fetchPendingInvitations]);
  
  if (!isOpen) return null;
  
  const handleSubmitInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail && inviteRole) {
      onAddMember(inviteEmail, inviteRole, invitePermission);
      setInviteEmail('');
      setInviteRole('');
      setInvitePermission('editor');
      setActiveTab('members');
    }
  };

  // Handle resending an invitation
  const handleResendInvitation = async (invitationId: string) => {
    await resendInvitation(invitationId);
  };
  
  // Get pending invitations for this project
  const projectInvitations = pendingInvitations[projectId] || [];
  
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Team Management</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className={styles.modalTabs}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'members' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('members')}
          >
            <i className="fas fa-users"></i> Team Members
            {projectInvitations && projectInvitations.length > 0 && (
              <span className={styles.invitationBadge}>{projectInvitations.length}</span>
            )}
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'invite' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('invite')}
          >
            <i className="fas fa-user-plus"></i> Invite New Members
          </button>
        </div>
        
        <div className={styles.modalBody}>
          {activeTab === 'members' ? (
            <>
              <div className={styles.membersList}>
                <table className={styles.membersTable}>
                  <thead>
                    <tr>
                      <th className={styles.nameColumn}>Name</th>
                      <th>Role</th>
                      <th>Permission</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentMembers.map(member => (
                      <tr key={member.id} className={styles.memberRow}>
                        <td className={styles.nameCell}>
                          <div className={styles.memberAvatar}>
                            {member.avatar ? (
                              <img src={member.avatar} alt={member.name} />
                            ) : (
                              <span>{member.name.charAt(0)}</span>
                            )}
                            <div className={`${styles.statusDot} ${styles[member.status]}`}></div>
                          </div>
                          <div className={styles.memberInfo}>
                            <div className={styles.memberName}>{member.name}</div>
                          </div>
                        </td>
                        <td>
                          {editingMemberId === member.id ? (
                            <input 
                              id={`member-role-${member.id}`}
                              name={`member-role-${member.id}`}
                              type="text" 
                              value={member.role}
                              onChange={(e) => onUpdateMember(member.id, { role: e.target.value })}
                              className={styles.editInput}
                            />
                          ) : (
                            member.role
                          )}
                        </td>
                        <td>
                          {editingMemberId === member.id ? (
                            <select 
                              value={member.permission}
                              onChange={(e) => onUpdateMember(member.id, { 
                                permission: e.target.value as 'admin' | 'editor' | 'viewer' 
                              })}
                              className={styles.selectInput}
                            >
                              {PERMISSIONS.map(perm => (
                                <option key={perm.id} value={perm.id}>{perm.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`${styles.permissionBadge} ${styles[member.permission]}`}>
                              {member.permission.charAt(0).toUpperCase() + member.permission.slice(1)}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${styles[member.status]}`}>
                            {member.status}
                          </span>
                        </td>
                        <td className={styles.actionsCell}>
                          {editingMemberId === member.id ? (
                            <>
                              <button 
                                className={styles.iconButton}
                                onClick={() => setEditingMemberId(null)}
                                title="Save changes"
                              >
                                <i className="fas fa-check"></i>
                              </button>
                              <button 
                                className={`${styles.iconButton} ${styles.cancelButton}`}
                                onClick={() => setEditingMemberId(null)}
                                title="Cancel editing"
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                className={styles.iconButton} 
                                onClick={() => setEditingMemberId(member.id)}
                                title="Edit member"
                              >
                                <i className="fas fa-pencil-alt"></i>
                              </button>
                              <button 
                                className={`${styles.iconButton} ${styles.removeButton}`}
                                onClick={() => onRemoveMember(member.id)}
                                title="Remove member"
                              >
                                <i className="fas fa-trash-alt"></i>
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Display pending invitations section */}
              <div className={styles.pendingInvitationsContainer}>
                <PendingInvitations projectId={projectId} />
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmitInvite} className={styles.inviteForm}>
              <div className={styles.formGroup}>
                <label htmlFor="email">Email Address</label>
                <input 
                  id="email"
                  type="email" 
                  placeholder="Enter email address to invite"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className={styles.formInput}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="role">Role</label>
                <input 
                  id="role"
                  type="text" 
                  placeholder="e.g., Architect, Designer, Project Manager"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  required
                  className={styles.formInput}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="permission">Permission Level</label>
                <div className={styles.permissionsContainer}>
                  {PERMISSIONS.map(permission => (
                    <div 
                      key={permission.id}
                      className={`${styles.permissionOption} ${invitePermission === permission.id ? styles.selectedPermission : ''}`}
                      onClick={() => setInvitePermission(permission.id as 'admin' | 'editor' | 'viewer')}
                    >
                      <div className={styles.permissionHeader}>
                        <input 
                          type="radio"
                          id={`permission-${permission.id}`}
                          name="permission"
                          checked={invitePermission === permission.id}
                          onChange={() => {}}
                        />
                        <label htmlFor={`permission-${permission.id}`}>{permission.name}</label>
                      </div>
                      <p className={styles.permissionDescription}>{permission.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className={styles.formActions}>
                <button type="button" className={styles.secondaryButton} onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryButton}>
                  <i className="fas fa-paper-plane"></i> Send Invitation
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
