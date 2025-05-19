"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { createInvitation } from '@/lib/invitation-service';
import { supabase } from '@/lib/supabase';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  status: 'online' | 'offline' | 'away';
  permission: 'admin' | 'editor' | 'viewer';
  lastActive?: string;
}

export interface TeamInvitation {
  id: string;
  project_id: string;
  email: string;
  role: string;
  permission: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  expires_at: string;
}

interface Project {
  id: string;
  name: string;
  members: TeamMember[];
}

interface TeamContextType {
  projectMembers: Record<string, TeamMember[]>;
  onlineUsers: string[];
  inviteMember: (projectId: string, email: string, role: string, permission: 'admin' | 'editor' | 'viewer') => void;
  updateMember: (projectId: string, memberId: string, updates: Partial<TeamMember>) => void;
  removeMember: (projectId: string, memberId: string) => void;
  setTeamMembers: (projectId: string, members: TeamMember[]) => void;
  isTeamManagementModalOpen: boolean;
  openTeamManagementModal: (projectId: string) => void;
  closeTeamManagementModal: () => void;
  currentProjectId: string | null;
  pendingInvitations: Record<string, TeamInvitation[]>;
  fetchPendingInvitations: (projectId: string) => Promise<void>;
  resendInvitation: (invitationId: string) => Promise<boolean>;
  checkUserNotifications: (userId: string, email: string) => Promise<void>;
  processAutomaticInvitations: (userId: string, email: string) => Promise<void>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

// Sample data for development
const SAMPLE_MEMBERS: Record<string, TeamMember[]> = {
  'proj-1': [
    { 
      id: 'user-1', 
      name: 'Alex Johnson', 
      email: 'alex@example.com',
      avatar: '/avatars/alex.jpg', 
      role: 'Lead Architect', 
      status: 'online',
      permission: 'admin'
    },
    { 
      id: 'user-2', 
      name: 'Maria Garcia', 
      email: 'maria@example.com',
      avatar: '/avatars/maria.jpg', 
      role: 'Interior Designer', 
      status: 'offline',
      permission: 'editor'
    },
    { 
      id: 'user-3', 
      name: 'Sam Patel', 
      email: 'sam@example.com',
      avatar: '/avatars/sam.jpg', 
      role: '3D Modeler', 
      status: 'online',
      permission: 'editor'
    }
  ],
  'proj-2': [
    { 
      id: 'user-1', 
      name: 'Alex Johnson', 
      email: 'alex@example.com',
      avatar: '/avatars/alex.jpg', 
      role: 'Project Manager', 
      status: 'online',
      permission: 'admin'
    },
    { 
      id: 'user-4', 
      name: 'Emma Wilson', 
      email: 'emma@example.com',
      avatar: '/avatars/emma.jpg', 
      role: 'Landscape Designer', 
      status: 'away',
      permission: 'editor'
    }
  ]
};

export const TeamProvider: React.FC<{
  children: React.ReactNode,
  initialProjectId?: string 
}> = ({ children, initialProjectId }) => {
  const [projectMembers, setProjectMembers] = useState<Record<string, TeamMember[]>>(SAMPLE_MEMBERS);
  const [onlineUsers, setOnlineUsers] = useState<string[]>(['user-1', 'user-3']);
  const [isTeamManagementModalOpen, setIsTeamManagementModalOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(initialProjectId || null);
  const [pendingInvitations, setPendingInvitations] = useState<Record<string, TeamInvitation[]>>({});
  const { addNotification } = useNotifications();

  // Simulate periodic status checks
  useEffect(() => {
    const statusInterval = setInterval(() => {
      // In a real app, this would check user statuses via an API
      // For demo purposes, we'll just randomly change a user's status occasionally
      const projectIds = Object.keys(projectMembers);
      if (projectIds.length === 0) return;

      const randomProjectId = projectIds[Math.floor(Math.random() * projectIds.length)];
      const members = projectMembers[randomProjectId];
      if (!members || members.length === 0) return;

      const randomMemberIndex = Math.floor(Math.random() * members.length);
      const randomMember = members[randomMemberIndex];
      
      // 10% chance of changing status
      if (Math.random() > 0.9) {
        const newStatus = ['online', 'offline', 'away'][Math.floor(Math.random() * 3)] as 'online' | 'offline' | 'away';
        
        if (randomMember.status !== newStatus) {
          const updatedMembers = [...members];
          updatedMembers[randomMemberIndex] = {
            ...randomMember,
            status: newStatus
          };
          
          setProjectMembers(prev => ({
            ...prev,
            [randomProjectId]: updatedMembers
          }));
          
          // Update online users list
          if (newStatus === 'online') {
            setOnlineUsers(prev => [...prev, randomMember.id]);
            // Notify if user comes online
            addNotification(
              'info',
              `${randomMember.name} is now online`,
              `${randomMember.name} (${randomMember.role}) has joined the workspace.`
            );
          } else if ((newStatus === 'offline' || newStatus === 'away') && onlineUsers.includes(randomMember.id)) {
            setOnlineUsers(prev => prev.filter(id => id !== randomMember.id));
          }
        }
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(statusInterval);
  }, [projectMembers, onlineUsers, addNotification]);

  const inviteMember = async (projectId: string, email: string, role: string, permission: 'admin' | 'editor' | 'viewer') => {
    try {
      // Get project name - in real implementation, this would come from API or state
      let projectName = projectId.startsWith('proj-') ? 
        `Arch Studios Project ${projectId.replace('proj-', '')}` : 
        'Architectural Project';
        
      const existingMembers = projectMembers[projectId] || [];
      
      // Check if email is already a member
      const existingMember = existingMembers.find(m => m.email === email);
      if (existingMember) {
        addNotification(
          'info',
          'Already a Member',
          `${email} is already a member of this project.`
        );
        return;
      }
      
      // Get the current user (inviter) from the first member with admin permission
      // In a real app, this would use the authenticated user from auth context
      const currentUserMember = existingMembers.find(m => m.permission === 'admin');
      
      if (!currentUserMember) {
        addNotification(
          'error',
          'Invitation Failed',
          'Only project admins can send invitations.'
        );
        return;
      }
      
      // Create the invitation using the invitation service
      const invitation = await createInvitation({
        projectId,
        projectName,
        email,
        role,
        permission,
        inviterId: currentUserMember.id,
        inviterName: currentUserMember.name
      });
      
      if (!invitation) {
        addNotification(
          'error',
          'Invitation Failed',
          'Could not send invitation. Please try again.'
        );
        return;
      }
      
      // Update pending invitations list
      setPendingInvitations(prev => ({
        ...prev,
        [projectId]: [...(prev[projectId] || []), invitation]
      }));
      
      // For UI purposes, show a pending member
      const pendingMember: TeamMember = {
        id: `pending-${invitation.id}`,
        name: email.split('@')[0],
        email,
        avatar: '',
        role,
        status: 'offline',
        permission,
        lastActive: new Date().toISOString()
      };
      
      // Update the UI
      setProjectMembers(prev => ({
        ...prev,
        [projectId]: [...(prev[projectId] || []), pendingMember]
      }));
      
      // Notify about the new member
      addNotification(
        'success',
        'Team member invited',
        `An invitation has been sent to ${email} to join as ${role}.`
      );
    } catch (error) {
      console.error('Failed to send invitation:', error);
      addNotification(
        'error',
        'Invitation Failed',
        'Could not send invitation. Please try again.'
      );
    }
  };
  
  const updateMember = (projectId: string, memberId: string, updates: Partial<TeamMember>) => {
    setProjectMembers(prev => {
      const projectMembers = prev[projectId] || [];
      return {
        ...prev,
        [projectId]: projectMembers.map(member => 
          member.id === memberId ? { ...member, ...updates } : member
        )
      };
    });
    
    // Notify about the update if role or permissions change
    if (updates.role || updates.permission) {
      const member = projectMembers[projectId]?.find(m => m.id === memberId);
      if (member) {
        addNotification(
          'info',
          'Team member updated',
          `${member.name}'s ${updates.role ? 'role' : 'permissions'} has been updated.`
        );
      }
    }
  };
  
  const removeMember = (projectId: string, memberId: string) => {
    const memberToRemove = projectMembers[projectId]?.find(m => m.id === memberId);
    
    setProjectMembers(prev => {
      const projectMembers = prev[projectId] || [];
      return {
        ...prev,
        [projectId]: projectMembers.filter(member => member.id !== memberId)
      };
    });
    
    // Update online users list
    setOnlineUsers(prev => prev.filter(id => id !== memberId));
    
    // Notify about the removal
    if (memberToRemove) {
      addNotification(
        'warning',
        'Team member removed',
        `${memberToRemove.name} has been removed from the project.`
      );
    }
  };
  
  const openTeamManagementModal = (projectId: string) => {
    setCurrentProjectId(projectId);
    setIsTeamManagementModalOpen(true);
  };
  
  const closeTeamManagementModal = () => {
    setIsTeamManagementModalOpen(false);
  };
  
  // Add setTeamMembers function to set team members for a project
  const setTeamMembers = (projectId: string, members: TeamMember[]) => {
    setProjectMembers(prev => ({
      ...prev,
      [projectId]: members
    }));
    
    // Update online users list for new members that are online
    const onlineMembers = members.filter(member => member.status === 'online').map(member => member.id);
    if (onlineMembers.length > 0) {
      setOnlineUsers(prev => [...prev, ...onlineMembers]);
    }
  };
  
  // Fetch pending invitations for a project
  const fetchPendingInvitations = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'pending');
      
      if (error) throw error;
      
      setPendingInvitations(prev => ({
        ...prev,
        [projectId]: data as TeamInvitation[]
      }));
    } catch (error) {
      console.error('Error fetching pending invitations:', error);
      addNotification(
        'error',
        'Failed to load invitations',
        'There was an error loading pending invitations.'
      );
    }
  };

  // Check for notifications including invitations when user logs in
  const checkUserNotifications = async (userId: string, email: string) => {
    try {
      // Check for notifications addressed by either user ID or email
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${userId},email.eq.${email}`)
        .eq('is_read', false)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }
      
      // Process team invitation notifications
      const teamInvitations = notifications?.filter(n => n.type === 'team_invitation');
      if (teamInvitations?.length) {
        // Add notifications for any pending invitations
        teamInvitations.forEach(invitation => {
          addNotification(
            'info',
            invitation.title,
            invitation.message,
            invitation.link
          );
        });
      }
      
      // Auto-process invitations if possible
      await processAutomaticInvitations(userId, email);
    } catch (error) {
      console.error('Failed to check user notifications:', error);
    }
  };
  
  // Try to automatically accept invitations for existing users
  const processAutomaticInvitations = async (userId: string, email: string) => {
    try {
      // Find all pending invitations for this user
      const { data: pendingInvites, error } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('email', email)
        .eq('status', 'pending');
        
      if (error || !pendingInvites?.length) {
        return;
      }
      
      // Process each invitation
      for (const invite of pendingInvites) {
        // Add the user directly to the project
        const { error: memberError } = await supabase
          .from('project_members')
          .insert({
            project_id: invite.project_id,
            user_id: userId,
            role: invite.role,
            permission: invite.permission,
            created_at: new Date().toISOString(),
            invited_by: invite.inviter_id
          });
          
        if (!memberError) {
          // Mark the invitation as accepted
          await supabase
            .from('team_invitations')
            .update({ status: 'accepted' })
            .eq('id', invite.id);
            
          // Fetch project info
          const { data: project } = await supabase
            .from('projects')
            .select('name')
            .eq('id', invite.project_id)
            .single();
          
          // Notify the user they've been added to the project
          addNotification(
            'success',
            `Added to ${project?.name || 'project'}`,
            `You've been added to the project as ${invite.role}.`,
            `/workspace/project/${invite.project_id}`
          );
        }
      }
    } catch (error) {
      console.error('Error processing automatic invitations:', error);
    }
  };
  
  // Resend an invitation
  const resendInvitation = async (invitationId: string): Promise<boolean> => {
    try {
      // Find the invitation
      let projectId = '';
      let invitation: TeamInvitation | undefined;
      
      Object.entries(pendingInvitations).forEach(([pId, invites]) => {
        const found = invites.find(inv => inv.id === invitationId);
        if (found) {
          projectId = pId;
          invitation = found;
        }
      });
      
      if (!invitation) {
        throw new Error('Invitation not found');
      }
      
      // Make API call to resend the invitation
      const response = await fetch('/api/invitations/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invitationId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to resend invitation');
      }
      
      // Update the expiration date in the UI (optimistically)
      const now = new Date();
      const newExpiresAt = new Date(now);
      newExpiresAt.setDate(now.getDate() + 7);
      
      setPendingInvitations(prev => ({
        ...prev,
        [projectId]: prev[projectId].map(inv => 
          inv.id === invitationId 
            ? { ...inv, expires_at: newExpiresAt.toISOString() } 
            : inv
        )
      }));
      
      addNotification(
        'success',
        'Invitation resent',
        `The invitation to ${invitation.email} has been resent successfully.`
      );
      
      return true;
    } catch (error) {
      console.error('Error resending invitation:', error);
      addNotification(
        'error',
        'Resend failed',
        'Failed to resend the invitation. Please try again.'
      );
      return false;
    }
  };
  
  const value = {
    projectMembers,
    onlineUsers,
    inviteMember,
    updateMember,
    removeMember,
    setTeamMembers,
    isTeamManagementModalOpen,
    openTeamManagementModal,
    closeTeamManagementModal,
    currentProjectId,
    pendingInvitations,
    fetchPendingInvitations,
    resendInvitation,
    checkUserNotifications,
    processAutomaticInvitations
  };
  
  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
};

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
};
