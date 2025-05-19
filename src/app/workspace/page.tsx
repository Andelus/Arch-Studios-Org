"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import styles from "./Workspace.module.css";

export default function WorkspacePage() {
  const { isLoaded, isSignedIn } = useUser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded) {
      setLoading(false);
    }
  }, [isLoaded]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>Loading...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.message}>
          Please sign in to access your workspace
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Workspace</h1>
      <div className={styles.comingSoon}>
        <div className={styles.comingSoonIcon}>
          <i className="fas fa-laptop-code"></i>
        </div>
        <h2>Coming Soon</h2>
        <p className={styles.comingSoonText}>
          Your collaborative workspace is under development.
          Soon you'll be able to work with your team in real-time.
        </p>
      </div>
    </div>
  );
}
