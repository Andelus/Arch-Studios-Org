"use client";

import { useEffect, useState } from "react";
import {
  CreateOrganization,
  OrganizationSwitcher,
  useOrganizationList,
  useUser,
  useAuth,
  OrganizationList
} from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import styles from "./Onboarding.module.css";
import { useSystemTheme } from "../../hooks/useSystemTheme";

export default function OnboardingPage() {
  const { userMemberships, userInvitations, isLoaded: isOrgListLoaded } = useOrganizationList({
    userMemberships: true,
    userInvitations: true
  });
  const { user, isLoaded: isUserLoaded } = useUser();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [hasPendingInvites, setHasPendingInvites] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  
  // Use the system theme hook
  const systemTheme = useSystemTheme();

  useEffect(() => {
    // If the user is loaded and signed in, check if they already have an organization
    if (isUserLoaded && isOrgListLoaded && isSignedIn) {
      // Check if the user has any organizations
      if (userMemberships.data.length > 0) {
        // If they do, redirect to the dashboard with their first organization
        router.push('/dashboard');
        return;
      }

      // Check if the user has any pending organization invitations
      const checkInvitations = () => {
        try {
          // Check invitations from the userInvitations that we already fetched
          if (userInvitations.data.length > 0) {
            setHasPendingInvites(true);
          } else {
            // If no invitations, show the create organization form
            setShowCreateOrg(true);
          }
        } catch (error) {
          console.error("Error checking invitations:", error);
          // Default to showing create org form if there's an error
          setShowCreateOrg(true);
        }
      };

      checkInvitations();
    }
  }, [isUserLoaded, isOrgListLoaded, isSignedIn, userMemberships.data, userInvitations.data, router, user]);

  // If user isn't loaded yet or not signed in, show loading
  if (!isUserLoaded || !isSignedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.onboardingCard}>
        {hasPendingInvites ? (
          <div className={styles.invitationsSection}>
            <h2>Organization Invitations</h2>
            <p>You have pending invitations to join organizations.</p>
            <p>Please accept an invitation to continue:</p>
            <OrganizationList 
              hidePersonal={true}
              appearance={{
                // Use the system theme hook
                baseTheme: systemTheme.clerkTheme,
                variables: {
                  colorPrimary: "#4facfe",
                },
                elements: {
                  // Light mode styles (default)
                  card: {
                    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
                    border: "1px solid rgba(0, 0, 0, 0.05)",
                  },
                  button: {
                    backgroundColor: "#4facfe",
                    "&:hover": {
                      backgroundColor: "#357abd"
                    }
                  },
                  // Dark mode styles
                  "card.dark": {
                    backgroundColor: "#0d0d0d",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
                  }
                }
              }}
            />
          </div>
        ) : showCreateOrg ? (
          <div className={styles.createOrgSection}>
            <h2>Welcome to Arch Studios</h2>
            <p>To collaborate with team members, please enter your company or organization name:</p>
            <CreateOrganization 
              appearance={{
                // Use the system theme hook
                baseTheme: systemTheme.clerkTheme,
                variables: {
                  colorPrimary: "#4facfe",
                },
                elements: {
                  // Light mode styles (default)
                  formButtonPrimary: {
                    backgroundColor: "#4facfe",
                    "&:hover": {
                      backgroundColor: "#357abd"
                    }
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
                    }
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
                  }
                }
              }}
              afterCreateOrganizationUrl="/dashboard"
            />
            <div className={styles.skipSection}>
              <p>Or you can <button onClick={() => router.push('/dashboard')} className={styles.skipLink}>continue without creating an organization</button> for now.</p>
            </div>
          </div>
        ) : (
          <div className={styles.loadingSpinner}></div>
        )}
      </div>
    </div>
  );
}
