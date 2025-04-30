"use client";

import React from 'react';
import styles from './Privacy.module.css';

export default function PrivacyPolicy() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.lastUpdated}>Last Updated: March 2024</p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Introduction</h2>
          <p className={styles.paragraph}>Welcome to Arch Studios. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Information We Collect</h2>
          <p className={styles.paragraph}>We may collect, use, store and transfer different kinds of personal data about you, including:</p>
          <ul className={styles.list}>
            <li className={styles.listItem}>Identity Data (name, username)</li>
            <li className={styles.listItem}>Contact Data (email address)</li>
            <li className={styles.listItem}>Technical Data (IP address, browser type)</li>
            <li className={styles.listItem}>Usage Data (how you use our website)</li>
            <li className={styles.listItem}>Generated Content (images and 3D models you create)</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. How We Use Your Data</h2>
          <p className={styles.paragraph}>We use your personal data for the following purposes:</p>
          <ul className={styles.list}>
            <li className={styles.listItem}>To provide and maintain our service</li>
            <li className={styles.listItem}>To notify you about changes to our service</li>
            <li className={styles.listItem}>To provide customer support</li>
            <li className={styles.listItem}>To gather analysis or valuable information to improve our service</li>
            <li className={styles.listItem}>To monitor the usage of our service</li>
            <li className={styles.listItem}>To detect, prevent and address technical issues</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Data Security</h2>
          <p className={styles.paragraph}>We have implemented appropriate security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way. We limit access to your personal data to those employees, agents, contractors, and other third parties who have a business need to know.</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Your Legal Rights</h2>
          <p className={styles.paragraph}>Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to:</p>
          <ul className={styles.list}>
            <li className={styles.listItem}>Request access to your personal data</li>
            <li className={styles.listItem}>Request correction of your personal data</li>
            <li className={styles.listItem}>Request erasure of your personal data</li>
            <li className={styles.listItem}>Object to processing of your personal data</li>
            <li className={styles.listItem}>Request restriction of processing your personal data</li>
            <li className={styles.listItem}>Request transfer of your personal data</li>
            <li className={styles.listItem}>Right to withdraw consent</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Contact Us</h2>
          <p className={styles.paragraph}>If you have any questions about this privacy policy or our privacy practices, please contact us at:</p>
          <p className={styles.paragraph}>Email: support@chateauxai.com</p>
        </section>
      </div>
    </div>
  );
}