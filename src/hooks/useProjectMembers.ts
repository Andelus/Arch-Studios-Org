"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseAuth } from './useSupabaseAuth';

interface Profile {
  id: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  [key: string]: any;
}

interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  email: string;
  role: string;
  permission: string;
  status: string;
  invited_by?: string;
  created_at: string;
  updated_at: string;
  last_active_at?: string;
  profile?: Profile;
  [key: string]: any;
}

export function useProjectMembers(projectId: string) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { getClient, isSignedIn } = useSupabaseAuth();
  
  const fetchMembers = useCallback(async () => {
    if (!projectId || !isSignedIn) {
      setMembers([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get authenticated client with fresh token
      const client = await getClient();
      
      // First try to get members with proper join
      try {
        const { data, error } = await client
          .from('project_members')
          .select(`
            *,
            profiles:user_id (
              id, 
              email, 
              display_name, 
              avatar_url
            )
          `)
          .eq('project_id', projectId);
          
        if (!error && data) {
          console.log('Successfully fetched members with join:', data.length);
          setMembers(data);
          setIsLoading(false);
          return;
        }
      } catch (joinError) {
        console.warn('Could not fetch members with join:', joinError);
      }
      
      // If join fails, use the manual approach
      console.log('Falling back to manual join approach');
      
      // Step 1: Get all project members
      const { data: membersData, error: membersError } = await client
        .from('project_members')
        .select('*')
        .eq('project_id', projectId);
        
      if (membersError) throw new Error(membersError.message);
      if (!membersData || membersData.length === 0) {
        setMembers([]);
        setIsLoading(false);
        return;
      }
      
      // Step 2: Get unique user IDs
      const userIds = [...new Set(membersData.map(member => member.user_id))];
      
      // Step 3: Fetch profiles separately
      const { data: profilesData, error: profilesError } = await client
        .from('profiles')
        .select('id, email, display_name, avatar_url')
        .in('id', userIds);
        
      if (profilesError) {
        console.warn('Could not fetch profiles:', profilesError);
        // Return members without profiles
        setMembers(membersData);
        setIsLoading(false);
        return;
      }
      
      // Step 4: Map profiles to members
      const profileMap = new Map<string, Profile>();
      profilesData?.forEach(profile => {
        if (profile.id) profileMap.set(profile.id, profile);
      });
      
      // Step 5: Join the data manually
      const membersWithProfiles = membersData.map(member => ({
        ...member,
        profile: profileMap.get(member.user_id) || {
          id: member.user_id,
          email: member.email,
          display_name: null,
          avatar_url: null
        }
      }));
      
      setMembers(membersWithProfiles);
      
    } catch (err) {
      console.error('Error fetching project members:', err);
      setError(err instanceof Error ? err.message : 'Unknown error fetching members');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, getClient, isSignedIn]);
  
  // Load members when component mounts or projectId changes
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);
  
  return {
    members,
    isLoading,
    error,
    reload: fetchMembers
  };
}
