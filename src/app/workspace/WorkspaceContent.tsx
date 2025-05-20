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
                  className={`${styles.projectOption} ${selectedProject?.id === project.id ? styles.activeProject : ''}`}
                >
                  <div 
                    className={styles.projectOptionContent}
                    onClick={() => {
                      setSelectedProject(project);
                      setShowProjectDropdown(false);
                    }}
                  >
                    <span className={styles.projectName}>{project.name}</span>
                    <span className={`${styles.projectStatus} ${styles[project.status.toLowerCase().replace(' ', '')]}`}>
                      {project.status}
                    </span>
                  </div>
                  {isUserAdmin(project.id) && (
                    <button 
                      className={styles.projectDeleteButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
                          handleDeleteProject(project.id);
                        }
                      }}
                      title="Delete Project"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  )}
                </div>
              ))}
              {/* Only show New Project button to admins */}
              {isUserAdmin() && (
                <div 
                  className={styles.addProject}
                  onClick={() => {
                    setIsProjectModalOpen(true);
                    setShowProjectDropdown(false);
                  }}
                >
                  <i className="fas fa-plus"></i>
                  <span>New Project</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Project Summary */}
        {selectedProject && (
          <div className={styles.projectSummary}>
            <div className={styles.projectHeader}>
              <h2>{selectedProject.name}</h2>
              <div className={styles.projectActions}>
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
                <button 
                  className={styles.primaryButton}
                  onClick={openTaskModal}
                >
                  <i className="fas fa-plus"></i> Add Task
                </button>
                {isUserAdmin(selectedProject.id) && (
                  <button 
                    className={styles.dangerButton}
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete "${selectedProject.name}"?`)) {
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
            </div>

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

        {/* View Toggle */}
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
              <button 
                className={styles.primaryButton}
                onClick={() => {
                  // The upload modal is managed in AssetManager, so we need to trigger it there
                  // We'll dispatch a custom event to open it
                  document.dispatchEvent(new Event('triggerAssetUpload'));
                }}
              >
                <i className="fas fa-upload"></i> Upload Asset
              </button>
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
        onClose={() => setIsProjectModalOpen(false)}
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
            members: user ? [{
              id: user.id,
              name: `${user.firstName} ${user.lastName}`, 
              avatar: user.imageUrl || '',
              role: 'Project Manager',
              status: 'online'
            }] : []
          };
          
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
          
          // Initialize workspace context for the new project
          initializeProject(projectId);
          
          // Show success notification
          addNotification(
            'success',
            'Project Created',
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
