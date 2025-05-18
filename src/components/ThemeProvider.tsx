'use client';

import { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import Navigation from "./Navigation";
import { Analytics } from "@vercel/analytics/react";
import { SupabaseAuthSync } from "../lib/auth-sync";
import { useSystemTheme } from "../hooks/useSystemTheme";

/**
 * Theme Provider component wraps the application with Clerk and handles theme detection
 */
export default function ThemeProvider({ children }: { children: ReactNode }) {
  // Use our custom hook to detect system theme
  const systemTheme = useSystemTheme();
  
  return (
    <ClerkProvider 
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={{
        // Dynamically set the theme based on system preferences
        baseTheme: systemTheme,
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
  );
}
