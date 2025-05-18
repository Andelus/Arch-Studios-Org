'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton, OrganizationSwitcher } from "@clerk/nextjs";

export default function Navigation() {
  const [hasSubscription, setHasSubscription] = useState(false);

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      try {
        const response = await fetch('/api/profile');
        if (response.ok) {
          const data = await response.json();
          setHasSubscription(data.subscription_status === 'ACTIVE');
        }
      } catch (error) {
        console.error('Error checking subscription status:', error);
      }
    };

    checkSubscriptionStatus();
  }, []);

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <span className="text-lg sm:text-xl font-bold">Chateaux AI</span>
            </Link>
            <div className="ml-10 hidden sm:flex space-x-8">
              {/* Navigation links can be added here */}
            </div>
          </div>
          
          <SignedIn>
            {/* We've removed the Free Image and Free 3D badges as requested */}
          </SignedIn>

          <div className="flex items-center space-x-4">
            <SignedIn>
              <div className="flex items-center space-x-3">
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