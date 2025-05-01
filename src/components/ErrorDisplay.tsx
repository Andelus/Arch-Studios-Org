import React from 'react';
import styles from './ErrorDisplay.module.css';

interface ErrorDisplayProps {
  error: string | null;
}

export default function ErrorDisplay({ error }: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorMessage}>{error}</div>
      {error.includes('insufficient credits') && (
        <button 
          className={styles.actionButton}
          onClick={() => window.location.href = '/credit-subscription'}
        >
          Purchase Credits
        </button>
      )}
      {(error.includes('subscription has expired') || error.includes('subscription has been cancelled')) && (
        <button 
          className={styles.actionButton}
          onClick={() => window.location.href = '/credit-subscription'}
        >
          Renew Subscription
        </button>
      )}
    </div>
  );
}
