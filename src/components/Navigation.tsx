'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton, OrganizationSwitcher, useOrganization } from "@clerk/nextjs";
import { useTheme } from "./ThemeProvider";

export default function Navigation() {
  const [orgSubscriptionStatus, setOrgSubscriptionStatus] = useState<string | null>(null);
  const { organization, isLoaded } = useOrganization();
  
  useEffect(() => {
    const checkOrgSubscriptionStatus = async () => {
      if (!organization?.id) return;
      
      try {
        const response = await fetch(`/api/organization/${organization.id}/subscription`);
        if (response.ok) {
          const data = await response.json();
          setOrgSubscriptionStatus(data.status);
        } else if (response.status === 404) {
          // No subscription found
          setOrgSubscriptionStatus(null);
        }
      } catch (error) {
        console.error('Error checking organization subscription status:', error);
      }
    };

    if (isLoaded && organization) {
      checkOrgSubscriptionStatus();
    }
  }, [organization?.id, isLoaded]);

  // Import useTheme hook
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <span className="text-lg sm:text-xl font-bold">Chateaux AI</span>
            </Link>
            <div className="ml-10 hidden sm:flex space-x-8">
              {/* Navigation links can be added here if needed */}
            </div>
          </div>
          
          <SignedIn>
            {/* We've removed the Free Image and Free 3D badges as requested */}
          </SignedIn>

          <div className="flex items-center space-x-4">
            {/* Theme Toggle Button */}
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
            <SignedIn>
              <div className="flex items-center space-x-3">
                <Link href="/workspace" className="mr-2">
                  <div className="px-3 py-1.5 bg-gradient-to-r from-green-400 to-emerald-300 text-white rounded-md font-medium text-sm flex items-center space-x-1 border border-green-300/30 shadow-lg shadow-green-500/30 hover:shadow-green-400/40 transition-all duration-200 hover:scale-105 animate-pulse">
                    <i className="fas fa-laptop-code mr-1"></i>
                    <span className="text-shadow font-bold">Workspace</span>
                  </div>
                </Link>
                <OrganizationSwitcher 
                  hidePersonal={true}
                  appearance={{
                    variables: {
                      colorPrimary: "#4facfe",
                    },
                    elements: {
                      rootBox: {
                        width: '200px'
                      },
                      organizationSwitcherTrigger: {
                        padding: '6px',
                        borderRadius: '6px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      },
                      "organizationSwitcherTrigger.dark": {
                        border: '1px solid rgba(79, 172, 254, 0.3)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        backgroundColor: '#111111',
                        color: '#ffffff',
                      },
                      organizationPreviewTextContainer: {
                        fontSize: '14px'
                      },
                      "organizationSwitcherPopoverCard.dark": {
                        backgroundColor: '#0d0d0d',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                      }
                    }
                  }}
                />
                <UserButton 
                  afterSignOutUrl="/" 
                  appearance={{
                    variables: {
                      colorPrimary: "#4facfe",
                    },
                    elements: {
                      "avatarBox.dark": {
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        border: '1px solid rgba(79, 172, 254, 0.3)',
                      },
                      "userButtonPopoverCard.dark": {
                        backgroundColor: '#0d0d0d',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                      }
                    }
                  }}
                />
              </div>
            </SignedIn>
            <SignedOut>
              <SignInButton 
                mode="modal"
                appearance={{
                  variables: {
                    colorPrimary: "#4facfe",
                  },
                  elements: {
                    "card.dark": {
                      backgroundColor: "#0d0d0d",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)"
                    },
                    "input.dark": {
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                    },
                    formButtonPrimary: {
                      backgroundColor: "#4facfe",
                      "&:hover": {
                        backgroundColor: "#357abd"
                      }
                    }
                  }
                }}
              >
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 sm:px-4 rounded text-sm sm:text-base">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </div>
    </nav>
  );
}