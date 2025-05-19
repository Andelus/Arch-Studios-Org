"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import styles from "./Analytics.module.css";

export default function AnalyticsPage() {
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
          Please sign in to access analytics
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Analytics Dashboard</h1>
      <div className={styles.comingSoon}>
        <div className={styles.comingSoonIcon}>
          <i className="fas fa-chart-line"></i>
        </div>
        <h2>Coming Soon</h2>
        <p className={styles.comingSoonText}>
          Our analytics dashboard is currently under development.
          Soon you'll be able to track usage, performance, and more.
        </p>
      </div>
    </div>
  );
}
