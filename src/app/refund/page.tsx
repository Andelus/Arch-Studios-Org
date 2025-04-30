"use client";

import React from 'react';
import styles from './Refund.module.css';

export default function RefundPolicy() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Refund Policy</h1>
        <p className={styles.lastUpdated}>Last Updated: April 2025</p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Our Commitment</h2>
          <p className={styles.paragraph}>
            At Chateaux AI, we are committed to delivering high-quality AI-generated architectural content and 3D models. Your satisfaction is important to us.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Digital Products</h2>
          <p className={styles.paragraph}>
            Due to the nature of digital goods, all purchases (including AI-generated images, 3D models, and subscription plans) are non-refundable once processing or download has begun.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Subscription Plans</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>You may cancel your subscription at any time.</li>
            <li className={styles.listItem}>Cancellations prevent future billing but do not trigger refunds for the current billing cycle.</li>
            <li className={styles.listItem}>If you believe a charge was made in error, contact us within 7 days for review.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Failed or Duplicate Payments</h2>
          <p className={styles.paragraph}>
            If you were charged multiple times for the same product or experienced a failed transaction, please reach out within 7 days and we'll promptly investigate and process a refund if applicable.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Contact Us</h2>
          <p className={styles.paragraph}>
            For all refund inquiries, contact support@chateauxai.com with your transaction ID and account email.
          </p>
        </section>
      </div>
    </div>
  );
}