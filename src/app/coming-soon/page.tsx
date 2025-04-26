"use client";

import React from 'react';
import Link from 'next/link';
import styles from './ComingSoon.module.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

export default function ComingSoon() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1>Coming Soon</h1>
        <p>This feature is under development. Stay tuned!</p>
        <Link href="/dashboard" className={styles.backButton}>
          <i className="fa-solid fa-arrow-left"></i>
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
} 