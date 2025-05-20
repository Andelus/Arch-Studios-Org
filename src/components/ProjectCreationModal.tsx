"use client";

import { useState, useEffect } from 'react';
import styles from './ProjectCreationModal.module.css';

interface ProjectCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectData: {
    name: string;
    description: string;
    status: 'Planning' | 'In Progress' | 'Review' | 'Completed';
    dueDate?: string;
    projectType: string;
    clientName?: string;
    budgetEstimate?: number;
    isPrivate: boolean;
    isFolder: boolean;
    isTemplate?: boolean;
    templateId?: string | null;
    parentId?: string; // Added for folder support
  }) => void;
  isAdmin?: boolean;
  createAsFolder?: boolean; 
  createAsTemplate?: boolean;
  parentFolderId?: string; // Added to specify parent folder
  templates?: Array<{
    id: string;
    name: string;
    description: string;
    thumbnail?: string;
  }>;
}

export default function ProjectCreationModal({
  isOpen,
  onClose,
  onCreateProject,
  isAdmin = false,
  createAsFolder = false,
  createAsTemplate = false,
  parentFolderId,
  templates = []
}: ProjectCreationModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Planning' | 'In Progress' | 'Review' | 'Completed'>('Planning');
  const [dueDate, setDueDate] = useState<string>('');
  const [projectType, setProjectType] = useState('Residential');
  const [clientName, setClientName] = useState('');
  const [budgetEstimate, setBudgetEstimate] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isFolder, setIsFolder] = useState(false);
  const [isTemplate, setIsTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showAdminWarning, setShowAdminWarning] = useState(!isAdmin);
  
  // Pre-set isFolder or isTemplate if passed in as props
  useEffect(() => {
    if (isOpen && createAsFolder) {
      setIsFolder(true);
      setIsTemplate(false);
    } else if (isOpen && createAsTemplate) {
      setIsFolder(false);
      setIsTemplate(true);
    }
  }, [isOpen, createAsFolder, createAsTemplate]);

  useEffect(() => {
    // Show warning if user is not an admin
    setShowAdminWarning(!isAdmin);
  }, [isAdmin]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent non-admins from creating projects
    if (!isAdmin) {
      alert('You need admin privileges to create projects.');
      return;
    }
    
    onCreateProject({
      name,
      description,
      status,
      dueDate: dueDate || undefined,
      projectType,
      clientName: clientName || undefined,
      budgetEstimate: budgetEstimate ? parseFloat(budgetEstimate) : undefined,
      isPrivate,
      isFolder,
      isTemplate,
      templateId: selectedTemplate,
      parentId: parentFolderId
    });

    // Reset form
    setName('');
    setDescription('');
    setStatus('Planning');
    setDueDate('');
    setProjectType('Residential');
    setClientName('');
    setBudgetEstimate('');
    setIsPrivate(false);
    setIsFolder(false);
    setIsTemplate(false);
    setSelectedTemplate(null);
    
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>
            {isFolder ? "Create New Folder" : 
             isTemplate ? "Create New Template" : 
             selectedTemplate ? "Create Project from Template" : "Create New Project"}
          </h2>
          {parentFolderId && !isFolder && !isTemplate && (
            <div className={styles.parentFolderIndicator}>
              <i className="fas fa-folder" style={{color: '#ffc107'}}></i> In folder
            </div>
          )}
          <button 
            className={styles.closeButton} 
            onClick={onClose}
            aria-label="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        {showAdminWarning && (
          <div className={styles.adminNotice}>
            <i className="fas fa-shield-alt"></i>
            <span>Admin privileges required for project creation</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="project-name">Project Name *</label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              required
            />
          </div>
          
          {/* Only show project type and client for regular projects or templates */}
          {!isFolder && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="project-type">Project Type</label>
                <select
                  id="project-type"
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                >
                  <option value="Residential">Residential</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Industrial">Industrial</option>
                  <option value="Interior Design">Interior Design</option>
                  <option value="Landscape">Landscape</option>
                  <option value="Urban Planning">Urban Planning</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="project-client">Client Name</label>
                <input
                  id="project-client"
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          )}
          
          <div className={styles.formGroup}>
            <label htmlFor="project-description">Description *</label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter project description"
              rows={4}
              required
            />
          </div>
          
          {/* Only show status and due date for regular projects or templates */}
          {!isFolder && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="project-status">Status</label>
                <select
                  id="project-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="Planning">Planning</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Review">Review</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="project-due-date">Due Date</label>
                <input
                  id="project-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]} // Today as minimum date
                />
              </div>
            </div>
          )}
          
          {/* Only show budget estimate for regular projects */}
          {!isFolder && !isTemplate && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="project-budget">Budget Estimate</label>
                <div className={styles.budgetInputWrapper}>
                  <span className={styles.currencySymbol}>$</span>
                  <input
                    id="project-budget"
                    type="number"
                    value={budgetEstimate}
                    onChange={(e) => setBudgetEstimate(e.target.value)}
                    placeholder="Optional"
                    min="0"
                    step="1000"
                  />
                </div>
              </div>
            
              <div className={`${styles.formGroup} ${styles.checkboxGroup}`}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={isFolder}
                    onChange={(e) => setIsFolder(e.target.checked)}
                  />
                  <span>Create as Folder</span>
                </label>
                <p className={styles.helpText}>
                  Folders can contain multiple projects for better organization
                </p>
              </div>
            </div>
          )}
          
          <div className={styles.formRow}>
            <div className={`${styles.formGroup} ${styles.checkboxGroup}`}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                />
                <span>Private Project</span>
              </label>
              <p className={styles.helpText}>
                Private projects are only visible to invited team members
              </p>
            </div>
            
            {/* Template checkbox - only visible to admins */}
            {isAdmin && !isFolder && (
              <div className={`${styles.formGroup} ${styles.checkboxGroup}`}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={isTemplate}
                    onChange={(e) => setIsTemplate(e.target.checked)}
                  />
                  <span>Create as Template</span>
                </label>
                <p className={styles.helpText}>
                  Templates can be used as a starting point for new projects
                </p>
              </div>
            )}
          </div>
          
          {!isFolder && templates.length > 0 && (
            <div className={styles.formSection}>
              <h3>Start from Template</h3>
              <div className={styles.templateGrid}>
                {templates.map(template => (
                  <div 
                    key={template.id}
                    className={`${styles.templateCard} ${selectedTemplate === template.id ? styles.selectedTemplate : ''}`}
                    onClick={() => setSelectedTemplate(selectedTemplate === template.id ? null : template.id)}
                  >
                    <div className={styles.templateThumbnail}>
                      {template.thumbnail ? (
                        <img src={template.thumbnail} alt={template.name} />
                      ) : (
                        <i className="fas fa-file-alt"></i>
                      )}
                    </div>
                    <div className={styles.templateInfo}>
                      <h5>{template.name}</h5>
                      <p>{template.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className={styles.modalActions}>
            <button 
              type="button" 
              className={styles.secondaryButton} 
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={`${styles.primaryButton} ${!isAdmin ? styles.disabledButton : ''}`}
              disabled={!isAdmin}
            >
              {isAdmin ? 'Create Project' : 'Admin Access Required'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
