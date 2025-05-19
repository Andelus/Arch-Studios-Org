"use client";

/**
 * Utility functions to check if a user can access specific features
 * based on their subscription status and organization membership
 */

/**
 * Check if a user can access a premium quality level based on subscription status,
 * organization membership and trial status
 * 
 * @param quality The quality level to check ('none' | 'minor' | 'major')
 * @param subscriptionStatus User's subscription status
 * @param currentPlan User's current plan name
 * @param organizationInfo Organization membership information
 * @returns boolean indicating if the user can access the quality level
 */
export function canAccessQualityLevel(
  quality: 'none' | 'minor' | 'major',
  subscriptionStatus: string,
  currentPlan: string | null,
  organizationInfo?: { 
    isOrgMember: boolean; 
    orgSubscription?: { 
      is_trial: boolean;
      status: 'active' | 'expired' | 'pending';
    } 
  }
): boolean {
  // Always allow access to standard quality
  if (quality === 'none') return true;
  
  // Check if user is in an organization with an active trial or subscription
  if (organizationInfo?.isOrgMember && organizationInfo?.orgSubscription) {
    const { is_trial, status } = organizationInfo.orgSubscription;
    
    // If organization has an active subscription or is in trial, grant access
    if (status === 'active') {
      // For premium quality (major), check if it's a trial (which allows all features)
      // or if the subscription is unlimited (for non-trial subscriptions)
      if (quality === 'major') {
        return is_trial || true; // If subscription is active, it's unlimited
      }
      
      // Enhanced quality (minor) is available for all active org subscriptions
      return true;
    }
  }
  
  // If not using org subscription, fall back to personal subscription checks
  switch (quality) {
    case 'minor': // Enhanced quality requires active subscription
      return subscriptionStatus === 'ACTIVE';
      
    case 'major': // Premium quality requires pro plan
      return subscriptionStatus === 'ACTIVE' && 
             (currentPlan?.toLowerCase() || '').includes('pro');
      
    default:
      return false;
  }
}

/**
 * Check if user can access multi-view feature
 */
export function canAccessMultiView(
  subscriptionStatus: string,
  organizationInfo?: { 
    isOrgMember: boolean; 
    orgSubscription?: { 
      is_trial: boolean;
      status: 'active' | 'expired' | 'pending';
    } 
  }
): boolean {
  // Check if user is in an organization with an active trial or subscription
  if (organizationInfo?.isOrgMember && 
      organizationInfo?.orgSubscription && 
      organizationInfo.orgSubscription.status === 'active') {
    return true;
  }
  
  // Otherwise, check personal subscription
  return subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'TRIAL';
}

/**
 * Check if user can access edit features
 */
export function canAccessEdit(
  subscriptionStatus: string,
  organizationInfo?: { 
    isOrgMember: boolean; 
    orgSubscription?: { 
      is_trial: boolean;
      status: 'active' | 'expired' | 'pending';
    } 
  }
): boolean {
  // Check if user is in an organization with an active trial or subscription
  if (organizationInfo?.isOrgMember && 
      organizationInfo?.orgSubscription && 
      organizationInfo.orgSubscription.status === 'active') {
    return true;
  }
  
  // Otherwise, check personal subscription
  return subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'TRIAL';
}

/**
 * Check if user can access render features
 */
export function canAccessRender(
  subscriptionStatus: string,
  organizationInfo?: { 
    isOrgMember: boolean; 
    orgSubscription?: { 
      is_trial: boolean;
      status: 'active' | 'expired' | 'pending';
    } 
  }
): boolean {
  // Check if user is in an organization with an active trial or subscription
  if (organizationInfo?.isOrgMember && 
      organizationInfo?.orgSubscription && 
      organizationInfo.orgSubscription.status === 'active') {
    return true;
  }
  
  // Otherwise, check personal subscription
  return subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'TRIAL';
}
