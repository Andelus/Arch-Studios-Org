export interface Project {
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
  organization_id?: string;
  members: ProjectMember[];
}

export interface ProjectMember {
  id: string;
  name: string;
  avatar: string;
  role: string;
  status: 'online' | 'offline' | 'away';
  permission?: 'admin' | 'editor' | 'viewer';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'To Do' | 'In Progress' | 'Done';
  assignee?: string;
  dueDate?: string;
  priority: 'Low' | 'Medium' | 'High';
  projectId: string;
}

export interface OrganizationSubscription {
  id: string;
  organization_id: string;
  trial_credits: number;
  is_trial: boolean;
  status: 'active' | 'cancelled' | 'expired';
  current_period_start?: string;
  current_period_end?: string;
}

// Database types for real-time updates
export interface DatabaseProject {
  id: string;
  name: string;
  description: string;
  status: 'Planning' | 'In Progress' | 'Review' | 'Completed';
  updated_at: string;
  due_date?: string;
  progress: number;
  is_folder: boolean;
  parent_id?: string;
  is_template: boolean;
  created_from_template?: {
    templateId: string;
    createdAt: string;
  };
  organization_id: string;
}

export interface DatabaseTask {
  id: string;
  title: string;
  description: string;
  status: 'To Do' | 'In Progress' | 'Done';
  assignee_id?: string;
  due_date?: string;
  priority: 'Low' | 'Medium' | 'High';
  project_id: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    email: string;
    display_name: string;
    avatar_url: string;
  };
}

export interface DatabaseProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  permission: 'admin' | 'editor' | 'viewer';
  status: 'online' | 'offline' | 'away';
  profiles?: {
    email: string;
    display_name: string;
    avatar_url: string;
  };
}
