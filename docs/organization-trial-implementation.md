# Organization Trial Implementation

## Overview

This document outlines the implementation of organization trials in Arch Studios. Organizations now automatically start with a trial subscription that provides full feature access with a shared pool of 1000 credits. This replaces the need for individual members to use their personal credits when working within an organization.

## Key Features

- **Automatic Trial**: All new organizations automatically get a trial subscription
- **1000 Shared Credits**: Organizations receive 1000 trial credits to share among members
- **Reduced Credit Cost**: Model generation costs 10 credits (instead of 100) during trial
- **Full Feature Access**: All premium features are available during the trial
- **Organization Asset Library**: Assets created during trial are stored in organization library

## Implementation Details

### Database Changes

1. **Updated Organization Subscriptions Table**:
   - Added `is_trial` (boolean) to track trial status
   - Added `trial_credits` (integer) to track remaining trial credits
   - Added check constraint to ensure trial credits are non-negative

2. **Migration Script**:
   - Created migration file: `src/supabase/migrations/20250519000000_add_organization_trial.sql`

### Code Changes

1. **Organization Trial Utilities**:
   - Created utility functions in `src/utils/clerk-supabase.ts`:
     - `ensureOrganizationTrialExists`: Creates a trial subscription for a new org
     - `hasEnoughOrganizationTrialCredits`: Checks if org has enough trial credits
     - `deductOrganizationTrialCredits`: Deducts credits from org's trial balance

2. **Webhook Handler**:
   - Updated the `organization.created` event handler to automatically create trial subscriptions

3. **Asset Manager**:
   - Updated the model generation logic to check for organization credits before using personal credits
   - Implemented organization credit deduction for model generation
   - Ensured assets are properly associated with organizations

4. **Organization Asset Manager**:
   - Added `handleOrganizationModelGeneration` function to manage model generation with trial credits
   - Updated organization subscription interface to include trial details

## Credit Cost Changes

- **Model Generation** during organization trial: **10 credits** (was 100)
- All other costs remain unchanged

## How to Test

1. **Create a new organization**: Trial subscription should be automatically created with 1000 credits
2. **Generate a 3D model**: Should deduct 10 credits from the organization's trial balance
3. **Check organization assets**: Model should be saved to the organization's asset library
4. **Verify credit deduction**: Organization trial credits should decrease by 10
5. **Personal credits**: Ensure personal credits remain untouched when using organization credits

## Monitoring

The system logs organization trial credit usage in the following places:
- Console logs when credits are deducted
- Transaction records in the `organization_subscription_transactions` table
- Deduction events in the application logs
