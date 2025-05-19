/**
 * Environment variables and utilities for configuration management
 */

// Determine if the code is running in a browser environment
export const isBrowser = typeof window !== 'undefined';

// Environment configuration
export const environment = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // URLs & Endpoints
  API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://archstudios.com',
  
  // Invitation System Configuration
  INVITATION_EXPIRY_DAYS: parseInt(process.env.INVITATION_EXPIRY_DAYS || '7', 10),
  
  // Feature Flags
  ENABLE_TEAM_INVITATIONS: process.env.NEXT_PUBLIC_ENABLE_TEAM_INVITATIONS === 'true',
  
  // Returns true if the environment is production
  isProduction: () => process.env.NODE_ENV === 'production',
  
  // Returns true if the feature flag is enabled
  isFeatureEnabled: (featureName: string) => {
    const flag = `NEXT_PUBLIC_ENABLE_${featureName.toUpperCase()}`;
    return process.env[flag] === 'true';
  }
};
