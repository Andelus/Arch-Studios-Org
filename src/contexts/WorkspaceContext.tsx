"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

interface Asset {
  id: string;
  name: string;
  type: 'document' | 'image' | 'video' | 'model' | 'other';
  url: string;
  thumbnailUrl?: string;
  dateUploaded: string;
  uploadedBy: string;
  size: string;
  description?: string;
  tags: string[];
}

interface Message {
  id: string;
  content: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  timestamp: string;
  attachments?: {
    id: string;
    name: string;
    url: string;
    type: string;
  }[];
  isAnnouncement?: boolean;
}

interface Channel {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  unreadCount?: number;
}

interface WorkspaceContextType {
  // Asset Management
  projectAssets: Record<string, Asset[]>;
  uploadAsset: (
    projectId: string, 
    file: File, 
    description: string, 
    tags: string[]
  ) => Promise<void>;
  deleteAsset: (projectId: string, assetId: string) => void;
  editAsset: (projectId: string, assetId: string, updates: Partial<Asset>) => void;
  initializeProject: (projectId: string) => void;
  
  // Communication
  channels: Record<string, Channel[]>;
  messages: Record<string, Message[]>;
  sendMessage: (content: string, channelId: string, attachments?: File[]) => void;
  createChannel: (
    projectId: string,
    name: string, 
    isPrivate: boolean, 
    description?: string
  ) => void;
  
  // Active state
  activeView: 'project' | 'tasks' | 'assets' | 'communication';
  setActiveView: (view: 'project' | 'tasks' | 'assets' | 'communication') => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

// Sample data for development
const SAMPLE_ASSETS: Record<string, Asset[]> = {
  'proj-1': [
    {
      id: 'asset-1',
      name: 'Facade Design.pdf',
      type: 'document',
      url: '/assets/facade-design.pdf',
      dateUploaded: '2025-05-14T15:30:00Z',
      uploadedBy: 'Alex Johnson',
      size: '2.4 MB',
      description: 'Final facade design with updated client requirements',
      tags: ['facade', 'client-approved', 'final']
    },
    {
      id: 'asset-2',
      name: 'Lobby Visualization.jpg',
      type: 'image',
      url: '/assets/lobby-viz.jpg',
      thumbnailUrl: '/assets/thumbnails/lobby-viz-thumb.jpg',
      dateUploaded: '2025-05-12T10:15:00Z',
      uploadedBy: 'Maria Garcia',
      size: '3.8 MB',
      tags: ['interior', 'visualization', 'lobby']
    },
    {
      id: 'asset-3',
      name: 'Building Model v2.2.glb',
      type: 'model',
      url: '/assets/building-model-v2.2.glb',
      dateUploaded: '2025-05-10T09:45:00Z',
      uploadedBy: 'Sam Patel',
      size: '15.7 MB',
      description: 'Updated 3D model with roof garden and solar panels',
      tags: ['3D-model', 'exterior', 'update']
    }
  ],
  'proj-2': [
    {
      id: 'asset-4',
      name: 'Site Plan.pdf',
      type: 'document',
      url: '/assets/site-plan.pdf',
      dateUploaded: '2025-05-16T11:20:00Z',
      uploadedBy: 'Alex Johnson',
      size: '1.8 MB',
      description: 'Site plan with topography and landscape elements',
      tags: ['site-plan', 'landscape']
    }
  ]
};

const SAMPLE_CHANNELS: Record<string, Channel[]> = {
  'proj-1': [
    {
      id: 'ch-1',
      name: 'General',
      description: 'Project-wide announcements and discussions',
      isPrivate: false
    },
    {
      id: 'ch-2',
      name: 'Design Team',
      description: 'For architects and designers to collaborate',
      isPrivate: false,
      unreadCount: 3
    },
    {
      id: 'ch-3',
      name: 'Client Communication',
      description: 'Discussions to prepare for client meetings',
      isPrivate: true
    }
  ],
  'proj-2': [
    {
      id: 'ch-4',
      name: 'General',
      description: 'Project-wide announcements and discussions',
      isPrivate: false
    },
    {
      id: 'ch-5',
      name: 'Landscape Planning',
      description: 'Discussions about landscape design',
      isPrivate: false
    }
  ]
};

const SAMPLE_MESSAGES: Record<string, Message[]> = {
  'ch-1': [
    {
      id: 'msg-1',
      content: 'Welcome to the Modern Office Building project! Please check the Project Brief document in the Assets section.',
      sender: {
        id: 'user-1',
        name: 'Alex Johnson',
        avatar: '/avatars/alex.jpg'
      },
      timestamp: '2025-05-10T09:00:00Z',
      isAnnouncement: true
    },
    {
      id: 'msg-2',
      content: 'I\'ve uploaded the latest facade design with the revisions we discussed yesterday.',
      sender: {
        id: 'user-1',
        name: 'Alex Johnson',
        avatar: '/avatars/alex.jpg'
      },
      timestamp: '2025-05-14T15:35:00Z',
      attachments: [
        {
          id: 'attach-1',
          name: 'Facade Design.pdf',
          url: '/assets/facade-design.pdf',
          type: 'application/pdf'
        }
      ]
    },
    {
      id: 'msg-3',
      content: 'Looks great! I especially like the sustainable elements you\'ve incorporated.',
      sender: {
        id: 'user-2',
        name: 'Maria Garcia',
        avatar: '/avatars/maria.jpg'
      },
      timestamp: '2025-05-14T16:05:00Z'
    }
  ],
  'ch-2': [
    {
      id: 'msg-4',
      content: 'Team, please review the interior lighting plan by Friday.',
      sender: {
        id: 'user-2',
        name: 'Maria Garcia',
        avatar: '/avatars/maria.jpg'
      },
      timestamp: '2025-05-15T11:20:00Z'
    }
  ],
  'ch-3': [],
  'ch-4': [
    {
      id: 'msg-5',
      content: 'Welcome to the Lakeside Residence project! Initial concept designs are now available in the Assets section.',
      sender: {
        id: 'user-1',
        name: 'Alex Johnson',
        avatar: '/avatars/alex.jpg'
      },
      timestamp: '2025-05-16T14:00:00Z',
      isAnnouncement: true
    }
  ],
  'ch-5': []
};

export const WorkspaceProvider: React.FC<{
  children: React.ReactNode,
  initialProjectId?: string
}> = ({ children, initialProjectId }) => {
  const [projectAssets, setProjectAssets] = useState<Record<string, Asset[]>>(SAMPLE_ASSETS);
  const [channels, setChannels] = useState<Record<string, Channel[]>>(SAMPLE_CHANNELS);
  const [messages, setMessages] = useState<Record<string, Message[]>>(SAMPLE_MESSAGES);
  const [activeView, setActiveView] = useState<'project' | 'tasks' | 'assets' | 'communication'>('project');
  
  const { addNotification } = useNotifications();
  
  const generateId = (prefix: string) => {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  };
  
  // Asset Management Functions
  const uploadAsset = async (
    projectId: string,
    file: File,
    description: string,
    tags: string[]
  ) => {
    // In a real app, we'd upload to storage and get a URL
    // For this demo, we'll simulate a successful upload
    
    // Determine asset type
    let type: 'document' | 'image' | 'video' | 'model' | 'other' = 'other';
    if (file.type.startsWith('image/')) {
      type = 'image';
    } else if (file.type.startsWith('video/')) {
      type = 'video';
    } else if (file.type.includes('pdf') || file.type.includes('doc') || file.type.includes('sheet')) {
      type = 'document';
    } else if (file.name.endsWith('.glb') || file.name.endsWith('.gltf') || file.name.endsWith('.obj')) {
      type = 'model';
    }
    
    // Create a fake asset URL
    const url = `/assets/${file.name}`;
    
    // Create asset object
    const newAsset: Asset = {
      id: generateId('asset'),
      name: file.name,
      type,
      url,
      // Only add thumbnail for images
      thumbnailUrl: type === 'image' ? `/assets/thumbnails/${file.name}` : undefined,
      dateUploaded: new Date().toISOString(),
      uploadedBy: 'Current User', // In a real app, this would be the current user
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      description: description || undefined,
      tags: tags || []
    };
    
    // Update state
    setProjectAssets(prev => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), newAsset]
    }));
    
    // Notify
    addNotification(
      'success',
      'Asset Uploaded',
      `${file.name} has been successfully uploaded.`
    );
    
    return Promise.resolve();
  };
  
  const deleteAsset = (projectId: string, assetId: string) => {
    // Update state by filtering out the asset
    setProjectAssets(prev => ({
      ...prev,
      [projectId]: prev[projectId].filter(asset => asset.id !== assetId)
    }));
    
    // Notify
    addNotification(
      'info',
      'Asset Deleted',
      'The asset has been removed from the project.'
    );
  };
  
  const editAsset = (projectId: string, assetId: string, updates: Partial<Asset>) => {
    // Update state by mapping through assets and updating the matching one
    setProjectAssets(prev => ({
      ...prev,
      [projectId]: prev[projectId].map(asset => 
        asset.id === assetId ? { ...asset, ...updates } : asset
      )
    }));
    
    // Notify
    addNotification(
      'success',
      'Asset Updated',
      'The asset has been successfully updated.'
    );
  };
  
  // Communication Functions
  const sendMessage = (content: string, channelId: string, attachments?: File[]) => {
    // In a real app, we'd handle file uploads and create attachment objects
    const attachmentObjects = attachments?.map(file => ({
      id: generateId('attach'),
      name: file.name,
      url: `/assets/${file.name}`,
      type: file.type
    }));
    
    // Create a new message
    const newMessage: Message = {
      id: generateId('msg'),
      content,
      sender: {
        id: 'current-user', // In a real app, this would be the current user's ID
        name: 'Current User', // In a real app, this would be the current user's name
        avatar: undefined, // In a real app, this might be the user's avatar URL
      },
      timestamp: new Date().toISOString(),
      attachments: attachmentObjects
    };
    
    // Update state
    setMessages(prev => ({
      ...prev,
      [channelId]: [...(prev[channelId] || []), newMessage]
    }));
  };
  
  const createChannel = (projectId: string, name: string, isPrivate: boolean, description?: string) => {
    // Create a new channel
    const newChannel: Channel = {
      id: generateId('ch'),
      name,
      description,
      isPrivate,
      unreadCount: 0
    };
    
    // Update state
    setChannels(prev => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), newChannel]
    }));
    
    // Initialize empty message array for new channel
    setMessages(prev => ({
      ...prev,
      [newChannel.id]: []
    }));
    
    // Notify
    addNotification(
      'success',
      'Channel Created',
      `The ${name} channel has been created successfully.`
    );
  };
  
  // Initialize a new project with default assets and channels
  const initializeProject = (projectId: string) => {
    // Initialize empty assets array for this project
    setProjectAssets(prev => ({
      ...prev,
      [projectId]: []
    }));
    
    // Create default channels for this project
    const generalChannel = {
      id: generateId('ch'),
      name: 'general',
      description: 'General discussion for the project',
      projectId,
      isPrivate: false,
      unreadCount: 0
    };
    
    const announcementsChannel = {
      id: generateId('ch'),
      name: 'announcements',
      description: 'Important announcements and updates',
      projectId,
      isPrivate: false,
      unreadCount: 0
    };
    
    setChannels(prev => ({
      ...prev,
      [projectId]: [generalChannel, announcementsChannel]
    }));
    
    // Initialize empty messages for the channels
    setMessages(prev => ({
      ...prev,
      [generalChannel.id]: [],
      [announcementsChannel.id]: []
    }));
    
    // Create a welcome message in the general channel
    const welcomeMessage = {
      id: generateId('msg'),
      content: 'Welcome to the new project! This channel is for general discussion.',
      sender: {
        id: 'system',
        name: 'System',
        avatar: ''
      },
      timestamp: new Date().toISOString(),
      isAnnouncement: false
    };
    
    setMessages(prev => ({
      ...prev,
      [generalChannel.id]: [welcomeMessage]
    }));
  };

  return (
    <WorkspaceContext.Provider value={{
      // Asset Management
      projectAssets,
      uploadAsset,
      deleteAsset,
      editAsset,
      initializeProject,
      
      // Communication
      channels,
      messages,
      sendMessage,
      createChannel,
      
      // Active state
      activeView,
      setActiveView
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
