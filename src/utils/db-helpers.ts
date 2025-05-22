/**
 * Database helper utilities to work around relationship issues
 * between profiles and project_members tables
 */

import { supabase, getAuthenticatedClient } from '@/lib/supabase';

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

/**
 * Fetch project members with profiles via separate queries, to work around
 * potential relationship issues in the database
 * 
 * @param projectId The project ID to fetch members for
 * @returns An array of project members with profile data
 */
export async function fetchProjectMembersWithProfiles(projectId: string): Promise<ProjectMember[]> {
  try {
    const client = getAuthenticatedClient();
    
    // Step 1: Get all project members
    const { data: members, error: membersError } = await client
      .from('project_members')
      .select('*')
      .eq('project_id', projectId);
      
    if (membersError) throw membersError;
    if (!members || members.length === 0) return [];
    
    // Step 2: Get unique user IDs
    const userIds = [...new Set(members.map(member => member.user_id))];
    
    // Step 3: Fetch profiles separately
    const { data: profiles, error: profilesError } = await client
      .from('profiles')
      .select('id, email, display_name, avatar_url')
      .in('id', userIds);
      
    if (profilesError) {
      console.warn('Could not fetch profiles:', profilesError);
      // Return members without profiles
      return members;
    }
    
    // Step 4: Map profiles to members
    const profileMap = new Map<string, Profile>();
    profiles?.forEach(profile => {
      if (profile.id) profileMap.set(profile.id, profile);
    });
    
    // Step 5: Join the data manually
    return members.map(member => ({
      ...member,
      profile: profileMap.get(member.user_id) || {
        id: member.user_id,
        email: member.email,
        display_name: null,
        avatar_url: null
      }
    }));
  } catch (error) {
    console.error('Error fetching project members:', error);
    return [];
  }
}

/**
 * Fetch a user's project memberships with associated projects
 * 
 * @param userId The user ID
 * @returns Array of project memberships with project data
 */
export async function fetchUserProjectMemberships(userId: string): Promise<any[]> {
  try {
    const client = getAuthenticatedClient();
    
    // First try the proper join query
    try {
      const { data, error } = await client
        .from('project_members')
        .select(`
          *,
          projects:project_id (
            id,
            name,
            description,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId);
        
      if (!error && data?.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn('Join query failed, trying fallback method:', err);
    }
    
    // If that fails, use a two-step query approach
    const { data: memberships, error: membershipsError } = await client
      .from('project_members')
      .select('*')
      .eq('user_id', userId);
      
    if (membershipsError) throw membershipsError;
    if (!memberships || memberships.length === 0) return [];
    
    // Get project IDs
    const projectIds = [...new Set(memberships.map(m => m.project_id))];
    
    // Fetch projects separately
    const { data: projects, error: projectsError } = await client
      .from('projects')
      .select('*')
      .in('id', projectIds);
      
    if (projectsError) throw projectsError;
    if (!projects) return memberships; // Return memberships without projects
    
    // Map projects to memberships
    const projectMap = new Map();
    projects.forEach(project => {
      projectMap.set(project.id, project);
    });
    
    return memberships.map(membership => ({
      ...membership,
      projects: projectMap.get(membership.project_id)
    }));
  } catch (error) {
    console.error('Error fetching user project memberships:', error);
    return [];
  }
}
