"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateOrganization, useOrganizationList, useUser, useAuth } from "@clerk/nextjs";
import styles from "./SetupOrganization.module.css";
import { useSystemTheme } from "../../hooks/useSystemTheme";

export default function SetupOrganizationPage() {
  const { userMemberships, isLoaded: isOrgListLoaded } = useOrganizationList({ userMemberships: true });
  const { user, isLoaded: isUserLoaded } = useUser();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Use the system theme hook
  const systemTheme = useSystemTheme();
  
  // Hide navigation when this page loads
  useEffect(() => {
    const nav = document.querySelector('nav');
    if (nav) nav.style.display = 'none';
    
    return () => {
      if (nav) nav.style.display = 'flex';
    };
  }, []);

  useEffect(() => {
    // If the user already has an organization, redirect to dashboard
    if (isUserLoaded && isOrgListLoaded && isSignedIn) {
      if (userMemberships.data.length > 0) {
        router.push('/dashboard');
      }
    }
  }, [isUserLoaded, isOrgListLoaded, isSignedIn, userMemberships.data, router]);
  
  // Add ability to go back to dashboard if user wants to create organization later
  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

  // Show loading state while checking
  if (!isUserLoaded || !isOrgListLoaded || !isSignedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.setupCard}>
        <h1 className={styles.title}>Setup Your Organization</h1>
        
        {!showCreateForm ? (
          <div className={styles.setupInstructions}>
            <p className={styles.description}>
              Welcome to Arch Studios!
            </p>
            <p className={styles.subDescription}>
              Organizations allow you to collaborate with team members and manage your projects.
            </p>
            
            <div className={styles.buttonGroup}>
              <button 
                className={styles.setupButton}
                onClick={() => setShowCreateForm(true)}
              >
                Create Organization
              </button>
              
              <button 
                className={styles.cancelButton}
                onClick={handleBackToDashboard}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.formContainer}>
            <h2>Enter organization details</h2>
            <CreateOrganization 
              hideSlug={true}
              appearance={{
                // Use the system theme hook
                baseTheme: systemTheme,
                variables: {
                  colorPrimary: "#4facfe",
                },
                elements: {
                  // Light mode styles (default)
                  formButtonPrimary: {
                    backgroundColor: "#4facfe",
                    "&:hover": {
                      backgroundColor: "#357abd"
                    },
                    margin: "0 auto",
                    display: "block"
                  },
                  card: {
                    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
                    border: "1px solid rgba(0, 0, 0, 0.05)",
                  },
                  input: {
                    border: "1px solid rgba(0, 0, 0, 0.1)"
                  },
                  // Dark mode styles
                  "formButtonPrimary.dark": {
                    backgroundColor: "#4facfe",
                    "&:hover": {
                      backgroundColor: "#357abd"
                    },
                    margin: "0 auto",
                    display: "block"
                  },
                  "card.dark": {
                    backgroundColor: "#0d0d0d",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
                  },
                  "input.dark": {
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    color: "#ededed"
                  },
                  rootBox: {
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  },
                  form: {
                    width: "100%",
                    maxWidth: "400px",
                    margin: "0 auto"
                  }
                }
              }}
              afterCreateOrganizationUrl="/dashboard"
            />
          </div>
        )}
      </div>
    </div>
  );
}
