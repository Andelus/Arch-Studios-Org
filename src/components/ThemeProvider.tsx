'use client';

import { ReactNode, createContext, useContext, useEffect } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import Navigation from "./Navigation";
import { Analytics } from "@vercel/analytics/react";
import { SupabaseAuthSync } from "../lib/auth-sync";
import { useSystemTheme, Theme } from "../hooks/useSystemTheme";

// Create a context for theme access throughout the app
interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Export hook for easy access to theme context
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Theme Provider component wraps the application with Clerk and handles theme detection
 */
export default function ThemeProvider({ children }: { children: ReactNode }) {
  // Use our custom hook to detect system theme
  const { theme, clerkTheme, isDark, setTheme } = useSystemTheme();
  
  // Apply the theme to the document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  
  // Function to toggle between dark and light mode with smooth transition
  const toggleTheme = () => {
    // Add transition class for smooth theme switching
    document.documentElement.classList.add('theme-transition');
    
    // Switch the theme
    setTheme(isDark ? 'light' : 'dark');
    
    // Remove the transition class after transition completes
    const timeout = setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 300);
    
    return () => clearTimeout(timeout);
  };
  
  // Apply the theme to the document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Apply the theme to the document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  
  // Add transition CSS on mount
  useEffect(() => {
    // Add style for theme transition if it doesn't exist
    if (!document.getElementById('theme-transition-style')) {
      const style = document.createElement('style');
      style.id = 'theme-transition-style';
      style.innerHTML = `
        .theme-transition, .theme-transition * {
          transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    return () => {
      const styleElement = document.getElementById('theme-transition-style');
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  // Create theme context value
  const themeContextValue: ThemeContextType = {
    theme,
    isDark,
    setTheme,
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <ClerkProvider 
        publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
        appearance={{
          // Dynamically set the theme based on system preferences
          baseTheme: clerkTheme,
          variables: {
            colorPrimary: "#4facfe",
          },
          elements: {
            // Light mode styles
            card: {
              boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
              border: "1px solid rgba(0, 0, 0, 0.05)",
            },
            // Dark mode styles
            "card.dark": {
              backgroundColor: "#0d0d0d",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
            },
            "input.dark": {
              border: "1px solid rgba(255, 255, 255, 0.1)",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
            }
          }
        }}
      >
        <SupabaseAuthSync>
          <Navigation />
          <main className="flex-1 w-full mx-auto px-0">
            {children}
          </main>
          <Analytics />
        </SupabaseAuthSync>
      </ClerkProvider>
    </ThemeContext.Provider>
  );
}
