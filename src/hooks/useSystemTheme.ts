'use client';

import { useEffect, useState } from 'react';
import { dark } from '@clerk/themes';
import type { BaseThemeTaggedType } from '@clerk/types';

/**
 * Hook to detect system theme preference (light or dark)
 * This supports SSR by defaulting to a neutral value until client-side code can determine the actual preference
 * @returns The appropriate Clerk theme object (dark) or undefined for light mode
 */
export function useSystemTheme(): BaseThemeTaggedType | undefined {
  // Start with system value if available client-side, default to undefined (which means light mode in Clerk)
  const [theme, setTheme] = useState<BaseThemeTaggedType | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? dark : undefined;
  });
  
  useEffect(() => {
    // Check if window is defined (client-side)
    if (typeof window === 'undefined') return;
    
    // Set the initial theme based on user preference
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDark ? dark : undefined);
    
    // Add listener for theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? dark : undefined);
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
  
  return theme;
}
