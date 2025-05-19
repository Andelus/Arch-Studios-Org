"use client";

import { useState } from 'react';
import styles from './ProjectCreationModal.module.css';

interface ProjectCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectData: {
    name: string;
    description: string;
    status: 'Planning' | 'In Progress' | 'Review' | 'Completed';
    dueDate?: string;
  }) => void;
}

export default function ProjectCreationModal({
  isOpen,
  onClose,
  onCreateProject
}: ProjectCreationModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Planning' | 'In Progress' | 'Review' | 'Completed'>('Planning');
  const [dueDate, setDueDate] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onCreateProject({
      name,
      description,
      status,
      dueDate: dueDate || undefined
    });

    // Reset form
    setName('');
    setDescription('');
    setStatus('Planning');
    setDueDate('');
    
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Create New Project</h2>
          <button 
            className={styles.closeButton} 
            onClick={onClose}
            aria-label="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className={styles.adminNotice}>
          <i className="fas fa-shield-alt"></i>
          <span>Admin privileges required for project creation</span>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="project-name">Project Name</label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="project-description">Description</label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter project description"
              rows={4}
              required
            />
          </div>
          
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
              <label htmlFor="project-due-date">Due Date (optional)</label>
              <input
                id="project-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} // Today as minimum date
              />
            </div>
          </div>
          
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
              className={styles.primaryButton}
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
