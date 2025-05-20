"use client";

import { useState, useEffect } from 'react';
import { useSystemTheme } from '@/hooks/useSystemTheme';
import styles from './AnimatedProfileIcon.module.css';

interface AnimatedProfileIconProps {
  name: string;
  size?: 'small' | 'medium' | 'large';
  status?: 'online' | 'offline' | 'away';
  animated?: boolean;
  className?: string;
}

export default function AnimatedProfileIcon({
  name,
  size = 'medium',
  status,
  animated = true,
  className = ''
}: AnimatedProfileIconProps) {
  const { theme, isDark } = useSystemTheme();
  const [color, setColor] = useState<string>('');
  const [isHovered, setIsHovered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Generate a consistent color based on the name
  useEffect(() => {
    const colorOptions = [
      'var(--profile-color-1)',
      'var(--profile-color-2)',
      'var(--profile-color-3)',
      'var(--profile-color-4)',
      'var(--profile-color-5)',
    ];
    
    // Create a simple hash from the name to select a consistent color
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colorOptions.length;
    setColor(colorOptions[index]);
  }, [name]);
  
  // Handle initial animation on mount
  useEffect(() => {
    if (animated) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [animated]);
  
  // Get initials from name (up to 2 characters)
  const getInitials = () => {
    if (!name) return '?';
    
    const names = name.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };
  
  // Status label for accessibility
  const getStatusLabel = () => {
    if (!status) return '';
    return `User is ${status}`;
  };
  
  const sizeClass = styles[size] || styles.medium;
  const themeClass = isDark ? styles.dark : styles.light;
  
  return (
    <div 
      className={`${styles.profileIcon} ${sizeClass} ${themeClass} ${className}`}
      style={{ backgroundColor: color }}
      onMouseEnter={() => animated && setIsHovered(true)}
      onMouseLeave={() => animated && setIsHovered(false)}
      data-testid="animated-profile-icon"
      title={`${name} (${getStatusLabel()})`}
      role="img"
      aria-label={`${name}'s profile image, ${getStatusLabel()}`}
    >
      <span 
        className={`${styles.initials} ${
          isHovered ? styles.animatedInitials : 
          isAnimating ? styles.animatedInitials : ''
        }`}
      >
        {getInitials()}
      </span>
      
      {status && (
        <span 
          className={`${styles.statusIndicator} ${styles[status]}`} 
          aria-hidden="true" 
        />
      )}
    </div>
  );
}
