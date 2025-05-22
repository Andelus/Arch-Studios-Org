"use client";

import { useState, useEffect, useCallback } from 'react';
import { fetchProjectMembersWithProfiles } from '@/utils/db-helpers';
import { supabase } from '@/lib/supabase';

export interface MemberProfile {
  id: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
}

export interface ProjectMemberWithProfile {
  id: string;
  project_id: string;
  user_id: string;
  email?: string;
  role: string;
  permission: string;
  status: string;
  created_at: string;
  updated_at?: string;
  profile?: MemberProfile;
}

export function useMembersWithProfiles(projectId?: string) {
  const [members, setMembers] = useState<ProjectMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const loadMembers = useCallback(async () => {
    if (!projectId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const projectMembers = await fetchProjectMembersWithProfiles(projectId);
      setMembers(projectMembers);
      setError(null);
    } catch (err) {
      console.error('Error loading project members with profiles:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  
  useEffect(() => {
    loadMembers();
    
    // Set up real-time subscription for project member changes
    let memberSubscription: { unsubscribe: () => void } | null = null;
    
    if (projectId) {
      memberSubscription = supabase
        .channel(`members-${projectId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'project_members',
          filter: `project_id=eq.${projectId}`
        }, () => {
          loadMembers();
        })
        .subscribe();
    }
    
    return () => {
      memberSubscription?.unsubscribe();
    };
  }, [projectId, loadMembers]);
  
  return { members, loading, error, refresh: loadMembers };
}
