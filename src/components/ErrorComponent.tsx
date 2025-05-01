import React from 'react';
import styles from './ErrorComponent.module.css';

interface ErrorComponentProps {
  error: string | null;
  onPurchaseCredits: () => void;
  onRenewSubscription: () => void;
}

export default function ErrorComponent({ error, onPurchaseCredits, onRenewSubscription }: ErrorComponentProps) {
  if (!error) return null;

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorMessage}>{error}</div>
      {error.includes('insufficient credits') && (
        <button 
          className={styles.actionButton}
          onClick={onPurchaseCredits}
        >
          Purchase Credits
        </button>
      )}
      {(error.includes('subscription has expired') || error.includes('subscription has been cancelled')) && (
        <button 
          className={styles.actionButton}
          onClick={onRenewSubscription}
        >
          Renew Subscription
        </button>
      )}
    </div>
  );
}
