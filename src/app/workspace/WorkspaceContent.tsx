"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./Workspace.module.css";
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useTeam } from "@/contexts/TeamContext";
import TeamManagementModal from "@/components/TeamManagementModal";
import NotificationCenter from "@/components/NotificationCenter";
import { useNotifications } from "@/hooks/useNotifications";
import AssetManager from "@/components/AssetManager";
import CommunicationPanel from "@/components/CommunicationPanel";
import { WorkspaceProvider, useWorkspace } from "@/contexts/WorkspaceContext";

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
    currentProjectId
  } = useTeam();

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
          <NotificationCenter 
            notifications={notifications}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onDismiss={dismissNotification}
          />
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
              ))}
              <div className={styles.addProject}>
                <i className="fas fa-plus"></i>
                <span>New Project</span>
              </div>
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
                  onClick={() => {
                    // In a real app, this would open a task creation modal
                    addNotification(
                      'info',
                      'Task Creation',
                      'Task creation functionality will be implemented in the next phase.'
                    );
                  }}
                >
                  <i className="fas fa-plus"></i> Add Task
                </button>
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

        {/* Tasks Section */}
        {selectedProject && (
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
                            <button className={styles.iconButton}>
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className={styles.iconButton}>
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      <div className={styles.addTaskCard}>
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
                            <button className={styles.iconButton}>
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className={styles.iconButton}>
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div className={styles.addTaskRow}>
                  <button className={styles.primaryButton}>
                    <i className="fas fa-plus"></i> Add Task
                  </button>
                </div>
              </div>
            )}
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
    </div>
  );
}
