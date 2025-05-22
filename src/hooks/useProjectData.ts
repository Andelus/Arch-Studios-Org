import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@clerk/nextjs';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import { useProjectRealtime } from './useProjectRealtime';
import { Project, Task, ProjectMember } from '@/types/workspace';

export function useProjectData() {
  const { organization } = useOrganization();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Load projects from database
  const loadProjects = useCallback(async () => {
    if (!organization?.id || !user) return;

    try {
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          description,
          status,
          updated_at,
          due_date,
          progress,
          is_folder,
          parent_id,
          is_template,
          created_from_template,
          organization_id,
          project_members(
            id,
            user_id,
            role,
            permission,
            status,
            email,
            role,
            sender_name,
            sender_email
          )
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedProjects: Project[] = projectsData.map(proj => ({
        id: proj.id,
        name: proj.name,
        description: proj.description,
        status: proj.status,
        lastUpdated: proj.updated_at,
        dueDate: proj.due_date,
        progress: proj.progress,
        isFolder: proj.is_folder,
        parentId: proj.parent_id,
        isTemplate: proj.is_template,
        createdFromTemplate: proj.created_from_template,
        organization_id: proj.organization_id,
        members: proj.project_members.map(member => {
          // Use sender_name if available, else email as display name or default
          const displayName = member.sender_name || (member.sender_email || member.email)?.split('@')[0] || 'Unknown';
          const avatarUrl = '/avatars/default.jpg'; // Use default avatar
          
          return {
            id: member.user_id,
            name: displayName,
            avatar: avatarUrl,
            role: member.role,
            status: member.status,
            permission: member.permission
          };
        })
      }));

      setProjects(formattedProjects);
      
      // Select first project by default if none selected
      if (!selectedProject && formattedProjects.length > 0) {
        setSelectedProject(formattedProjects[0]);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading projects:', error);
      setLoading(false);
    }
  }, [organization?.id, user, selectedProject]);

  // Load tasks for a specific project
  const loadTasks = useCallback(async (projectId: string) => {
    if (!projectId) return;

    try {
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          status,
          assignee_id,
          due_date,
          priority,
          project_id,
          profiles(
            email,
            display_name,
            avatar_url
          )
        `)
        .eq('project_id', projectId);

      if (error) throw error;

      const formattedTasks: Task[] = tasksData.map(task => {
        let displayName = undefined;
        let avatarUrl = undefined;
        if (Array.isArray(task.profiles) && task.profiles.length > 0) {
          displayName = task.profiles[0].display_name;
          avatarUrl = task.profiles[0].avatar_url;
        }
        return {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          assignee: displayName,
          dueDate: task.due_date,
          priority: task.priority,
          projectId: task.project_id
        };
      });

      setTasks(formattedTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load tasks when a project is selected
  useEffect(() => {
    if (selectedProject) {
      loadTasks(selectedProject.id);
    } else {
      setTasks([]);
    }
  }, [selectedProject, loadTasks]);

  // Set up real-time updates for the selected project
  useProjectRealtime({
    projectId: selectedProject?.id,
    userId: user?.id,
    onProjectUpdate: (projectUpdate) => {
      setSelectedProject(prev => prev ? { ...prev, ...projectUpdate } : null);
      
      // Also update in the projects list
      if (projectUpdate && selectedProject) {
        setProjects(prev => 
          prev.map(p => p.id === selectedProject.id ? { ...p, ...projectUpdate } : p)
        );
      }
    },
    onTasksUpdate: (updatedTasks) => {
      setTasks(updatedTasks);
    },
    onMembersUpdate: (updatedMembers) => {
      setSelectedProject(prev => prev ? { ...prev, members: updatedMembers } : null);
      
      // Also update in the projects list
      if (selectedProject) {
        setProjects(prev => 
          prev.map(p => p.id === selectedProject.id ? { ...p, members: updatedMembers } : p)
        );
      }
    }
  });

  // Create a new project
  const createProject = async (projectData: {
    name: string;
    description: string;
    status: 'Planning' | 'In Progress' | 'Review' | 'Completed';
    isFolder?: boolean;
    isTemplate?: boolean;
    parentId?: string;
    templateId?: string;
  }) => {
    if (!user || !organization?.id) {
      throw new Error('User or organization not available');
    }

    try {
      // Ensure organization has a trial subscription
      const { data: orgSubData, error: orgSubError } = await supabase
        .from('organization_subscriptions')
        .select('id, status, trial_credits')
        .eq('organization_id', organization.id)
        .eq('status', 'active')
        .maybeSingle();

      if (orgSubError) throw orgSubError;

      if (!orgSubData) {
        const { error: trialError } = await supabase
          .from('organization_subscriptions')
          .insert({
            organization_id: organization.id,
            trial_credits: 1000,
            is_trial: true,
            status: 'active'
          });

        if (trialError) throw trialError;
      }

      // Create the project
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectData.name,
          description: projectData.description,
          status: projectData.status,
          is_folder: projectData.isFolder || false,
          is_template: projectData.isTemplate || false,
          parent_id: projectData.parentId,
          organization_id: organization.id,
          created_from_template: projectData.templateId ? {
            templateId: projectData.templateId,
            createdAt: new Date().toISOString()
          } : null,
          progress: 0
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Add current user as admin
      const { error: memberError } = await supabase
        .from('project_members')
        .insert({
          project_id: newProject.id,
          user_id: user.id,
          email: user.emailAddresses[0].emailAddress,
          role: 'Project Admin',
          permission: 'admin',
          status: 'online'
        });

      if (memberError) throw memberError;

      // Initialize default channels
      await supabase.rpc('create_default_project_channels', {
        p_project_id: newProject.id,
        p_organization_id: organization.id
      });

      // Reload projects to include the new one
      await loadProjects();
      
      return newProject;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  };

  // Delete a project
  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      // If currently viewing the deleted project, select another
      if (selectedProject?.id === projectId) {
        const remainingProjects = projects.filter(p => p.id !== projectId);
        setSelectedProject(remainingProjects.length > 0 ? remainingProjects[0] : null);
      }

      // Update projects list
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  };

  // Create a new task
  const createTask = async (taskData: {
    title: string;
    description: string;
    status: 'To Do' | 'In Progress' | 'Done';
    assignee?: string;
    dueDate?: string;
    priority: 'Low' | 'Medium' | 'High';
    projectId: string;
  }) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert({
          project_id: taskData.projectId,
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          assignee_id: taskData.assignee,
          due_date: taskData.dueDate,
          priority: taskData.priority,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      
      // Tasks will be updated via real-time subscription
      return newTask;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  };

  // Update a task
  const updateTask = async (taskId: string, taskData: {
    title?: string;
    description?: string;
    status?: 'To Do' | 'In Progress' | 'Done';
    assignee?: string;
    dueDate?: string;
    priority?: 'Low' | 'Medium' | 'High';
  }) => {
    try {
      const { data: updatedTask, error } = await supabase
        .from('tasks')
        .update({
          ...taskData,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      
      // Tasks will be updated via real-time subscription
      return updatedTask;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  };

  // Delete a task
  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      
      // Tasks will be updated via real-time subscription
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  };

  return {
    loading,
    projects,
    selectedProject,
    setSelectedProject,
    tasks,
    createProject,
    deleteProject,
    createTask,
    updateTask,
    deleteTask,
    loadProjects
  };
}
