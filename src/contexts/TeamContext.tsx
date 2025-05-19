"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

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
  isTeamManagementModalOpen: boolean;
  openTeamManagementModal: (projectId: string) => void;
  closeTeamManagementModal: () => void;
  currentProjectId: string | null;
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

  const inviteMember = (projectId: string, email: string, role: string, permission: 'admin' | 'editor' | 'viewer') => {
    // In a real app, this would send an email invitation
    // For demo purposes, we'll just add a fake user
    const newMember: TeamMember = {
      id: `user-${Date.now()}`,
      name: email.split('@')[0],
      email,
      avatar: '', // No avatar for new users
      role,
      status: 'offline',
      permission
    };
    
    setProjectMembers(prev => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), newMember]
    }));
    
    // Notify about the new member
    addNotification(
      'success',
      'Team member invited',
      `An invitation has been sent to ${email} to join as ${role}.`
    );
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
  
  const value = {
    projectMembers,
    onlineUsers,
    inviteMember,
    updateMember,
    removeMember,
    isTeamManagementModalOpen,
    openTeamManagementModal,
    closeTeamManagementModal,
    currentProjectId
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
