'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import CreditDisplay from "./CreditDisplay";

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
          </div>
          
          <SignedIn>
            {!hasSubscription && (
              <div className="flex items-center space-x-4">
                <div className="hidden sm:flex flex-col items-center">
                  <div className="flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-blue-500/5 dark:from-blue-400/20 dark:to-blue-400/10 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium border border-blue-500/20 dark:border-blue-400/20 transition-all duration-200 hover:scale-105">
                    <i className="fa-solid fa-bolt text-xs mr-2 opacity-70"></i>
                    <span className="font-medium tracking-tight">Lightning</span>
                  </div>
                  <CreditDisplay />
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <div className="flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-blue-500/5 dark:from-blue-400/20 dark:to-blue-400/10 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium border border-blue-500/20 dark:border-blue-400/20 transition-all duration-200 hover:scale-105">
                    <i className="fa-regular fa-image text-xs mr-2 opacity-70"></i>
                    <span className="font-medium tracking-tight">1 Free Image</span>
                  </div>
                  <div className="flex items-center px-3 py-1.5 bg-gradient-to-r from-purple-500/10 to-purple-500/5 dark:from-purple-400/20 dark:to-purple-400/10 text-purple-600 dark:text-purple-400 rounded-full text-sm font-medium border border-purple-500/20 dark:border-purple-400/20 transition-all duration-200 hover:scale-105">
                    <i className="fa-solid fa-cube text-xs mr-2 opacity-70"></i>
                    <span className="font-medium tracking-tight">1 Free 3D</span>
                  </div>
                </div>
              </div>
            )}
          </SignedIn>

          <div className="flex items-center space-x-4">
            <SignedIn>
              <div className="flex items-center">
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
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