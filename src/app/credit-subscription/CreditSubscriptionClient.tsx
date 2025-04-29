'use client';

import React, { useState, useEffect } from 'react';
import styles from './CreditSubscription.module.css';
import { Inter } from 'next/font/google';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

const inter = Inter({ subsets: ['latin'] });

// Initialize Supabase client with anon key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
};

interface CreditSubscriptionClientProps {
  initialPlans: any[];
}

export default function CreditSubscriptionClient({ initialPlans }: CreditSubscriptionClientProps) {
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userId, getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('Auth state:', { isLoaded, isSignedIn, userId });
    
    if (!isLoaded) {
      console.log('Auth is still loading');
      return;
    }

    if (!isSignedIn) {
      console.log('User is not signed in, redirecting to home');
      router.push('/');
      return;
    }

    const fetchUserProfile = async () => {
      console.log('Starting fetchUserProfile, userId:', userId);
  
      if (!userId) {
        console.log('No userId found');
        setIsLoading(false);
        return;
      }
  
      try {
        console.log('Getting JWT token from Clerk');
        const token = await getToken({ template: 'supabase' });
        console.log('Token received:', token ? 'Yes' : 'No');
  
        if (!token) {
          console.error('Failed to get token from Clerk');
          throw new Error('Failed to get authentication token');
        }
  
        console.log('Setting Supabase session with token');
        const { error: authError } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: '',
        });
  
        if (authError) {
          console.error('Supabase auth error:', {
            message: authError.message,
            code: authError.code,
          });
          throw authError;
        }
  
        console.log('Fetching profile for userId:', userId);
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select(`
            credits_balance,
            subscription_status,
            subscription_plans (
              name
            )
          `)
          .eq('id', userId)
          .single();

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          setError('Failed to load profile data');
          return;
        }

        console.log('Profile data received:', data);
        if (data) {
          setCredits(data.credits_balance || 0);
          const activePlan = data.subscription_plans && Array.isArray(data.subscription_plans) && data.subscription_plans[0];
          setCurrentPlan(
            data.subscription_status === 'ACTIVE' && activePlan
              ? activePlan.name
              : null
          );
        }
      } catch (error) {
        console.error('Error in fetchUserProfile:', error);
        setError('An error occurred while loading your profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId, getToken]);

  const selectPlan = async (planName: string) => {
    const selectedPlan = initialPlans.find(plan => plan.name === planName);
    if (!selectedPlan) {
      setError('Selected plan not found');
      return;
    }

    setCurrentPlan(planName);
    setCredits(selectedPlan.total_credits);

    try {
      const response = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          autoBuy: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize payment');
      }

      // Redirect to Flutterwave payment page
      window.location.href = data.paymentUrl;
    } catch (error) {
      console.error('Payment initialization error:', error);
      setError('Failed to initialize payment. Please try again.');
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
        
        {/* Current Plan Box */}
        <div className={styles.currentPlanBox}>
          <div className={styles.planInfo}>
            <div className={styles.planSection}>
              <div className={styles.sectionLabel}>Tier</div>
              <div className={styles.planName}>
                {currentPlan || 'SELECT PLAN'}
              </div>
              {!currentPlan && (
                <div className={styles.notSubscribed}>
                  Not Subscribed
                </div>
              )}
            </div>

            <div className={styles.creditsSection}>
              <div className={styles.sectionLabel}>Credits</div>
              <div className={styles.creditsDisplay}>
                <svg
                  className={styles.creditIcon}
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M10 2L3 14h9l-1 8 8-12h-9l1-8z" />
                </svg>
                {credits}
              </div>
            </div>
          </div>
          
          <button className={styles.manageBillingButton}>
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
              onSelect={() => selectPlan('STANDARD')}
              features={[
                { highlight: '250', text: 'free trial credits' },
                { highlight: '2,000', text: 'monthly credits' },
                { highlight: '10', text: 'credits for images' },
                { highlight: '10', text: 'credits for 3D' },
                { text: 'Privacy mode' }
              ]}
            />
            
            {/* Pro Plan */}
            <PlanCard
              title="PRO"
              titleColor="#ffc107"
              price="$15"
              onSelect={() => selectPlan('PRO')}
              features={[
                { highlight: '250', text: 'free trial credits' },
                { highlight: '5,000', text: 'monthly credits' },
                { highlight: '20', text: 'credits for images' },
                { highlight: '15', text: 'credits for 3D' },
                { text: 'Privacy mode' },
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
            href="mailto:info@chateauxai.com"
            className={styles.emailLink}
          >
            info@chateauxai.com
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
                href="/privacy"
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
                Privacy Policy
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}