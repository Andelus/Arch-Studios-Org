"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./Workspace.module.css";
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useTeam } from "@/contexts/TeamContext";
import type { TeamMember } from "@/contexts/TeamContext";
import TeamManagementModal from "@/components/TeamManagementModal";
import { useNotifications } from "@/hooks/useNotifications";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";
import ProjectCreationModal from "@/components/ProjectCreationModal";
import TaskCreationModal from "@/components/TaskCreationModal";
import { AssetManagerIntegration } from "./AssetManagerIntegration";
import { CommunicationPanelIntegration } from "./CommunicationPanelIntegration";

// Types
interface Project {
  id: string;
  name: string;
  description: string;
  status: 'Planning' | 'In Progress' | 'Review' | 'Completed';
  lastUpdated: string;
  dueDate?: string;
  progress: number;
  isFolder?: boolean;
  parentId?: string;
  isTemplate?: boolean;
  createdFromTemplate?: {
    templateId: string;
    templateName: string;
    createdAt: string;
  };
  members: {
    id: string;
    name: string;
    avatar: string;
    role: string;
    status: 'online' | 'offline' | 'away';
  }[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'To Do' | 'In Progress' | 'Done';
  assignee?: string;
  dueDate?: string;
  priority: 'Low' | 'Medium' | 'High';
  projectId: string;
}

// Sample data for development
const SAMPLE_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Modern Office Building',
    description: 'A 12-story glass-fronted office complex for downtown area',
    status: 'In Progress',
    lastUpdated: '2025-05-15T10:30:00Z',
    dueDate: '2025-08-10T00:00:00Z',
    progress: 65,
    members: [
      { id: 'user-1', name: 'Alex Johnson', avatar: '/avatars/alex.jpg', role: 'Lead Architect', status: 'online' },
      { id: 'user-2', name: 'Maria Garcia', avatar: '/avatars/maria.jpg', role: 'Interior Designer', status: 'offline' },
      { id: 'user-3', name: 'Sam Patel', avatar: '/avatars/sam.jpg', role: '3D Modeler', status: 'online' }
    ]
  },
  {
    id: 'proj-2',
    name: 'Lakeside Residence',
    description: 'Luxury waterfront home with sustainable features',
    status: 'Planning',
    lastUpdated: '2025-05-18T09:15:00Z',
    dueDate: '2025-09-20T00:00:00Z',
    progress: 20,
    members: [
      { id: 'user-1', name: 'Alex Johnson', avatar: '/avatars/alex.jpg', role: 'Project Manager', status: 'online' },
      { id: 'user-4', name: 'Emma Wilson', avatar: '/avatars/emma.jpg', role: 'Landscape Designer', status: 'away' }
    ]
  }
];

const SAMPLE_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Finalize facade design',
    description: 'Complete the exterior facade with client-requested revisions',
    status: 'In Progress',
    assignee: 'Alex Johnson',
    dueDate: '2025-05-25T00:00:00Z',
    priority: 'High',
    projectId: 'proj-1'
  },
  {
    id: 'task-2',
    title: 'Interior lighting plan',
    description: 'Create lighting design for main lobby and meeting rooms',
    status: 'To Do',
    assignee: 'Maria Garcia',
    dueDate: '2025-06-05T00:00:00Z',
    priority: 'Medium',
    projectId: 'proj-1'
  },
  {
    id: 'task-3',
    title: '3D model for client presentation',
    description: 'Prepare rendered views of the building exterior and key interior spaces',
    status: 'To Do',
    assignee: 'Sam Patel',
    dueDate: '2025-06-10T00:00:00Z',
    priority: 'Medium',
    projectId: 'proj-1'
  },
  {
    id: 'task-4',
    title: 'Site analysis',
    description: 'Complete environmental assessment and topographic study of the site',
    status: 'Done',
    assignee: 'Emma Wilson',
    dueDate: '2025-05-10T00:00:00Z',
    priority: 'High',
    projectId: 'proj-2'
  }
];

export default function WorkspaceContent() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>(SAMPLE_PROJECTS);
  const [tasks, setTasks] = useState<Task[]>(SAMPLE_TASKS);
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
  
  // Calculate project progress based on task completion
  const calculateProjectProgress = (projectId: string): number => {
    const projectTasks = tasks.filter(task => task.projectId === projectId);
    if (projectTasks.length === 0) return 0;
    
    const completedTasks = projectTasks.filter(task => task.status === 'Done');
    return Math.round((completedTasks.length / projectTasks.length) * 100);
  };

  // Update project progress whenever tasks change
  const updateProjectProgress = (projectId: string) => {
    const progress = calculateProjectProgress(projectId);
    
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
    setProjects(prev => prev.map(project => 
      project.id === projectId ? { 
        ...project, 
        progress, 
        lastUpdated: new Date().toISOString() 
      } : project
    ));
  };
  
  const { notifications, addNotification, markAsRead, markAllAsRead, dismissNotification } = useNotifications();
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
    initializeProject,
    projectAssets,
    uploadAsset,
    deleteAsset,
    editAsset,
    approveAsset,
    rejectAsset,
    requestChanges
  } = useWorkspace();

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
  const handleCreateTask = (taskData: {
    title: string;
    description: string;
    status: 'To Do' | 'In Progress' | 'Done';
    assignee?: string;
    dueDate?: string;
    priority: 'Low' | 'Medium' | 'High';
  }) => {
    if (!selectedProject) return;
    
    const newTask: Task = {
      id: generateId('task'),
      ...taskData,
      projectId: selectedProject.id
    };
    
    setTasks(prev => [...prev, newTask]);
    setIsTaskModalOpen(false);
    
    // Update project progress after adding a new task
    updateProjectProgress(selectedProject.id);
    
    // Show success notification
    addNotification(
      'success',
      'Task Created',
      `"${taskData.title}" has been added to the project.`
    );
  };
  
  const handleEditTask = (taskId: string) => {
    const taskToEdit = tasks.find((task: Task) => task.id === taskId);
    if (taskToEdit) {
      setTaskToEdit(taskToEdit);
      setIsTaskModalOpen(true);
    }
  };
  
  const handleUpdateTask = (taskData: {
    title: string;
    description: string;
    status: 'To Do' | 'In Progress' | 'Done';
    assignee?: string;
    dueDate?: string;
    priority: 'Low' | 'Medium' | 'High';
  }) => {
    if (!taskToEdit) return;
    
    const updatedTask: Task = {
      ...taskToEdit,
      ...taskData
    };
    
    setTasks(prev => prev.map((task: Task) => 
      task.id === taskToEdit.id ? updatedTask : task
    ));
    
    setIsTaskModalOpen(false);
    setTaskToEdit(undefined);
    
    // Update project progress after updating a task
    updateProjectProgress(updatedTask.projectId);
    
    // Show success notification
    addNotification(
      'success',
      'Task Updated',
      `"${taskData.title}" has been updated.`
    );
  };
  
  const handleDeleteTask = (taskId: string) => {
    const taskToDelete = tasks.find((task: Task) => task.id === taskId);
    if (!taskToDelete) return;
    
    // Store the projectId before removing the task
    const projectId = taskToDelete.projectId;
    
    setTasks(prev => prev.filter((task: Task) => task.id !== taskId));
    
    // Update project progress after deleting a task
    updateProjectProgress(projectId);
    
    // Show notification
    addNotification(
      'info',
      'Task Deleted',
      `"${taskToDelete.title}" has been removed from the project.`
    );
  };
  
  const handleDeleteProject = (projectId: string) => {
    // Find project to delete
    const projectToDelete = projects.find((project: Project) => project.id === projectId);
    if (!projectToDelete) return;
    
    // Check if user is admin
    if (!isUserAdmin(projectId)) {
      addNotification(
        'error',
        'Permission Denied',
        'You need admin privileges to delete projects.'
      );
      return;
    }
    
    // Determine item type and provide appropriate confirmation message
    let confirmMessage = `Are you sure you want to delete "${projectToDelete.name}"?`;
    
    if (projectToDelete.isTemplate) {
      confirmMessage = `Are you sure you want to delete the template "${projectToDelete.name}"? This will no longer be available for creating new projects.`;
    } else if (projectToDelete.isFolder) {
      // For folders, warn about potential child projects
      const childProjects = projects.filter(p => p.parentId === projectId);
      if (childProjects.length > 0) {
        confirmMessage = `Are you sure you want to delete the folder "${projectToDelete.name}"? This will also delete ${childProjects.length} contained project(s).`;
      } else {
        confirmMessage = `Are you sure you want to delete the empty folder "${projectToDelete.name}"?`;
      }
    }
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    // If deleting a folder, also delete all child projects
    if (projectToDelete.isFolder) {
      // Get all direct child projects
      const childProjectIds = projects
        .filter(p => p.parentId === projectId)
        .map(p => p.id);
      
      // Remove all child projects
      setProjects(prev => prev.filter(p => !childProjectIds.includes(p.id)));
      
      // Also remove any tasks associated with child projects
      setTasks(prev => prev.filter(task => !childProjectIds.includes(task.projectId)));
    }
    
    // Remove the project
    setProjects(prev => prev.filter((project: Project) => project.id !== projectId));
    
    // If currently viewing the deleted project, set to null or another project
    if (selectedProject && selectedProject.id === projectId) {
      const remainingProjects = projects.filter(p => p.id !== projectId);
      if (remainingProjects.length > 0) {
        setSelectedProject(remainingProjects[0]);
      } else {
        setSelectedProject(null);
      }
    }
    
    // Remove associated tasks
    setTasks(prev => prev.filter(task => task.projectId !== projectId));
    
    // Show notification
    addNotification(
      'info',
      'Project Deleted',
      `"${projectToDelete.name}" has been deleted.`
    );
  };
  
  const openTaskModal = () => {
    setTaskToEdit(undefined); // Reset any previous task
    setIsTaskModalOpen(true);
  };

  // Function was duplicated, removed duplicate
  
  // Drag and drop state and handlers
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  
  const handleDragStart = (project: Project, e?: React.DragEvent<HTMLDivElement>) => {
    // Only allow dragging projects (not folders or templates)
    if (!project.isFolder && !project.isTemplate) {
      setDraggedProject(project);
      // Add visual feedback for dragged element
      const dragIcon = document.createElement('div');
      dragIcon.className = styles.dragIcon;
      dragIcon.innerHTML = `<i class="fas fa-project-diagram"></i> ${project.name}`;
      document.body.appendChild(dragIcon);
      dragIcon.style.display = 'none';
    }
  };
  
  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    // Only allow dropping into folders (not projects or templates)
    const folder = projects.find(p => p.id === folderId);
    if (folder?.isFolder && draggedProject && draggedProject.id !== folderId) {
      setDragOverFolderId(folderId);
      // Add class to folder icon for visual feedback
      const folderElement = e.currentTarget as HTMLElement;
      folderElement.classList.add(styles.dropTarget);
    }
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
    // Remove visual feedback class
    const folderElement = e.currentTarget as HTMLElement;
    folderElement.classList.remove(styles.dropTarget);
  };
  
  const handleDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    if (draggedProject && folderId !== draggedProject.id) {
      const targetFolder = projects.find(p => p.id === folderId);
      if (targetFolder?.isFolder) {
        // Move project to the folder
        setProjects(prev => 
          prev.map(p => 
            p.id === draggedProject.id 
              ? { ...p, parentId: folderId } 
              : p
          )
        );
        
        // Show success notification
        addNotification(
          'success',
          'Project Moved',
          `"${draggedProject.name}" has been moved to the "${targetFolder.name}" folder.`
        );
      }
    }
    
    // Remove visual feedback class
    const folderElement = e.currentTarget as HTMLElement;
    folderElement.classList.remove(styles.dropTarget);
    
    // Reset drag state
    setDraggedProject(null);
    setDragOverFolderId(null);
  };
  
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
  
  useEffect(() => {
    if (isLoaded) {
      setLoading(false);
      // Select the first project by default when loaded
      if (projects.length > 0 && !selectedProject) {
        setSelectedProject(projects[0]);
      }
    }
  }, [isLoaded, projects, selectedProject]);

  // Add a function to simulate realtime updates
  useEffect(() => {
    // Simulate realtime activity with random notifications
    const events = [
      {
        type: 'info' as const,
        title: 'Document Updated',
        message: 'Floor plan drawings have been updated by Maria Garcia.'
      },
      {
        type: 'success' as const,
        title: 'Task Completed',
        message: 'Sam Patel completed the 3D model for the main lobby.'
      },
      {
        type: 'warning' as const,
        title: 'Approaching Deadline',
        message: 'The interior design plans are due in 3 days.'
      }
    ];

    const notificationTimer = setTimeout(() => {
      if (Math.random() > 0.7) { // 30% chance of notification
        const event = events[Math.floor(Math.random() * events.length)];
        addNotification(event.type, event.title, event.message);
      }
    }, 45000); // After 45 seconds on the page

    return () => clearTimeout(notificationTimer);
  }, [addNotification]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <i className="fas fa-circle-notch fa-spin"></i>
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.message}>
          Please sign in to access your workspace
        </div>
      </div>
    );
  }

  const filteredTasks = selectedProject 
    ? tasks.filter(task => task.projectId === selectedProject.id)
    : [];

  const tasksByStatus = {
    'To Do': filteredTasks.filter(task => task.status === 'To Do'),
    'In Progress': filteredTasks.filter(task => task.status === 'In Progress'),
    'Done': filteredTasks.filter(task => task.status === 'Done')
  };

  return (
    <div className={styles.workspaceContainer}>
      <div className={styles.header}>
        <div className={styles.logoSection}>
          <span className={styles.logoText}>Arch Studios</span>
          <span className={styles.indie}>indie</span>
        </div>
        <div className={styles.navButtons}>
          <Link href="/dashboard" className={styles.backButton}>
            <i className="fas fa-arrow-left"></i>
          </Link>
          <div className={styles.divider}>|</div>
          <span className={styles.title}>Workspace</span>
        </div>
        <div className={styles.userSection}>
          {user && <span className={styles.userName}>{user.firstName} {user.lastName}</span>}
        </div>
      </div>

      <div className={styles.workspaceContent}>
        {/* Project Selector */}
        <div className={styles.projectSelector}>
          <div 
            className={styles.selectedProject}
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
          >
            <i className="fas fa-folder-open"></i>
            <span>{selectedProject?.name || "Select a project"}</span>
            <i className={`fas fa-chevron-${showProjectDropdown ? 'up' : 'down'}`}></i>
          </div>
          {showProjectDropdown && (
            <div className={styles.projectDropdown}>
              {projects.map(project => (
                <div
                  key={project.id}
                  className={`${styles.projectOption} ${selectedProject?.id === project.id ? styles.activeProject : ''} ${project.isFolder ? styles.folderItem : ''} ${project.isTemplate ? styles.templateItem : ''}`}
                >
                  <div 
                    className={styles.projectOptionContent}
                    onClick={() => {
                      setSelectedProject(project);
                      setShowProjectDropdown(false);
                    }}
                    draggable
                    onDragStart={(e) => handleDragStart(project, e)}
                  >
                    <div className={styles.projectIconName}>
                      {project.isFolder ? (
                        <i className="fas fa-folder" 
                           style={{
                             color: '#ffc107',
                             background: dragOverFolderId === project.id ? 'rgba(255, 193, 7, 0.15)' : 'transparent',
                             padding: '3px',
                             borderRadius: '4px',
                             transform: dragOverFolderId === project.id ? 'scale(1.1)' : 'scale(1)',
                             transition: 'all 0.2s ease'
                           }} 
                           onDragOver={(e) => handleDragOver(e, project.id)}
                           onDragLeave={handleDragLeave}
                           onDrop={(e) => handleDrop(e, project.id)}
                           data-is-folder="true"
                        ></i>
                      ) : project.isTemplate ? (
                        <i className="fas fa-copy" style={{color: '#ff9a9e'}}></i>
                      ) : (
                        <i className="fas fa-project-diagram" style={{color: '#4facfe'}}></i>
                      )}
                      <span className={styles.projectName}>
                        {project.name}
                        {project.isFolder && <span className={styles.itemTypeLabel}> (Folder)</span>}
                        {project.isTemplate && <span className={styles.itemTypeLabel}> (Template)</span>}
                      </span>
                    </div>
                    {!project.isFolder && !project.isTemplate && (
                      <span className={`${styles.projectStatus} ${styles[project.status.toLowerCase().replace(' ', '')]}`}>
                        {project.status}
                      </span>
                    )}
                    {project.isTemplate && (
                      <span className={styles.templateBadge}>Template</span>
                    )}
                  </div>
                  {isUserAdmin(project.id) && (
                    <div className={styles.projectActions}>
                      {project.isTemplate && (
                        <button 
                          className={styles.projectActionButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTemplate(project.id);
                            setIsProjectModalOpen(true);
                            setShowProjectDropdown(false);
                          }}
                          title="Use Template"
                        >
                          <i className="fas fa-plus"></i>
                        </button>
                      )}
                      <button 
                        className={styles.projectDeleteButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Determine item type for appropriate confirmation message
                          let confirmMessage = `Are you sure you want to delete "${project.name}"?`;
                          
                          if (project.isTemplate) {
                            confirmMessage = `Are you sure you want to delete the template "${project.name}"? This template will no longer be available for creating new projects.`;
                          } else if (project.isFolder) {
                            // For folders, warn about potential child projects
                            const childProjects = projects.filter(p => p.parentId === project.id);
                            if (childProjects.length > 0) {
                              confirmMessage = `Are you sure you want to delete the folder "${project.name}"? This will also delete ${childProjects.length} contained project(s).`;
                            } else {
                              confirmMessage = `Are you sure you want to delete the empty folder "${project.name}"?`;
                            }
                          }
                          
                          if (window.confirm(confirmMessage)) {
                            handleDeleteProject(project.id);
                          }
                        }}
                        title={`Delete ${project.isTemplate ? 'Template' : project.isFolder ? 'Folder' : 'Project'}`}
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {/* Show creation options to admins */}
              {isUserAdmin() && (
                <div className={styles.createOptions}>
                  <div 
                    className={styles.addProject}
                    onClick={() => {
                      setIsProjectModalOpen(true);
                      setShowProjectDropdown(false);
                      // Reset any template selection
                      setSelectedTemplate(null);
                    }}
                  >
                    <i className="fas fa-plus"></i>
                    <span>New Project</span>
                  </div>
                  <div 
                    className={styles.addFolder}
                    onClick={() => {
                      // Pre-configure for folder creation
                      setCreateAsFolder(true);
                      setIsProjectModalOpen(true);
                      setShowProjectDropdown(false);
                    }}
                  >
                    <i className="fas fa-folder-plus"></i>
                    <span>New Folder</span>
                  </div>
                  <div 
                    className={styles.addTemplate}
                    onClick={() => {
                      // Pre-configure for template creation
                      setCreateAsTemplate(true);
                      setIsProjectModalOpen(true);
                      setShowProjectDropdown(false);
                    }}
                  >
                    <i className="fas fa-copy"></i>
                    <span>New Template</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filtered Projects Section - Shows when using template filter */}
        {activeFilter && filteredProjects.length > 0 && (
          <div className={styles.filteredProjectsSection}>
            <div className={styles.filterHeader}>
              <h3>{filterTitle}</h3>
              <button 
                className={styles.clearFilterButton}
                onClick={clearFilters}
              >
                <i className="fas fa-times"></i> Clear Filter
              </button>
            </div>
            <div className={styles.filteredProjectsList}>
              {filteredProjects.map(project => (
                <div 
                  key={project.id} 
                  className={`${styles.filteredProjectItem} ${project.isTemplate ? styles.templateItem : project.isFolder ? styles.folderItem : ''}`}
                  onClick={() => {
                    setSelectedProject(project);
                    // Don't clear filter to allow user to switch between filtered projects
                  }}
                >
                  <div className={styles.projectIconName}>
                    <i className="fas fa-project-diagram" style={{color: '#4facfe'}}></i>
                    <span className={styles.projectName}>
                      {project.name}
                    </span>
                  </div>
                  <span className={`${styles.projectStatus} ${styles[project.status.toLowerCase().replace(' ', '')]}`}>
                    {project.status}
                  </span>
                  <div className={styles.filteredProjectMeta}>
                    <span className={styles.filteredProjectDate}>
                      Created: {new Date(project.createdFromTemplate?.createdAt || project.lastUpdated).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Project Summary */}
        {selectedProject && (
          <div className={styles.projectSummary}>
            <div className={styles.projectHeader}>
              <h2>{selectedProject.name}</h2>
              <div className={styles.projectActions}>
                {/* Only show Team Management for regular projects */}
                {!selectedProject.isFolder && !selectedProject.isTemplate && (
                  <button 
                    className={styles.secondaryButton}
                    onClick={() => {
                      if (selectedProject) {
                        openTeamManagementModal(selectedProject.id);
                      }
                    }}
                  >
                    <i className="fas fa-user-plus"></i> Invite
                  </button>
                )}
                
                {/* Only show Add Task for regular projects */}
                {!selectedProject.isFolder && !selectedProject.isTemplate && (
                  <button 
                    className={styles.primaryButton}
                    onClick={openTaskModal}
                  >
                    <i className="fas fa-plus"></i> Add Task
                  </button>
                )}
                
                {/* For templates, add a "Use Template" button */}
                {selectedProject.isTemplate && (
                  <button 
                    className={styles.primaryButton}
                    onClick={() => {
                      setSelectedTemplate(selectedProject.id);
                      setIsProjectModalOpen(true);
                    }}
                  >
                    <i className="fas fa-plus"></i> Use Template
                  </button>
                )}
                {isUserAdmin(selectedProject.id) && (
                  <button 
                    className={styles.dangerButton}
                    onClick={() => {
                      // Create appropriate confirmation message based on type
                      let confirmMessage = `Are you sure you want to delete "${selectedProject.name}"?`;
                      
                      if (selectedProject.isTemplate) {
                        confirmMessage = `Are you sure you want to delete the template "${selectedProject.name}"? This will affect any future projects that would use it.`;
                      } else if (selectedProject.isFolder) {
                        // For folders, warn about potential child projects
                        const childProjects = projects.filter(p => p.parentId === selectedProject.id);
                        if (childProjects.length > 0) {
                          confirmMessage = `Are you sure you want to delete the folder "${selectedProject.name}"? This will also delete ${childProjects.length} contained project(s).`;
                        } else {
                          confirmMessage = `Are you sure you want to delete the empty folder "${selectedProject.name}"?`;
                        }
                      }
                      
                      if (window.confirm(confirmMessage)) {
                        handleDeleteProject(selectedProject.id);
                      }
                    }}
                  >
                    <i className="fas fa-trash-alt"></i> Delete
                  </button>
                )}
              </div>
            </div>
            <p className={styles.projectDescription}>{selectedProject.description}</p>
            
            {/* Display type-specific information */}
            {selectedProject.isFolder ? (
              <div className={styles.folderInfo}>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>Folder Type</div>
                  <div className={styles.metricValue}>
                    {projects.filter(p => p.parentId === selectedProject.id).length > 0 ? 'Contains Projects' : 'Empty Folder'}
                  </div>
                </div>
                
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>Created On</div>
                  <div className={styles.metricValue}>
                    {new Date(selectedProject.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
            ) : selectedProject.isTemplate ? (
              <div className={styles.templateInfo}>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>Template Type</div>
                  <div className={styles.metricValue}>
                    {selectedProject.status}
                  </div>
                </div>
                
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>Last Updated</div>
                  <div className={styles.metricValue}>
                    {new Date(selectedProject.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>Template Usage</div>
                  <div className={styles.metricValue}>
                    <button 
                      className={styles.templateUsageButton}
                      onClick={() => viewTemplateUsage(selectedProject.id)}
                    >
                      View projects using this template
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.projectMetrics}>
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>Progress</div>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${selectedProject.progress}%` }}></div>
                  </div>
                  <div className={styles.metricValue}>{selectedProject.progress}%</div>
                </div>
                
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>Due Date</div>
                  <div className={styles.metricValue}>
                    {selectedProject.dueDate 
                      ? new Date(selectedProject.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Not set'}
                  </div>
                </div>
                
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>Last Updated</div>
                  <div className={styles.metricValue}>
                    {new Date(selectedProject.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                
                {/* Show template information if project was created from a template */}
                {selectedProject.createdFromTemplate && (
                  <div className={styles.metricCard}>
                    <div className={styles.metricLabel}>Created From Template</div>
                    <div className={styles.metricValue}>
                      <span className={styles.templateReference}>
                        {selectedProject.createdFromTemplate.templateName}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={styles.teamMembers}>
              <div className={styles.teamMembersHeader}>
                <h3>Team Members</h3>
                <button 
                  className={styles.manageTeamButton}
                  onClick={() => selectedProject && openTeamManagementModal(selectedProject.id)}
                >
                  <i className="fas fa-user-cog"></i> Manage Team
                </button>
              </div>
              <div className={styles.membersList}>
                {selectedProject && projectMembers[selectedProject.id] ? 
                  projectMembers[selectedProject.id].map(member => (
                    <div key={member.id} className={styles.memberCard}>
                      <div className={styles.memberAvatar}>
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} />
                        ) : (
                          <span>{member.name.charAt(0)}</span>
                        )}
                        <div className={`${styles.statusIndicator} ${styles[member.status]}`}></div>
                      </div>
                      <div className={styles.memberInfo}>
                        <div className={styles.memberName}>
                          {member.name}
                          {onlineUsers.includes(member.id) && (
                            <span className={styles.onlineIndicator}></span>
                          )}
                        </div>
                        <div className={styles.memberRole}>
                          {member.role}
                          <span className={`${styles.permissionBadge} ${styles[member.permission]}`}>
                            {member.permission}
                          </span>
                        </div>
                      </div>
                    </div>
                  )) : 
                  selectedProject.members.map(member => (
                    <div key={member.id} className={styles.memberCard}>
                      <div className={styles.memberAvatar}>
                        <div className={`${styles.statusIndicator} ${styles[member.status]}`}></div>
                      </div>
                      <div className={styles.memberInfo}>
                        <div className={styles.memberName}>{member.name}</div>
                        <div className={styles.memberRole}>{member.role}</div>
                      </div>
                    </div>
                  ))
                }
                <div 
                  className={styles.addMember}
                  onClick={() => selectedProject && openTeamManagementModal(selectedProject.id)}
                >
                  <i className="fas fa-plus"></i>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Toggle - Only show for regular projects */}
        {selectedProject && !selectedProject.isFolder && !selectedProject.isTemplate && (
          <div className={styles.viewToggle}>
            {/* Tabs menu */}
            <div className={styles.tabsMenu}>
              <button 
                className={`${styles.tabButton} ${activeTab === 'tasks' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('tasks')}
              >
                <i className="fas fa-tasks"></i> Tasks
              </button>
              <button 
                className={`${styles.tabButton} ${activeTab === 'assets' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('assets')}
              >
                <i className="fas fa-file-alt"></i> Assets
              </button>
              <button 
                className={`${styles.tabButton} ${activeTab === 'communication' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('communication')}
              >
                <i className="fas fa-comments"></i> Communication
              </button>
            </div>
            
            {/* Only show view toggle if on tasks tab */}
            {activeTab === 'tasks' && (
              <div className={styles.viewTypeToggle}>
                <button 
                  className={`${styles.viewButton} ${viewMode === 'board' ? styles.activeView : ''}`}
                  onClick={() => setViewMode('board')}
                >
                  <i className="fas fa-columns"></i> Board View
                </button>
                <button 
                  className={`${styles.viewButton} ${viewMode === 'list' ? styles.activeView : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <i className="fas fa-list"></i> List View
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* For folders, show a list of contained projects instead */}
        {selectedProject && selectedProject.isFolder && (
          <div className={styles.folderContents}>
            <h3>Folder Contents</h3>
            <div className={styles.folderActions}>
              {isUserAdmin() && (
                <button 
                  className={styles.secondaryButton}
                  onClick={() => {
                    // Pre-configure for project creation with parent folder
                    setSelectedTemplate(null);
                    // Reset folder/template flags
                    setCreateAsFolder(false);
                    setCreateAsTemplate(false);
                    // Open modal with parent folder ID set
                    setIsProjectModalOpen(true);
                  }}
                >
                  <i className="fas fa-plus"></i> Add Project to Folder
                </button>
              )}
            </div>
            <div className={styles.folderProjectsList}>
              {projects.filter(p => p.parentId === selectedProject.id).length > 0 ? (
                projects.filter(p => p.parentId === selectedProject.id).map(childProject => (
                  <div 
                    key={childProject.id} 
                    className={`${styles.folderProjectItem} ${childProject.isTemplate ? styles.templateItem : childProject.isFolder ? styles.folderItem : ''}`}
                    onClick={() => setSelectedProject(childProject)}
                  >
                    <div className={styles.projectIconName}>
                      {childProject.isFolder ? (
                        <i className="fas fa-folder" style={{color: '#ffc107'}}></i>
                      ) : childProject.isTemplate ? (
                        <i className="fas fa-copy" style={{color: '#ff9a9e'}}></i>
                      ) : (
                        <i className="fas fa-project-diagram" style={{color: '#4facfe'}}></i>
                      )}
                      <span className={styles.projectName}>
                        {childProject.name}
                        {childProject.isFolder && <span className={styles.itemTypeLabel}> (Folder)</span>}
                        {childProject.isTemplate && <span className={styles.itemTypeLabel}> (Template)</span>}
                      </span>
                    </div>
                    {!childProject.isFolder && !childProject.isTemplate && (
                      <span className={`${styles.projectStatus} ${styles[childProject.status.toLowerCase().replace(' ', '')]}`}>
                        {childProject.status}
                      </span>
                    )}
                    {isUserAdmin(childProject.id) && (
                      <div className={styles.projectQuickActions}>
                        <button 
                          className={styles.projectDeleteButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(childProject.id);
                          }}
                          title={`Delete ${childProject.isTemplate ? 'Template' : childProject.isFolder ? 'Folder' : 'Project'}`}
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className={styles.emptyFolderMessage}>
                  <i className="fas fa-folder-open"></i>
                  <p>This folder is empty. Add projects to this folder by clicking the "Add Project to Folder" button above.</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* For templates, show template usage information */}
        {selectedProject && selectedProject.isTemplate && (
          <div className={styles.templateUsage}>
            <h3>Template Information</h3>
            <div className={styles.templateUsageInfo}>
              <div className={styles.templateDetails}>
                <div className={styles.templateIcon}>
                  <i className="fas fa-copy" style={{color: '#ff9a9e'}}></i>
                </div>
                <div className={styles.templateMetadata}>
                  <p className={styles.templateDescription}>This template can be used to create new projects with predefined settings and structure.</p>
                  <div className={styles.templateStats}>
                    <div className={styles.templateStat}>
                      <span className={styles.statLabel}>Type:</span>
                      <span className={styles.statValue}>{selectedProject.status}</span>
                    </div>
                    <div className={styles.templateStat}>
                      <span className={styles.statLabel}>Created:</span>
                      <span className={styles.statValue}>
                        {new Date(selectedProject.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <button 
                className={styles.primaryButton}
                onClick={() => {
                  setSelectedTemplate(selectedProject.id);
                  setIsProjectModalOpen(true);
                }}
              >
                <i className="fas fa-plus"></i> Create Project from Template
              </button>
            </div>
          </div>
        )}

        {/* Tabs navigation is handled in the viewToggle section above */}

        {/* Tasks Section */}
        {selectedProject && activeTab === 'tasks' && (
          <div className={styles.tasksSection}>
            {viewMode === 'board' ? (
              <div className={styles.boardView}>
                {/* Kanban Board Columns */}
                {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
                  <div key={status} className={styles.taskColumn}>
                    <div className={styles.columnHeader}>
                      <h3>{status}</h3>
                      <span className={styles.taskCount}>{statusTasks.length}</span>
                    </div>
                    
                    <div className={styles.columnContent}>
                      {statusTasks.map(task => (
                        <div key={task.id} className={styles.taskCard}>
                          <div className={`${styles.taskPriority} ${styles[task.priority.toLowerCase()]}`}></div>
                          <h4 className={styles.taskTitle}>{task.title}</h4>
                          <p className={styles.taskDescription}>{task.description}</p>
                          {task.dueDate && (
                            <div className={styles.taskDueDate}>
                              <i className="fas fa-calendar-alt"></i>
                              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          )}
                          {task.assignee && (
                            <div className={styles.taskAssignee}>
                              <div className={styles.assigneeAvatar}>
                                {task.assignee.charAt(0)}
                              </div>
                              <span>{task.assignee}</span>
                            </div>
                          )}
                          <div className={styles.taskActions}>
                            <button className={styles.iconButton} onClick={() => handleEditTask(task.id)}>
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className={styles.iconButton} onClick={() => handleDeleteTask(task.id)}>
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      <div className={styles.addTaskCard} onClick={openTaskModal}>
                        <i className="fas fa-plus"></i> Add Task
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.listView}>
                <table className={styles.tasksTable}>
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Assignee</th>
                      <th>Due Date</th>
                      <th>Priority</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(task => (
                      <tr key={task.id} className={styles.taskRow}>
                        <td>
                          <div className={styles.taskTitleCell}>
                            <h4>{task.title}</h4>
                            <p>{task.description}</p>
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${styles[task.status.toLowerCase().replace(' ', '')]}`}>
                            {task.status}
                          </span>
                        </td>
                        <td>
                          {task.assignee && (
                            <div className={styles.assigneeCell}>
                              <div className={styles.assigneeAvatar}>
                                {task.assignee.charAt(0)}
                              </div>
                              <span>{task.assignee}</span>
                            </div>
                          )}
                        </td>
                        <td>
                          {task.dueDate 
                            ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '-'}
                        </td>
                        <td>
                          <span className={`${styles.priorityBadge} ${styles[task.priority.toLowerCase()]}`}>
                            {task.priority}
                          </span>
                        </td>
                        <td>
                          <div className={styles.rowActions}>
                            <button className={styles.iconButton} onClick={() => handleEditTask(task.id)}>
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className={styles.iconButton} onClick={() => handleDeleteTask(task.id)}>
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div className={styles.addTaskRow}>
                  <button className={styles.primaryButton} onClick={openTaskModal}>
                    <i className="fas fa-plus"></i> Add Task
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Assets Manager Section */}
        {selectedProject && activeTab === 'assets' && (
          <div className={styles.assetsSection}>
            <div className={styles.sectionHeader}>
              <h3>Project Assets</h3>
              {/* Removed duplicate upload button as AssetManager has its own */}
            </div>
            <div className={styles.assetsContent}>
              <AssetManagerIntegration
                projectId={selectedProject.id}
                isAdmin={isUserAdmin(selectedProject.id)}
                notifications={{
                  addNotification
                }}
              />
            </div>
          </div>
        )}

        {/* Communication Panel Section */}
        {selectedProject && activeTab === 'communication' && (
          <div className={styles.communicationSection}>
            <div className={styles.sectionHeader}>
              <h3>Project Communication</h3>
              <button 
                className={styles.primaryButton}
                onClick={() => {
                  // Trigger the chat modal in CommunicationPanel
                  document.dispatchEvent(new Event('triggerChatOpen'));
                }}
              >
                <i className="fas fa-comment-alt"></i> New Message
              </button>
            </div>
            <div className={styles.communicationContent}>
              <CommunicationPanelIntegration 
                projectId={selectedProject.id}
                currentUserId={user?.id || ''}
                notifications={{
                  addNotification
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Team Management Modal */}
      {isTeamManagementModalOpen && currentProjectId && (
        <TeamManagementModal 
          isOpen={isTeamManagementModalOpen}
          onClose={closeTeamManagementModal}
          projectId={currentProjectId}
          members={projectMembers[currentProjectId] || []}
          onAddMember={(email, role, permission) => {
            inviteMember(currentProjectId, email, role, permission);
            addNotification(
              'success',
              'Team member invited',
              `${email} has been invited to join the project as ${role}.`
            );
          }}
          onUpdateMember={(memberId, updates) => {
            updateMember(currentProjectId, memberId, updates);
          }}
          onRemoveMember={(memberId) => {
            removeMember(currentProjectId, memberId);
          }}
        />
      )}

      {/* Project Creation Modal */}
      <ProjectCreationModal
        isOpen={isProjectModalOpen}
        createAsFolder={createAsFolder}
        createAsTemplate={createAsTemplate}
        parentFolderId={selectedProject?.isFolder ? selectedProject.id : undefined}
        onClose={() => {
          setIsProjectModalOpen(false);
          // Reset the flags when closing the modal
          setCreateAsFolder(false);
          setCreateAsTemplate(false);
        }}
        templates={projects.filter(p => p.isTemplate).map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          thumbnail: undefined
        }))}
        onCreateProject={(projectData) => {
          // Check admin permissions again as a security measure
          if (!isUserAdmin()) {
            addNotification(
              'error',
              'Permission Denied',
              'You need admin privileges to create new projects.'
            );
            return;
          }
          
          // Create a new project with unique ID
          const projectId = generateId('proj');
          const newProject: Project = {
            id: projectId,
            name: projectData.name,
            description: projectData.description,
            status: projectData.status,
            lastUpdated: new Date().toISOString(),
            dueDate: projectData.dueDate,
            progress: 0, // New projects start at 0% progress
            isFolder: projectData.isFolder,
            isTemplate: projectData.isTemplate || false,
            parentId: selectedProject?.isFolder ? selectedProject.id : undefined, // Set parent ID if creating in a folder
            members: user ? [{
              id: user.id,
              name: `${user.firstName} ${user.lastName}`, 
              avatar: user.imageUrl || '',
              role: 'Project Manager',
              status: 'online'
            }] : []
          };
          
          // If using a template, copy template data
          if (projectData.templateId) {
            const template = projects.find(p => p.id === projectData.templateId);
            if (template) {
              // Copy selected properties from the template, but keep user-entered name and description
              newProject.status = template.status;
              // Copy additional properties that would be useful from a template
              if (template.isTemplate) {
                // Preserve the structure and content but with the new project details
                newProject.progress = 0; // Reset progress
                // Don't copy members - already set above
                // Don't set isTemplate flag - this is a project based on a template, not a template itself
                
                // Add metadata to track template usage
                newProject.createdFromTemplate = {
                  templateId: template.id,
                  templateName: template.name,
                  createdAt: new Date().toISOString()
                };
              }
            }
          }
          
          // Add the new project to the projects list
          setProjects(prev => [...prev, newProject]);
          
          // Select the newly created project
          setSelectedProject(newProject);
          
          // Update team context with the new project's team members
          if (user) {
            setTeamMembers(projectId, [{
              id: user.id,
              name: `${user.firstName} ${user.lastName}`,
              email: user.emailAddresses?.[0]?.emailAddress || '',
              avatar: user.imageUrl || '',
              role: 'Project Manager',
              status: 'online',
              permission: 'admin' // Admin permission for project creator
            }]);
          }
          
          // Only initialize workspace if it's not a folder and not a template
          if (!projectData.isFolder && !projectData.isTemplate) {
            // Initialize workspace context for the new project
            // Use default organization ID since ProjectCreationModal doesn't provide one
            initializeProject(projectId, "default-org-id");
          }
          
          // Show success notification with appropriate message
          let notificationType = 'Project Created';
          if (projectData.isFolder) notificationType = 'Folder Created';
          if (projectData.isTemplate) notificationType = 'Template Created';
          
          addNotification(
            'success',
            notificationType,
            `${projectData.name} has been successfully created.`
          );
        }}
      />
      
      {/* Task Creation/Edit Modal */}
      {selectedProject && (
        <TaskCreationModal
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setTaskToEdit(undefined);
          }}
          onCreateTask={taskToEdit ? handleUpdateTask : handleCreateTask}
          projectId={selectedProject.id}
          projectMembers={projectMembers[selectedProject.id] || selectedProject.members.map(m => ({
            id: m.id,
            name: m.name,
            avatar: m.avatar,
            role: m.role,
            email: '',
            status: m.status as 'online' | 'offline' | 'away',
            permission: 'editor'
          }))}
          taskToEdit={taskToEdit}
        />
      )}
    </div>
  );
}
