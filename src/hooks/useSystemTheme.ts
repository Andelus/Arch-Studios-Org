'use client';

import { useEffect, useState } from 'react';
import { dark } from '@clerk/themes';
import type { BaseThemeTaggedType } from '@clerk/types';

export type Theme = 'light' | 'dark';

interface UseSystemThemeReturn {
  theme: Theme;
  clerkTheme: BaseThemeTaggedType | undefined;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
}

/**
 * Hook to detect system theme preference (light or dark)
 * This hook now returns both the Clerk theme object and our custom theme string
 * It also supports manually setting the theme
 * @returns Object with theme properties and setters
 */
export function useSystemTheme(): UseSystemThemeReturn {
  // Start with system value if available client-side, default to light
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    
    // First check localStorage for saved preference
    const savedTheme = localStorage.getItem('arch-studios-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    
    // Otherwise use system preference
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  
  // Apply theme to document
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Save to localStorage
    localStorage.setItem('arch-studios-theme', theme);
    
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);
  
  // Listen for system theme changes
  useEffect(() => {
    // Check if window is defined (client-side)
    if (typeof window === 'undefined') return;
    
    // Only listen for system changes if no user preference is stored
    if (localStorage.getItem('arch-studios-theme')) return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setThemeState(e.matches ? 'dark' : 'light');
    };
    
    // Use the appropriate event listener method
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);
  
  // Set theme function that persists to localStorage
  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('arch-studios-theme', newTheme);
    setThemeState(newTheme);
  };
  
  return {
    theme,
    clerkTheme: theme === 'dark' ? dark : undefined,
    isDark: theme === 'dark',
    setTheme
  };
}
