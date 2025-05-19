"use client";

import { useState, useEffect } from 'react';
import styles from './TaskCreationModal.module.css';

interface TaskCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (taskData: {
    title: string;
    description: string;
    status: 'To Do' | 'In Progress' | 'Done';
    assignee?: string;
    dueDate?: string;
    priority: 'Low' | 'Medium' | 'High';
  }) => void;
  projectId: string;
  projectMembers: Array<{
    id: string;
    name: string;
    avatar: string;
    role: string;
    status: 'online' | 'offline' | 'away';
  }>;
  taskToEdit?: {
    id: string;
    title: string;
    description: string;
    status: 'To Do' | 'In Progress' | 'Done';
    assignee?: string;
    dueDate?: string;
    priority: 'Low' | 'Medium' | 'High';
    projectId: string;
  };
}

export default function TaskCreationModal({
  isOpen,
  onClose,
  onCreateTask,
  projectId,
  projectMembers,
  taskToEdit
}: TaskCreationModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'To Do' | 'In Progress' | 'Done'>('To Do');
  const [assignee, setAssignee] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const isEditing = !!taskToEdit;

  // Reset the form or populate it with values when the modal is opened or taskToEdit changes
  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description);
      setStatus(taskToEdit.status);
      setAssignee(taskToEdit.assignee || '');
      setDueDate(taskToEdit.dueDate ? new Date(taskToEdit.dueDate).toISOString().split('T')[0] : '');
      setPriority(taskToEdit.priority);
    } else {
      // Reset form for new task
      setTitle('');
      setDescription('');
      setStatus('To Do');
      setAssignee('');
      setDueDate('');
      setPriority('Medium');
    }
  }, [isOpen, taskToEdit]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onCreateTask({
      title,
      description,
      status,
      assignee: assignee || undefined,
      dueDate: dueDate || undefined,
      priority
    });

    // Reset form
    setTitle('');
    setDescription('');
    setStatus('To Do');
    setAssignee('');
    setDueDate('');
    setPriority('Medium');
    
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>{isEditing ? 'Edit Task' : 'Create New Task'}</h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="task-title">Task Title *</label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="task-description">Description *</label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description"
              rows={4}
              required
            />
          </div>
          
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="task-status">Status</label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="task-priority">Priority</label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
          
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="task-assignee">Assignee</label>
              <select
                id="task-assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option value="">Not Assigned</option>
                {projectMembers.map(member => (
                  <option key={member.id} value={member.name}>
                    {member.name} - {member.role}
                  </option>
                ))}
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="task-due-date">Due Date</label>
              <input
                id="task-due-date"
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
              {isEditing ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
