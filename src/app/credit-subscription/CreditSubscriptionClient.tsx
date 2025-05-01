'use client';

import React, { useState, useEffect } from 'react';
import styles from './CreditSubscription.module.css';
import { Inter } from 'next/font/google';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] });

interface FeatureItem {
  highlight?: string;
  text: string;
}

interface PlanCardProps {
  title: string;
  titleColor: string;
  price: string;
  features: FeatureItem[];
  onSelect: () => void;
}

const PlanCard: React.FC<PlanCardProps> = ({
  title,
  titleColor,
  price,
  features,
  onSelect
}) => {
  return (
    <div className={styles.planCard}>
      <div className={styles.planTitle} style={{ color: titleColor }}>
        {title}
      </div>
      <div className={styles.planPrice}>
        {price} <span className={styles.pricePeriod}>/ month</span>
      </div>
      
      <ul className={styles.featuresList}>
        {features.map((feature, index) => (
          <li key={index} className={styles.featureItem}>
            <span className={styles.checkmark}>✓</span>
            {feature.highlight ? (
              <>
                <span className={styles.highlight}>{feature.highlight}</span> {feature.text}
              </>
            ) : (
              feature.text
            )}
          </li>
        ))}
      </ul>
      
      <button
        onClick={onSelect}
        className={styles.selectButton}
      >
        Start free trial
      </button>
    </div>
  );
}

interface BillingManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string | null;
  onCancelSubscription: () => void;
  onUpdatePayment: () => void;
}

const BillingManagementModal: React.FC<BillingManagementModalProps> = ({
  isOpen,
  onClose,
  currentPlan,
  onCancelSubscription,
  onUpdatePayment
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Manage Billing</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <div className={styles.modalContent}>
          {currentPlan ? (
            <>
              <div className={styles.currentPlanInfo}>
                <p>Current Plan: {currentPlan}</p>
              </div>
              <button
                onClick={onUpdatePayment}
                className={styles.updatePaymentButton}
              >
                Update Payment Method
              </button>
              <button
                onClick={onCancelSubscription}
                className={styles.cancelSubscriptionButton}
              >
                Cancel Subscription
              </button>
            </>
          ) : (
            <p>No active subscription</p>
          )}
        </div>
      </div>
    </div>
  );
};

interface CreditSubscriptionClientProps {
  initialPlans: any[];
}

interface UserProfile {
  subscription_status: string;
  credits_balance: number;
  subscription_plans?: {
    name: string;
  };
}

export default function CreditSubscriptionClient({ initialPlans }: CreditSubscriptionClientProps) {
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userId, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    fetchUserProfile();
  }, [userId, isLoaded, isSignedIn]);

  useEffect(() => {
    // Handle payment status from URL
    if (searchParams) {
      const success = searchParams.get('success');
      const error = searchParams.get('error');
      
      if (error) {
        const errorMessages: Record<string, string> = {
          payment_failed: 'Payment verification failed. Please try again or contact support.',
          invalid_plan: 'Invalid subscription plan. Please try again.',
          payment_processing: 'Error processing payment. Please contact support.'
        };
        setError(errorMessages[error] || 'An error occurred during payment.');
      } else if (success === 'true') {
        // Refresh user profile to get updated credits and plan
        fetchUserProfile();
      }
    }
  }, [searchParams]);

  const fetchUserProfile = async () => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      router.push('/');
      return;
    }

    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/profile');
      
      if (response.status === 404) {
        // This is expected for new users - they won't have a profile yet
        setCurrentPlan(null);
        setCredits(0);
        setProfile(null);
        setIsLoading(false);
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      if (data) {
        setProfile(data);
        setCredits(data.credits_balance || 0);
        setCurrentPlan(
          data.subscription_status === 'ACTIVE' && data.subscription_plans
            ? data.subscription_plans.name
            : null
        );
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('An error occurred while loading your profile');
    } finally {
      setIsLoading(false);
    }
  };

  const selectPlan = async (planName: string) => {
    console.log('Selecting plan:', planName);
    
    // Find the plan by name (case-insensitive)
    const selectedPlan = initialPlans.find(plan => 
      plan.name.toUpperCase() === planName.toUpperCase()
    );
    
    // If plan not found in initialPlans, use a fallback approach
    if (!selectedPlan) {
      console.log('Plan not found in initialPlans, using direct approach');
      // Set loading state
      setIsLoading(true);
      
      try {
        // Direct approach - go straight to payment initialization
        const response = await fetch('/api/payment/initialize/direct', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planName: planName,
            autoBuy: false,
          }),
        });
        
        const data = await response.json();
        
        if (response.ok && data.paymentUrl) {
          // Redirect to Flutterwave payment page
          window.location.href = data.paymentUrl;
          return;
        } else {
          throw new Error(data.error || 'Failed to initialize payment');
        }
      } catch (error) {
        console.error('Payment initialization error:', error);
        setError('Failed to initialize payment. Please try again.');
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    // Set UI state immediately
    setCurrentPlan(planName);
    setCredits(selectedPlan.total_credits);
    
    try {
      // Initialize payment with the selected plan
      const response = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          autoBuy: false,
          bypassChecks: true, // Signal to bypass all database checks
        }),
      });

      const data = await response.json();

      // Redirect to Flutterwave payment page regardless of response status
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error(data.error || 'Failed to initialize payment');
      }
    } catch (error) {
      console.error('Payment initialization error:', error);
      setError('Failed to initialize payment. Please try again.');
    }
  };

  const handleCancelSubscription = async () => {
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      setCurrentPlan(null);
      setIsBillingModalOpen(false);
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      setError('Failed to cancel subscription. Please try again.');
    }
  };

  const handleUpdatePayment = async () => {
    try {
      const selectedPlan = initialPlans.find(plan => plan.name === currentPlan);
      if (!selectedPlan) {
        throw new Error('Current plan not found');
      }

      const response = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          autoBuy: false,
          updatePayment: true
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize payment update');
      }

      // Redirect to payment page
      window.location.href = data.paymentUrl;
    } catch (error) {
      console.error('Error updating payment method:', error);
      setError('Failed to update payment method. Please try again.');
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={`${styles.container} ${inter.className}`}>
      <div className={styles.contentWrapper}>
        <h1 className={styles.mainTitle}>Current Plan</h1>
        
        <div className={styles.currentPlanBox}>
          <div className={styles.planInfo}>
            <div className={styles.planSection}>
              <div className={styles.sectionLabel}>Tier</div>
              <div className={styles.planName}>
                {currentPlan || (profile?.subscription_status === 'TRIAL' ? 'FREE TRIAL' : 'NO ACTIVE PLAN')}
              </div>
              {!currentPlan && profile?.subscription_status === 'TRIAL' && (
                <div className={`${styles.trialStatus} ${credits <= 0 ? styles.trialExpired : ''}`}>
                  {credits > 0 ? 'Trial Credits Available' : 'Trial Credits Exhausted'}
                </div>
              )}
            </div>

            <div className={styles.creditsSection}>
              <div className={styles.sectionLabel}>Credits</div>
              <div className={styles.creditsDisplay}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className={`${styles.creditIcon} ${credits <= 0 ? styles.creditIconEmpty : ''}`}
                >
                  <path d="M10 2L3 14h9l-1 8 8-12h-9l1-8z" />
                </svg>
                <span>{credits}</span>
                {profile?.subscription_status === 'TRIAL' && (
                  <div className={`${styles.trialCredits} ${credits <= 0 ? styles.trialCreditsEmpty : ''}`}>
                    {credits > 0 ? 'Trial Credits Remaining' : 'Trial Credits Depleted'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {profile?.subscription_status === 'TRIAL' && (
            <div className={`${styles.trialInfo} ${credits <= 0 ? styles.trialInfoWarning : ''}`}>
              {credits > 0 ? (
                <>
                  <p>Get started with your remaining {credits} trial credits! Generate images for 10 credits each or 3D models for 10 credits each.</p>
                  <p>Subscribe to a plan below to continue after your trial credits are used.</p>
                </>
              ) : (
                <>
                  <p>Your trial credits have been exhausted. Subscribe to a plan below to continue generating content.</p>
                  <p>Choose from our Standard or Pro plans to unlock more features and credits.</p>
                </>
              )}
            </div>
          )}
          
          {currentPlan && (
            <button 
              className={styles.manageBillingButton}
              onClick={() => setIsBillingModalOpen(true)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.billingIcon}
              >
                <path d="M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              Manage Billing
            </button>
          )}
        </div>
        
        <div className={styles.subscriptionSection}>
          <h2 className={styles.sectionTitle}>Subscription Tiers</h2>
          <div className={styles.divider}></div>
          
          <div className={styles.plansContainer}>
            {/* Standard Plan */}
            <PlanCard
              title="STANDARD"
              titleColor="#ffffff"
              price="$5"
              onSelect={() => selectPlan('Standard')}
              features={[
                { highlight: '250', text: 'free trial credits' },
                { highlight: '2,000', text: 'monthly credits' },
                { highlight: '100', text: 'credits for images' },
                { highlight: '100', text: 'credits for 3D' },
                { text: 'Privacy mode' }
              ]}
            />
            
            {/* Pro Plan */}
            <PlanCard
              title="PRO"
              titleColor="#ffc107"
              price="$15"
              onSelect={() => selectPlan('Pro')}
              features={[
                { highlight: '250', text: 'free trial credits' },
                { highlight: '5,000', text: 'monthly credits' },
                { highlight: '142', text: 'credits for images' },
                { highlight: '142', text: 'credits for 3D' },
                { text: 'Privacy mode' },
                { text: 'Priority support' },
                { text: 'Early access to new features' }
              ]}
            />
          </div>
        </div>
        
        <h1 className={styles.mainTitle}>About</h1>
        
        <div className={styles.aboutSection}>
          <div className={styles.helpTitle}>
            Need help?
          </div>
          <a
            href="mailto:support@chateauxai.com"
            className={styles.emailLink}
          >
            support@chateauxai.com
          </a>
          
          <a
            href="https://discord.gg/dqkXkrNK"
            className={styles.discordButton}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.7356 5.2473C18.3994 4.62682 16.9689 4.17946 15.4781 3.92567C15.4526 3.92113 15.427 3.9325 15.4161 3.95675C15.2383 4.28553 15.0394 4.71398 14.8996 5.05148C13.3159 4.81661 11.7398 4.81661 10.1952 5.05148C10.0553 4.70765 9.84984 4.28553 9.67124 3.95675C9.66031 3.93329 9.63477 3.92192 9.60922 3.92567C8.11913 4.18024 6.68863 4.6276 5.35161 5.2473C5.34227 5.25113 5.33451 5.25733 5.32911 5.26509C2.18545 9.92033 1.31978 14.4606 1.75448 18.9449C1.75681 18.962 1.76847 18.9783 1.78328 18.9884C3.5125 20.1851 5.16873 20.8975 6.80111 21.3745C6.82665 21.382 6.85297 21.373 6.86777 21.3519C7.28171 20.7901 7.65341 20.1969 7.9761 19.5722C7.99169 19.5386 7.97611 19.4981 7.94051 19.4845C7.35815 19.2698 6.80111 19.0078 6.26248 18.7115C6.22298 18.6888 6.21992 18.632 6.25475 18.6054C6.36367 18.5262 6.47258 18.4431 6.57614 18.3592C6.59249 18.3459 6.6141 18.3428 6.63346 18.3516C10.1797 20.0053 13.9744 20.0053 17.4758 18.3516C17.4952 18.342 17.5168 18.3451 17.5339 18.3584C17.6375 18.4431 17.7464 18.5262 17.8561 18.6054C17.8909 18.632 17.8886 18.6888 17.8491 18.7115C17.3105 19.0138 16.7534 19.2698 16.1703 19.4837C16.1347 19.4973 16.1199 19.5386 16.1355 19.5722C16.4658 20.1961 16.8375 20.7893 17.243 21.3511C17.2571 21.373 17.2842 21.382 17.3097 21.3745C18.9497 20.8975 20.6059 20.1851 22.3351 18.9884C22.3507 18.9783 22.3616 18.9628 22.3639 18.9457C22.8792 13.8039 21.509 9.29973 19.6884 5.26587C19.6838 5.25733 19.676 5.25113 19.7356 5.2473ZM8.38626 16.2167C7.35815 16.2167 6.50941 15.274 6.50941 14.1207C6.50941 12.9674 7.33952 12.0247 8.38626 12.0247C9.44154 12.0247 10.2794 12.9751 10.2631 14.1207C10.2631 15.274 9.43301 16.2167 8.38626 16.2167ZM16.6397 16.2167C15.6116 16.2167 14.7629 15.274 14.7629 14.1207C14.7629 12.9674 15.593 12.0247 16.6397 12.0247C17.695 12.0247 18.5329 12.9751 18.5166 14.1207C18.5166 15.274 17.6958 16.2167 16.6397 16.2167Z"/>
            </svg>
            Join our Discord
          </a>
          
          <div className={styles.documentsSection}>
            <div className={styles.documentsTitle}>
              Documents
            </div>
            <div className={styles.documentsList}>
              <a
                href="/refund"
                className={styles.documentLink}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={styles.documentIcon}
                >
                  <path d="M20 12V22H4V12"></path>
                  <path d="M22 7H2v5h20V7z"></path>
                  <path d="M12 22V7"></path>
                  <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                  <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
                </svg>
                Refund Policy
              </a>
            </div>
          </div>
        </div>
      </div>

      <BillingManagementModal
        isOpen={isBillingModalOpen}
        onClose={() => setIsBillingModalOpen(false)}
        currentPlan={currentPlan}
        onCancelSubscription={handleCancelSubscription}
        onUpdatePayment={handleUpdatePayment}
      />
    </div>
  );
}