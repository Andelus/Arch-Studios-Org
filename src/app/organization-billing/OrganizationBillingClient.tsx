'use client';

import React, { useState, useEffect } from 'react';
import styles from './OrganizationBilling.module.css';
import { Inter } from 'next/font/google';
import { useRouter } from 'next/navigation';
import { useAuth, useOrganization, useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] });

interface OrganizationSubscription {
  id: string;
  status: 'active' | 'expired' | 'pending';
  plan_type: 'unlimited' | 'custom' | 'trial';
  amount: number;
  start_date: string;
  end_date: string;
  storage_limit: number | null;
  asset_limit: number | null;
  payment_method_id?: string;
  created_at: string;
  updated_at: string;
  is_trial: boolean;
  trial_credits: number;
}

interface FormValues {
  contactName: string;
  contactEmail: string;
  teamSize: string;
  useCase: string;
  requiredFeatures: string[];
  budgetRange: string;
  additionalInfo: string;
}

interface BillingManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancelSubscription: () => void;
  onUpdatePayment: () => void;
}

const BillingManagementModal: React.FC<BillingManagementModalProps> = ({
  isOpen,
  onClose,
  onCancelSubscription,
  onUpdatePayment
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Manage Subscription</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <div className={styles.modalContent}>
          <div className={styles.formActions}>
            <button
              onClick={onUpdatePayment}
              className={`${styles.button} ${styles.primaryButton}`}
            >
              Update Payment Method
            </button>
            <button
              onClick={onCancelSubscription}
              className={`${styles.button} ${styles.dangerButton}`}
            >
              Cancel Subscription
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CustomPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
  isSubmitting: boolean;
}

const CustomPricingModal: React.FC<CustomPricingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting
}) => {
  const [values, setValues] = useState<FormValues>({
    contactName: '',
    contactEmail: '',
    teamSize: '',
    useCase: '',
    requiredFeatures: [],
    budgetRange: '',
    additionalInfo: ''
  });

  const { organization } = useOrganization();
  const { userId } = useAuth();
  const { user } = useUser();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  // Get user details from Clerk hook instead of direct API call
  useEffect(() => {
    if (user) {
      setUserName(`${user.firstName || ''} ${user.lastName || ''}`);
      if (user.emailAddresses && user.emailAddresses.length > 0) {
        setUserEmail(user.emailAddresses[0].emailAddress);
      }
    }
  }, [user]);

  useEffect(() => {
    if (organization && userName && userEmail) {
      setValues(prev => ({
        ...prev,
        contactName: userName,
        contactEmail: userEmail,
        teamSize: organization.membersCount?.toString() || '1-10'
      }));
    }
  }, [organization, userName, userEmail]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Request Custom Pricing</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        <div className={styles.modalContent}>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="contactName">Contact Name</label>
              <input
                id="contactName"
                name="contactName"
                type="text"
                className={styles.formInput}
                value={values.contactName}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="contactEmail">Contact Email</label>
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                className={styles.formInput}
                value={values.contactEmail}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="teamSize">Team Size</label>
              <select
                id="teamSize"
                name="teamSize"
                className={styles.formSelect}
                value={values.teamSize}
                onChange={handleChange}
                required
              >
                <option value="">Select team size</option>
                <option value="1-10">1-10 people</option>
                <option value="11-50">11-50 people</option>
                <option value="51-200">51-200 people</option>
                <option value="201-500">201-500 people</option>
                <option value="500+">500+ people</option>
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="useCase">Primary Use Case</label>
              <textarea
                id="useCase"
                name="useCase"
                className={styles.formTextarea}
                value={values.useCase}
                onChange={handleChange}
                placeholder="Describe how your organization plans to use our service"
                required
              />
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="budgetRange">Budget Range (USD/month)</label>
              <select
                id="budgetRange"
                name="budgetRange"
                className={styles.formSelect}
                value={values.budgetRange}
                onChange={handleChange}
                required
              >
                <option value="">Select budget range</option>
                <option value="200-500">$200-$500</option>
                <option value="501-1000">$501-$1,000</option>
                <option value="1001-5000">$1,001-$5,000</option>
                <option value="5000+">$5,000+</option>
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="additionalInfo">Additional Information</label>
              <textarea
                id="additionalInfo"
                name="additionalInfo"
                className={styles.formTextarea}
                value={values.additionalInfo}
                onChange={handleChange}
                placeholder="Any specific requirements or questions?"
              />
            </div>
            
            <div className={styles.formActions}>
              <button
                type="button"
                onClick={onClose}
                className={`${styles.button} ${styles.secondaryButton}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`${styles.button} ${styles.primaryButton}`}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Add usage statistics interface
interface UsageStatistics {
  totalAssets: number;
  totalStorageUsed: number;
  lastUpdated: string;
}

export default function OrganizationBillingClient() {
  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { userId, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isBillingModalOpen, setBillingModalOpen] = useState(false);
  const [isCustomPricingModalOpen, setCustomPricingModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn && organization) {
      fetchOrganizationSubscription();
    }
  }, [isLoaded, isSignedIn, organization?.id]);

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
        setSuccessMessage('Payment completed successfully! Your subscription is now active.');
        // Refresh subscription data
        fetchOrganizationSubscription();
      }
    }
  }, [searchParams]);

  const fetchOrganizationSubscription = async () => {
    if (!organization) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/organization/${organization.id}/subscription`);
      
      if (response.status === 404) {
        // No subscription yet
        setSubscription(null);
        setIsLoading(false);
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }

      const data = await response.json();
      setSubscription(data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setError('An error occurred while loading your subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsageStatistics = async () => {
    if (!organization) return;

    try {
      setIsLoadingStats(true);
      const response = await fetch(`/api/organization/${organization.id}/usage`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch usage statistics');
      }

      const data = await response.json();
      setUsageStats(data);
    } catch (error) {
      console.error('Error fetching usage statistics:', error);
      // Don't set an error message, as this is non-critical
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn && organization && subscription?.status === 'active') {
      fetchUsageStatistics();
    }
  }, [isLoaded, isSignedIn, organization?.id, subscription?.status]);

  const handleSubscribe = async () => {
    if (!organization) return;
    
    try {
      setIsLoading(true);
      const response = await fetch('/api/organization/subscription/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: organization.id,
          planType: 'unlimited',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize subscription');
      }

      // Redirect to payment page
      window.location.href = data.paymentUrl;
    } catch (error) {
      console.error('Subscription initialization error:', error);
      setError('Failed to initialize subscription. Please try again.');
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!organization) return;
    
    try {
      const response = await fetch('/api/organization/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: organization.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      // Update UI
      setSuccessMessage('Subscription canceled successfully. You will have access until the end of your current billing period.');
      setBillingModalOpen(false);
      fetchOrganizationSubscription();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      setError('Failed to cancel subscription. Please try again.');
    }
  };

  const handleUpdatePayment = async () => {
    if (!organization) return;
    
    try {
      const response = await fetch('/api/organization/subscription/update-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: organization.id,
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

  const handleCustomPricingSubmit = async (values: FormValues) => {
    if (!organization) return;
    
    try {
      setIsSubmitting(true);
      const response = await fetch('/api/organization/custom-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: organization.id,
          ...values,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit custom pricing request');
      }

      setSuccessMessage('Your custom pricing request has been submitted. Our team will contact you shortly.');
      setCustomPricingModalOpen(false);
    } catch (error) {
      console.error('Error submitting custom pricing request:', error);
      setError('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!organization) {
    return (
      <div className={`${styles.container} ${inter.className}`}>
        <div className={styles.contentWrapper}>
          <h1 className={styles.mainTitle}>Organization Billing</h1>
          <div className={styles.errorMessage}>
            <p>No organization selected. Please create or select an organization to manage billing.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${inter.className}`}>
      <div className={styles.contentWrapper}>
        <h1 className={styles.mainTitle}>Organization Billing</h1>
        
        {error && (
          <div className={styles.errorMessage}>
            <p>{error}</p>
          </div>
        )}
        
        {successMessage && (
          <div className={styles.successMessage}>
            <p>{successMessage}</p>
          </div>
        )}
        
        <div className={styles.currentSubscriptionBox}>
          <div className={styles.subscriptionHeader}>
            <div className={styles.subscriptionInfo}>
              <div className={styles.orgName}>{organization.name}</div>
              <div className={styles.subscriptionStatus}>
                {subscription ? (
                  <>
                    <div className={`${styles.statusBadge} ${
                      subscription.is_trial ? styles.statusTrial :
                      subscription.status === 'active' ? styles.statusActive : 
                      subscription.status === 'expired' ? styles.statusExpired : 
                      styles.statusPending
                    }`}>
                      {subscription.is_trial ? 'Trial' :
                       subscription.status === 'active' ? 'Active' : 
                       subscription.status === 'expired' ? 'Expired' : 
                       'Pending'}
                    </div>
                    <div>
                      {subscription.is_trial ? 'Free Trial' :
                       subscription.plan_type === 'unlimited' ? 'Unlimited Plan' : 
                       'Custom Plan'}
                    </div>
                  </>
                ) : (
                  <div className={`${styles.statusBadge} ${styles.statusExpired}`}>
                    No Active Subscription
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {subscription ? (
            <>
              <div className={styles.subscriptionDetails}>
                <div className={styles.detailsColumn}>
                  <div className={styles.detailsItem}>
                    <div className={styles.detailsLabel}>Billing Amount</div>
                    <div className={styles.detailsValue}>
                      {subscription.is_trial ? 'Free Trial' : `$${subscription.amount.toFixed(2)}/month`}
                    </div>
                  </div>
                  <div className={styles.detailsItem}>
                    <div className={styles.detailsLabel}>Start Date</div>
                    <div className={styles.detailsValue}>
                      {formatDate(subscription.start_date)}
                    </div>
                  </div>
                  <div className={styles.detailsItem}>
                    <div className={styles.detailsLabel}>Storage Limit</div>
                    <div className={styles.detailsValue}>
                      {subscription.storage_limit ? `${(subscription.storage_limit / 1024 / 1024 / 1024).toFixed(0)} GB` : 'Unlimited'}
                    </div>
                  </div>
                </div>
                <div className={styles.detailsColumn}>
                  <div className={styles.detailsItem}>
                    <div className={styles.detailsLabel}>Plan Type</div>
                    <div className={styles.detailsValue}>
                      {subscription.is_trial ? 'Free Trial' : 
                       subscription.plan_type === 'unlimited' ? 'Unlimited' : 'Custom'}
                    </div>
                  </div>
                  {subscription.is_trial && (
                    <div className={styles.detailsItem}>
                      <div className={styles.detailsLabel}>Trial Credits</div>
                      <div className={styles.detailsValue}>
                        {subscription.trial_credits.toLocaleString()}
                      </div>
                    </div>
                  )}
                  <div className={styles.detailsItem}>
                    <div className={styles.detailsLabel}>Renewal Date</div>
                    <div className={styles.detailsValue}>
                      {formatDate(subscription.end_date)}
                    </div>
                  </div>
                  <div className={styles.detailsItem}>
                    <div className={styles.detailsLabel}>Asset Limit</div>
                    <div className={styles.detailsValue}>
                      {subscription && subscription.asset_limit ? subscription.asset_limit.toLocaleString() : 'Unlimited'}
                    </div>
                  </div>
                </div>
              </div>
              
              {usageStats && (
                <div className={styles.usageStats}>
                  <h3 className={styles.usageTitle}>Usage Statistics</h3>
                  <div className={styles.usageGrid}>
                    <div className={styles.usageItem}>
                      <div className={styles.usageLabel}>Total Assets</div>
                      <div className={styles.usageValue}>{usageStats.totalAssets ? usageStats.totalAssets.toLocaleString() : '0'}</div>
                    </div>
                    <div className={styles.usageItem}>
                      <div className={styles.usageLabel}>Storage Used</div>
                      <div className={styles.usageValue}>
                        {usageStats.totalStorageUsed ? (usageStats.totalStorageUsed / 1024 / 1024).toFixed(2) : '0'} MB
                      </div>
                    </div>
                    <div className={styles.usageItem}>
                      <div className={styles.usageLabel}>Last Updated</div>
                      <div className={styles.usageValue}>
                        {usageStats.lastUpdated ? new Date(usageStats.lastUpdated).toLocaleString() : 'Never'}
                      </div>
                    </div>
                    <div className={styles.usageItem}>
                      <div className={styles.usageLabel}>Status</div>
                      <div className={styles.usageValue}>
                        <span className={styles.statusActive}>Unlimited Access</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.actionButtons}>
                {subscription.is_trial ? (
                  <button 
                    className={`${styles.button} ${styles.primaryButton}`}
                    onClick={handleSubscribe}
                  >
                    Upgrade to Unlimited Plan
                  </button>
                ) : (
                  <button 
                    className={`${styles.button} ${styles.primaryButton}`}
                    onClick={() => setBillingModalOpen(true)}
                  >
                    <svg 
                      width="18" 
                      height="18" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
                      <line x1="1" y1="10" x2="23" y2="10"></line>
                    </svg>
                    Manage Subscription
                  </button>
                )}
                {usageStats && (
                  <button 
                    className={`${styles.button} ${styles.secondaryButton}`}
                    onClick={fetchUsageStatistics}
                    disabled={isLoadingStats}
                  >
                    {isLoadingStats ? 'Refreshing...' : 'Refresh Usage Stats'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className={styles.actionButtons}>
              <button 
                className={`${styles.button} ${styles.primaryButton}`}
                onClick={handleSubscribe}
              >
                Subscribe to Unlimited Plan
              </button>
            </div>
          )}
        </div>
        
        <div className={styles.planSection}>
          <h2 className={styles.sectionTitle}>Available Plans</h2>
          <div className={styles.divider}></div>
          
          {subscription?.is_trial && (
            <div className={`${styles.planCard} ${styles.trialCard}`}>
              <div className={styles.planTitle}>Free Trial</div>
              <div className={styles.planDescription}>
                You're currently on a free trial with {subscription.trial_credits} credits remaining.
              </div>
              
              <div className={styles.planPrice}>
                <span className={styles.trialLabel}>Free</span>
                <span className={styles.pricePeriod}> with 1,000 credits</span>
              </div>
              
              <ul className={styles.featuresList}>
                <li className={styles.featureItem}>
                  <span className={styles.checkmark}>✓</span> 1,000 shared credits
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkmark}>✓</span> 10 credits per model generation
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkmark}>✓</span> Access for all organization members
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkmark}>✓</span> Organization asset library
                </li>
              </ul>
              
              <div className={styles.planActions}>
                <button 
                  className={`${styles.button} ${styles.secondaryButton}`}
                  onClick={fetchUsageStatistics}
                  disabled={isLoadingStats}
                >
                  {isLoadingStats ? 'Refreshing...' : 'Refresh Credits'}
                </button>
              </div>
            </div>
          )}
          
          <div className={styles.planCard}>
            <div className={styles.planTitle}>Unlimited Plan</div>
            <div className={styles.planDescription}>
              Access unlimited image and 3D model generation for your entire organization.
            </div>
            
            <div className={styles.planPrice}>
              $200 <span className={styles.pricePeriod}>/month</span>
            </div>
            
            <ul className={styles.featuresList}>
              <li className={styles.featureItem}>
                <span className={styles.checkmark}>✓</span> Unlimited image generation
              </li>
              <li className={styles.featureItem}>
                <span className={styles.checkmark}>✓</span> Unlimited 3D model generation
              </li>
              <li className={styles.featureItem}>
                <span className={styles.checkmark}>✓</span> Access for all organization members
              </li>
              <li className={styles.featureItem}>
                <span className={styles.checkmark}>✓</span> Organization asset library
              </li>
              <li className={styles.featureItem}>
                <span className={styles.checkmark}>✓</span> Priority support
              </li>
            </ul>
            
            <div className={styles.planActions}>
              <button 
                className={`${styles.button} ${styles.primaryButton}`}
                onClick={handleSubscribe}
                disabled={subscription?.status === 'active' && !subscription?.is_trial}
              >
                {subscription?.status === 'active' && !subscription?.is_trial ? 'Current Plan' : 
                 subscription?.is_trial ? 'Upgrade from Trial' : 'Subscribe Now'}
              </button>
            </div>
          </div>
          
          <div className={styles.customPricingSection}>
            <div className={styles.planCard}>
              <div className={styles.planTitle}>Custom Enterprise Plan</div>
              <div className={styles.planDescription}>
                Need a tailored solution for your enterprise? Contact us for custom pricing and features.
              </div>
              
              <ul className={styles.featuresList}>
                <li className={styles.featureItem}>
                  <span className={styles.checkmark}>✓</span> Tailored to your organization's needs
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkmark}>✓</span> Custom integrations
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkmark}>✓</span> Dedicated account manager
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkmark}>✓</span> Custom SLA
                </li>
              </ul>
              
              <div className={styles.planActions}>
                <button 
                  className={`${styles.button} ${styles.secondaryButton}`}
                  onClick={() => setCustomPricingModalOpen(true)}
                >
                  Request Custom Pricing
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BillingManagementModal
        isOpen={isBillingModalOpen}
        onClose={() => setBillingModalOpen(false)}
        onCancelSubscription={handleCancelSubscription}
        onUpdatePayment={handleUpdatePayment}
      />

      <CustomPricingModal
        isOpen={isCustomPricingModalOpen}
        onClose={() => setCustomPricingModalOpen(false)}
        onSubmit={handleCustomPricingSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
