"use client";

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import Link from 'next/link';
import { useNotifications } from '@/hooks/useNotifications';
import { useTeam } from '@/contexts/TeamContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useCommunication } from '@/hooks/useCommunication';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@clerk/nextjs';
import { useOrganization } from '@clerk/nextjs';
import AssetManager from '@/components/AssetManager';
import CommunicationPanel from '@/components/CommunicationPanel';
import ProjectCreationModal from '@/components/ProjectCreationModal';
import TaskCreationModal from '@/components/TaskCreationModal';
import TeamManagementModal from '@/components/TeamManagementModal';
import type { 
  Project, 
  Task, 
  ProjectMember, 
  OrganizationSubscription,
  DatabaseProject,
  DatabaseTask,
  DatabaseProjectMember
} from '@/types/workspace';
import styles from './WorkspaceContent.module.css';

interface WorkspaceContextValue {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  selectedProject: Project | null;
  setSelectedProject: React.Dispatch<React.SetStateAction<Project | null>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  loading: boolean;
}

const WorkspaceDataContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function useWorkspaceData() {
  const ctx = useContext(WorkspaceDataContext);
  if (!ctx) throw new Error('useWorkspaceData must be used within WorkspaceDataProvider');
  return ctx;
}

export default function WorkspaceContent() {
  const { notifications, addNotification, markAsRead, markAllAsRead, dismissNotification } = useNotifications();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const router = useRouter();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [activeTab, setActiveTab] = useState<'tasks' | 'assets' | 'communication'>('tasks');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);
  const [createAsFolder, setCreateAsFolder] = useState(false);
  const [createAsTemplate, setCreateAsTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [filterTitle, setFilterTitle] = useState<string>('');
  
  // Load projects from database
  useEffect(() => {
    const loadProjects = async () => {
      if (!isSignedIn || !organization) return;

      try {
        const { data: projectsData, error } = await supabase
          .from('projects')
          .select(`
            *,
            project_members(
              user_id,
              role,
              permission,
              status,
              profiles(
                email,
                avatar_url,
                display_name
              )
            )
          `)
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const formattedProjects: Project[] = projectsData.map((proj: any) => ({
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
          members: proj.project_members.map((member: any) => {
            let displayName = 'Unknown';
            let avatarUrl = '/avatars/default.jpg';
            if (Array.isArray(member.profiles) && member.profiles.length > 0) {
              displayName = member.profiles[0].display_name || 'Unknown';
              avatarUrl = member.profiles[0].avatar_url || '/avatars/default.jpg';
            }
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
      } catch (error) {
        console.error('Error loading projects:', error);
        addNotification(
          'error',
          'Failed to load projects',
          'There was an error loading your projects. Please try again.'
        );
      }
    };

    loadProjects();

    // Set up real-time subscription for projects
    const projectsSubscription = (supabase
      .channel('projects-channel') as any)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `organization_id=eq.${organization?.id}`
      }, (payload: any) => {
        loadProjects();
      })
      .subscribe();

    return () => {
      projectsSubscription.unsubscribe();
    };
  }, [isSignedIn, organization, addNotification, selectedProject]);

  // Load initial data when component mounts
  useEffect(() => {
    if (isLoaded) {
      setLoading(false);
      // Organization and projects are loaded in their own effects
    }
  }, [isLoaded]);

  // Ensure useNotifications is declared before any use
  const { 
    projectMembers, 
    onlineUsers, 
    inviteMember, 
    updateMember, 
    removeMember,
    isTeamManagementModalOpen,
    openTeamManagementModal,
    closeTeamManagementModal,
    currentProjectId,
    setTeamMembers
  } = useTeam();

  const {
    projectAssets,
    uploadAsset,
    deleteAsset,
    editAsset,
    approveAsset,
    rejectAsset,
    requestChanges
  } = useWorkspace();

  // Communication state
  const projectCommunication = useCommunication(selectedProject?.id);

  // Communication handlers
  const handleSendMessage = async (content: string, channelId: string) => {
    try {
      await projectCommunication.sendMessage(content);
      addNotification(
        'success',
        'Message Sent',
        'Your message has been sent successfully.'
      );
    } catch (error) {
      console.error('Error sending message:', error);
      addNotification(
        'error',
        'Failed to Send Message',
        'There was an error sending your message. Please try again.'
      );
    }
  };

  const handleCreateChannel = async (name: string, isPrivate: boolean, description?: string) => {
    try {
      await projectCommunication.createChannel({ name, isPrivate, description });
      addNotification(
        'success',
        'Channel Created',
        `The channel "${name}" has been created successfully.`
      );
    } catch (error) {
      console.error('Error creating channel:', error);
      addNotification(
        'error',
        'Failed to Create Channel',
        'There was an error creating the channel. Please try again.'
      );
    }
  };

  // Function to calculate project progress based on task completion
  const calculateProjectProgress = useCallback((projectId: string): number => {
    const projectTasks = tasks.filter(task => task.projectId === projectId);
    if (projectTasks.length === 0) return 0;
    
    const completedTasks = projectTasks.filter(task => task.status === 'Done');
    return Math.round((completedTasks.length / projectTasks.length) * 100);
  }, [tasks]);

  // Update project progress whenever tasks change
  const updateProjectProgress = useCallback(async (projectId: string) => {
    const progress = calculateProjectProgress(projectId);
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          progress, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', projectId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating project progress:', error);
    }
  }, [calculateProjectProgress]);

  // Function to view all projects created from a specific template
  const viewTemplateUsage = (templateId: string) => {
    const template = projects.find(p => p.id === templateId);
    if (!template) return;
    
    const fromTemplateProjects = projects.filter(p => 
      p.createdFromTemplate?.templateId === templateId
    );
    
    setFilteredProjects(fromTemplateProjects);
    setActiveFilter('template-usage');
    setFilterTitle(`Projects using "${template.name}" template`);
    
    // Show notification about how many projects were found
    addNotification(
      'info',
      'Template Usage',
      `Found ${fromTemplateProjects.length} project${fromTemplateProjects.length !== 1 ? 's' : ''} created from this template.`
    );
  };
  
  // Reset filtered projects and clear filters
  const clearFilters = () => {
    setFilteredProjects([]);
    setActiveFilter('');
    setFilterTitle('');
    
    addNotification(
      'info',
      'Filters Cleared',
      'Showing all projects.'
    );
  };
  
  // Function to generate unique IDs for projects and other entities
  const generateId = (prefix: string) => {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  };

  // Function to check if the current user has admin privileges
  const isUserAdmin = (projectId?: string): boolean => {
    // If no user is signed in, they're not an admin
    if (!user || !isSignedIn) return false;
    
    // If checking for general permissions (no specific project)
    if (!projectId) {
      // Check if the user is an admin in any project
      return Object.values(projectMembers).some(members => 
        members.some(member => 
          member.id === user.id && member.permission === 'admin'
        )
      );
    }
    
    // Check if the user is an admin in this specific project
    const members = projectMembers[projectId];
    if (!members) return false;
    
    return members.some(member => 
      member.id === user.id && member.permission === 'admin'
    );
  };

  // Task Management Functions
  const handleCreateTask = async (taskData: {
    title: string;
    description: string;
    status: 'To Do' | 'In Progress' | 'Done';
    assignee?: string;
    dueDate?: string;
    priority: 'Low' | 'Medium' | 'High';
  }) => {
    if (!selectedProject || !user) return;
    
    try {
      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert({
          project_id: selectedProject.id,
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
      
      setIsTaskModalOpen(false);
      
      addNotification(
        'success',
        'Task Created',
        `"${taskData.title}" has been added to the project.`
      );
    } catch (error) {
      console.error('Error creating task:', error);
      addNotification(
        'error',
        'Failed to create task',
        'There was an error creating the task. Please try again.'
      );
    }
  };
  
  const handleEditTask = (taskId: string) => {
    const taskToEdit = tasks.find((task: Task) => task.id === taskId);
    if (taskToEdit) {
      setTaskToEdit(taskToEdit);
      setIsTaskModalOpen(true);
    }
  };
  
  const handleUpdateTask = async (taskData: {
    title: string;
    description: string;
    status: 'To Do' | 'In Progress' | 'Done';
    assignee?: string;
    dueDate?: string;
    priority: 'Low' | 'Medium' | 'High';
  }) => {
    if (!taskToEdit) return;
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          assignee_id: taskData.assignee,
          due_date: taskData.dueDate,
          priority: taskData.priority,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskToEdit.id);

      if (error) throw error;
      
      setIsTaskModalOpen(false);
      setTaskToEdit(undefined);
      
      addNotification(
        'success',
        'Task Updated',
        `"${taskData.title}" has been updated.`
      );
    } catch (error) {
      console.error('Error updating task:', error);
      addNotification(
        'error',
        'Failed to update task',
        'There was an error updating the task. Please try again.'
      );
    }
  };
  
  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      
      addNotification(
        'info',
        'Task Deleted',
        'The task has been removed from the project.'
      );
    } catch (error) {
      console.error('Error deleting task:', error);
      addNotification(
        'error',
        'Failed to delete task',
        'There was an error deleting the task. Please try again.'
      );
    }
  };
  
  const handleDeleteProject = async (projectId: string) => {
    if (!isUserAdmin(projectId)) {
      addNotification(
        'error',
        'Permission Denied',
        'You need admin privileges to delete projects.'
      );
      return;
    }

    const projectToDelete = projects.find(p => p.id === projectId);
    if (!projectToDelete) return;

    const confirmMessage = projectToDelete.isTemplate
      ? `Are you sure you want to delete the template "${projectToDelete.name}"?`
      : projectToDelete.isFolder
      ? `Are you sure you want to delete the folder "${projectToDelete.name}"?`
      : `Are you sure you want to delete "${projectToDelete.name}"?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      // Delete project and related tasks (RLS policies will handle permissions)
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

      addNotification(
        'info',
        'Project Deleted',
        `"${projectToDelete.name}" has been deleted.`
      );
    } catch (error) {
      console.error('Error deleting project:', error);
      addNotification(
        'error',
        'Failed to delete project',
        'There was an error deleting the project. Please try again.'
      );
    }
  };
  
  const openTaskModal = () => {
    setTaskToEdit(undefined);
    setIsTaskModalOpen(true);
  };
  
  // Initialize a new project with organization context
  const initializeProject = async (projectData: {
    name: string;
    description: string;
    status: 'Planning' | 'In Progress' | 'Review' | 'Completed';
    isFolder?: boolean;
    isTemplate?: boolean;
    parentId?: string;
    templateId?: string;
  }) => {
    if (!user || !organization) {
      addNotification(
        'error',
        'Organization Required',
        'You need to be part of an organization to create projects.'
      );
      return;
    }

    try {
      // First ensure organization has trial or subscription
      const { data: orgSubData, error: orgSubError } = await supabase
        .from('organization_subscriptions')
        .select('id, status, trial_credits')
        .eq('organization_id', organization.id)
        .eq('status', 'active')
        .maybeSingle();

      if (orgSubError) throw orgSubError;

      if (!orgSubData) {
        const { data: newTrial, error: trialError } = await supabase
          .from('organization_subscriptions')
          .insert({
            organization_id: organization.id,
            trial_credits: 1000,
            is_trial: true,
            status: 'active'
          })
          .select()
          .single();

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
      const { data: channels, error: channelsError } = await supabase
        .rpc('create_default_project_channels', {
          p_project_id: newProject.id,
          p_organization_id: organization.id
        });

      if (channelsError) {
        console.error('Error creating default channels:', channelsError);
      }

      setIsProjectModalOpen(false);
      
      addNotification(
        'success',
        'Project Created',
        `"${projectData.name}" has been created successfully.`
      );

      // Select the new project
      const newProjectData: Project = {
        id: newProject.id,
        name: newProject.name,
        description: newProject.description,
        status: newProject.status,
        lastUpdated: newProject.updated_at,
        progress: 0,
        isFolder: newProject.is_folder,
        isTemplate: newProject.is_template,
        parentId: newProject.parent_id,
        organization_id: organization.id,
        createdFromTemplate: newProject.created_from_template,
        members: [{
          id: user.id,
          name: user.fullName || 'Unknown',
          avatar: user.imageUrl || '/avatars/default.jpg',
          role: 'Project Admin',
          status: 'online',
          permission: 'admin'
        }]
      };
      
      setSelectedProject(newProjectData);

    } catch (error) {
      console.error('Error creating project:', error);
      addNotification(
        'error',
        'Failed to create project',
        'There was an error creating the project. Please try again.'
      );
    }
  };

  // Set up real-time communication
  useEffect(() => {
    if (!selectedProject || !user) return;

    // Subscribe to project updates
    const projectChannel = (supabase
      .channel(`project-${selectedProject.id}`) as any)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${selectedProject.id}`
        },
        (payload: { new: DatabaseProject }) => {
          // Update project data when changes occur
          const updatedData = payload.new;                  setSelectedProject((prev: Project | null) => prev ? {
            ...prev,
            name: updatedData.name,
            description: updatedData.description,
            status: updatedData.status,
            lastUpdated: updatedData.updated_at,
            progress: updatedData.progress
          } : prev);
        }
      )
      .subscribe();

    // Subscribe to task updates
    const taskChannel = (supabase
      .channel(`tasks-${selectedProject?.id}`) as any)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `project_id=eq.${selectedProject?.id}`
      }, async (payload: any) => {
        if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(task => task.id !== payload.old.id));
        } else {
          // Fetch full task data including user info
          const { data } = await supabase
            .from('tasks')
            .select(`
              *,
              profiles(
                email,
                display_name,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            const formattedTask: Task = {
              id: data.id,
              title: data.title,
              description: data.description,
              status: data.status,
              assignee: data.profiles?.display_name,
              dueDate: data.due_date,
              priority: data.priority,
              projectId: data.project_id
            };

            setTasks((prev: Task[]) => {
              const index = prev.findIndex((t: Task) => t.id === data.id);
              if (index >= 0) {
                const newTasks = [...prev];
                newTasks[index] = formattedTask;
                return newTasks;
              }
              return [...prev, formattedTask];
            });
          }
        }
      })
      .subscribe();

    // Subscribe to team member updates
    const memberChannel = (supabase
      .channel(`members-${selectedProject?.id}`) as any)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_members',
        filter: `project_id=eq.${selectedProject?.id}`
      }, async (payload: any) => {
        if (payload.eventType === 'DELETE') {
          setSelectedProject(prev => prev ? {
            ...prev,
            members: prev.members.filter(m => m.id !== payload.old.user_id)
          } : prev);
        } else {
          const { data: memberData } = await supabase
            .from('project_members')
            .select(`
              *,
              profiles(
                email,
                display_name,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (memberData) {
            const member: ProjectMember = {
              id: memberData.user_id,
              name: memberData.profiles?.display_name || 'Unknown',
              avatar: memberData.profiles?.avatar_url || '/avatars/default.jpg',
              role: memberData.role,
              status: memberData.status,
              permission: memberData.permission
            };

            setSelectedProject((prev: Project | null) => prev ? {
              ...prev,
              members: prev.members.map((m: ProjectMember) => 
                m.id === member.id ? member : m
              ).concat(
                prev.members.some((m: ProjectMember) => m.id === member.id) ? [] : [member]
              )
            } : prev);
          }
        }
      })
      .subscribe();

    // Clean up subscriptions
    return () => {
      void projectChannel?.unsubscribe();
      void taskChannel?.unsubscribe();
      void memberChannel?.unsubscribe();
    };
  }, [selectedProject, user]);

  return (
    <WorkspaceDataContext.Provider value={{
      projects,
      setProjects,
      selectedProject,
      setSelectedProject,
      tasks,
      setTasks,
      loading
    }}>
      <div className={styles.workspaceContainer}>
        <aside className={styles.sidebar}>
          <div className={styles.projectControls}>
            <button
              className={styles.createButton}
              onClick={() => setIsProjectModalOpen(true)}
            >
              New Project
            </button>
            <button 
              className={styles.filterButton}
              onClick={clearFilters}
              disabled={!activeFilter}
            >
              {activeFilter ? 'Clear Filter' : 'Filter'}
            </button>
          </div>

          <div className={styles.projectList}>
            {(activeFilter ? filteredProjects : projects).map(project => (
              <div
                key={project.id}
                className={`${styles.projectItem} ${
                  selectedProject?.id === project.id ? styles.active : ''
                }`}
                onClick={() => setSelectedProject(project)}
              >
                <span className={styles.projectName}>{project.name}</span>
                {project.isTemplate && <span className={styles.templateBadge}>Template</span>}
                {project.isFolder && <span className={styles.folderBadge}>Folder</span>}
                <div className={styles.projectMeta}>
                  <span className={styles.status}>{project.status}</span>
                  <span className={styles.progress}>{project.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className={styles.mainContent}>
          {loading ? (
            <div className={styles.loading}>Loading workspace...</div>
          ) : selectedProject ? (
            <>
              <header className={styles.projectHeader}>
                <div className={styles.projectInfo}>
                  <h1>{selectedProject.name}</h1>
                  <p>{selectedProject.description}</p>
                </div>
                <div className={styles.projectActions}>
                  <div className={styles.viewControls}>
                    <button
                      className={`${styles.viewButton} ${viewMode === 'board' ? styles.active : ''}`}
                      onClick={() => setViewMode('board')}
                    >
                      Board
                    </button>
                    <button
                      className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
                      onClick={() => setViewMode('list')}
                    >
                      List
                    </button>
                  </div>
                  <div className={styles.tabControls}>
                    <button
                      className={`${styles.tabButton} ${activeTab === 'tasks' ? styles.active : ''}`}
                      onClick={() => setActiveTab('tasks')}
                    >
                      Tasks
                    </button>
                    <button
                      className={`${styles.tabButton} ${activeTab === 'assets' ? styles.active : ''}`}
                      onClick={() => setActiveTab('assets')}
                    >
                      Assets
                    </button>
                    <button
                      className={`${styles.tabButton} ${activeTab === 'communication' ? styles.active : ''}`}
                      onClick={() => setActiveTab('communication')}
                    >
                      Communication
                    </button>
                  </div>
                  {isUserAdmin(selectedProject.id) && (
                    <div className={styles.adminActions}>
                      <button
                        className={styles.teamButton}
                        onClick={() => openTeamManagementModal(selectedProject.id)}
                      >
                        Manage Team
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => handleDeleteProject(selectedProject.id)}
                      >
                        Delete Project
                      </button>
                    </div>
                  )}
                </div>
              </header>

              <div className={styles.projectContent}>
                {activeTab === 'tasks' && (
                  <div className={styles.tasksContainer}>
                    <button
                      className={styles.addTaskButton}
                      onClick={openTaskModal}
                    >
                      Add Task
                    </button>
                    
                    {viewMode === 'board' ? (
                      <div className={styles.taskBoard}>
                        <div className={styles.taskColumn}>
                          <h3>To Do</h3>
                          {tasks.filter(task => task.status === 'To Do').map(task => (
                            <div
                              key={task.id}
                              className={`${styles.taskCard} ${styles[task.priority.toLowerCase()]}`}
                              onClick={() => handleEditTask(task.id)}
                            >
                              <h4>{task.title}</h4>
                              <p>{task.description}</p>
                              {task.assignee && <span className={styles.assignee}>{task.assignee}</span>}
                              {task.dueDate && <span className={styles.dueDate}>{task.dueDate}</span>}
                              <button
                                className={styles.deleteTaskButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(task.id);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className={styles.taskColumn}>
                          <h3>In Progress</h3>
                          {tasks.filter(task => task.status === 'In Progress').map(task => (
                            <div
                              key={task.id}
                              className={`${styles.taskCard} ${styles[task.priority.toLowerCase()]}`}
                              onClick={() => handleEditTask(task.id)}
                            >
                              <h4>{task.title}</h4>
                              <p>{task.description}</p>
                              {task.assignee && <span className={styles.assignee}>{task.assignee}</span>}
                              {task.dueDate && <span className={styles.dueDate}>{task.dueDate}</span>}
                              <button
                                className={styles.deleteTaskButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(task.id);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className={styles.taskColumn}>
                          <h3>Done</h3>
                          {tasks.filter(task => task.status === 'Done').map(task => (
                            <div
                              key={task.id}
                              className={`${styles.taskCard} ${styles[task.priority.toLowerCase()]}`}
                              onClick={() => handleEditTask(task.id)}
                            >
                              <h4>{task.title}</h4>
                              <p>{task.description}</p>
                              {task.assignee && <span className={styles.assignee}>{task.assignee}</span>}
                              {task.dueDate && <span className={styles.dueDate}>{task.dueDate}</span>}
                              <button
                                className={styles.deleteTaskButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(task.id);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className={styles.taskList}>
                        {tasks.map(task => (
                          <div
                            key={task.id}
                            className={`${styles.taskRow} ${styles[task.priority.toLowerCase()]}`}
                            onClick={() => handleEditTask(task.id)}
                          >
                            <span className={styles.taskTitle}>{task.title}</span>
                            <span className={styles.taskStatus}>{task.status}</span>
                            {task.assignee && <span className={styles.taskAssignee}>{task.assignee}</span>}
                            {task.dueDate && <span className={styles.taskDueDate}>{task.dueDate}</span>}
                            <button
                              className={styles.deleteTaskButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTask(task.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'assets' && (
                  <div className={styles.assetsContainer}>
                    <AssetManager
                      assets={Object.values(projectAssets).flat()}
                      projectId={selectedProject.id}
                      onUpload={(file, description, tags, category) =>
                        uploadAsset(selectedProject.id, file, description, tags, category)
                      }
                      onDeleteAsset={(assetId) => deleteAsset(selectedProject.id, assetId)}
                      onEditAsset={(assetId, updates) => editAsset(selectedProject.id, assetId, updates)}
                      onApproveAsset={(assetId, comment) => approveAsset(selectedProject.id, assetId, comment)}
                      onRejectAsset={(assetId, comment) => rejectAsset(selectedProject.id, assetId, comment)}
                      onRequestChanges={(assetId, comment) => 
                        requestChanges(selectedProject.id, assetId, comment)
                      }
                    />
                  </div>
                )}

                {activeTab === 'communication' && (
                  <div className={styles.communicationContainer}>
                    <CommunicationPanel
                      projectId={selectedProject.id}
                      currentUserId={user?.id || ''}
                      messages={(projectCommunication?.messages || []).map(msg => ({
                        id: msg.id,
                        content: msg.content,
                        sender: {
                          id: msg.user_id,
                          name: msg.user?.name || 'Unknown',
                          avatar: msg.user?.avatar
                        },
                        timestamp: msg.created_at,
                        isAnnouncement: msg.is_announcement
                      }))}
                      channels={(projectCommunication?.channels || []).map(ch => ({
                        id: ch.id,
                        name: ch.name,
                        description: ch.description || undefined,
                        isPrivate: ch.is_private,
                        unreadCount: 0
                      }))}
                      onSendMessage={handleSendMessage}
                      onCreateChannel={handleCreateChannel}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.noProject}>
              <h2>No Project Selected</h2>
              <p>Select a project from the sidebar or create a new one to get started.</p>
            </div>
          )}
        </main>
      </div>

      {isProjectModalOpen && (
        <ProjectCreationModal
          isOpen={isProjectModalOpen}
          onClose={() => setIsProjectModalOpen(false)}
          onSubmit={initializeProject}
          createAsFolder={createAsFolder}
          createAsTemplate={createAsTemplate}
          isAdmin={isUserAdmin()}
          templates={projects.filter(p => p.isTemplate)}
        />
      )}

      {isTaskModalOpen && selectedProject && (
        <TaskCreationModal
          isOpen={isTaskModalOpen}
          projectId={selectedProject.id}
          onClose={() => {
            setIsTaskModalOpen(false);
            setTaskToEdit(undefined);
          }}
          onSubmit={handleCreateTask}
          onUpdate={handleUpdateTask}
          taskToEdit={taskToEdit}
          projectMembers={selectedProject.members}
        />
      )}

      {isTeamManagementModalOpen && selectedProject && (
        <TeamManagementModal
          isOpen={isTeamManagementModalOpen}
          onClose={closeTeamManagementModal}
          projectId={selectedProject.id}
          currentMembers={selectedProject.members.map(member => ({
            ...member,
            permission: member.permission || 'viewer' // Set a default permission if undefined
          }))}
          onAddMember={(email, role, permission) => 
            inviteMember(selectedProject.id, email, role, permission)
          }
          onUpdateMember={(memberId, updates) => 
            updateMember(selectedProject.id, memberId, updates)
          }
          onRemoveMember={(memberId) => 
            removeMember(selectedProject.id, memberId)
          }
        />
      )}
    </WorkspaceDataContext.Provider>
  );
}