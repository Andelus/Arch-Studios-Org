# Organization-Based Subscription Model

This document outlines the organization-based unlimited subscription model implemented for Arch Studios.

## Overview

The new organization-based subscription model replaces the individual credit-based billing with a flat $200/month organization plan that provides unlimited access to all features for members of an organization.

## Key Features

- **Organization Trial**: All new organizations get a trial with 1000 shared credits (10 credits per model generation)
- **Unlimited Plan** ($200/month): Provides unlimited image and 3D model generation for all members of an organization
- **Custom Enterprise Plans**: Custom pricing and features tailored for enterprise clients
- **Organization Asset Library**: All organization members have access to a shared asset library
- **Priority Support**: Organizations receive priority customer support

## Technical Implementation

### Database Schema

The subscription model is built on the following tables:

1. **organization_subscriptions**
   - Links organizations to their subscription information
   - Stores plan type, billing amount, status, and renewal dates
   - Supports both unlimited and custom plan types

2. **custom_pricing_requests**
   - Stores enterprise client requests for custom pricing
   - Includes organization details, requirements, and budget information

3. **organization_subscription_events**
   - Logs all subscription-related events (creation, cancellation, etc.)

### API Endpoints

The subscription system exposes the following API endpoints:

- `GET /api/organization/[organizationId]/subscription`: Fetch organization's subscription details
- `POST /api/organization/subscription/initialize`: Initialize a new subscription
- `POST /api/organization/subscription/cancel`: Cancel an existing subscription
- `POST /api/organization/subscription/update-payment`: Update payment method
- `POST /api/organization/subscription/verify`: Verify subscription payment
- `POST /api/organization/custom-pricing`: Submit custom pricing request

### Webhooks

- The system processes Flutterwave payment webhooks to automatically activate subscriptions upon successful payment
- Triggers are in place to automatically check for expired subscriptions

## User Flow

1. User creates or joins an organization
2. Organization automatically gets a trial subscription with 1000 shared credits
3. All organization members can use premium features with the trial credits (10 credits per model)
4. When ready, organization admin navigates to the Organization Billing page
5. Admin subscribes to the Unlimited Plan ($200/month)
6. All organization members immediately gain unlimited access to the platform
7. Subscription automatically renews monthly until cancelled

## Technical Update: May 19, 2025

### Organization Trial Implementation

1. **Automatic Trial Creation**
   - Added automatic trial subscription creation for new organizations
   - Trial includes 1000 shared credits with reduced cost (10 credits per model generation)
   - Trial lasts for 30 days

2. **Credit Management**
   - Added `is_trial` and `trial_credits` fields to organization subscriptions
   - Created utility functions for checking and deducting trial credits
   - Implemented trial credit tracking in the organization subscription transactions table

3. **Asset Generation**
   - Updated asset generation logic to use organization trial credits before personal credits
   - Reduced trial credit cost for model generation from 100 to 10 credits
   - Added organization asset association when generating with organization trial

## Technical Update: May 20, 2025

### Database Enhancements

1. **Storage and Asset Limits**
   - Added `storage_limit` and `asset_limit` fields to `organization_subscriptions` table
   - `NULL` values indicate unlimited storage or assets
   - Non-null values enforce usage limitations

2. **Usage Statistics Functions**
   - `get_organization_usage_statistics` - Returns total assets and storage used
   - `has_unlimited_storage` - Checks if organization has unlimited storage
   - `has_unlimited_assets` - Checks if organization has unlimited assets
   - `can_upload_assets` - Validates if organization can upload more assets

### Client-Side Updates

1. **Usage Statistics Display**
   - Added new usage statistics component to Organization Billing page
   - Shows total assets, storage used, and last updated time
   - Added refresh capability for real-time usage updates

2. **Asset Management**
   - Added new organization asset management utilities
   - Created specialized functions for handling organization assets

### Removed Components

- Removed all credit-based subscription tables and related infrastructure
- Removed credit display components from navigation and UI

## Future Enhancements

- Email notifications for subscription events (creation, renewal, cancellation)
- Tiered organization plans with different limits (future feature, not in current implementation)
- Annual subscription options with discounted pricing
- Enhanced usage analytics dashboard for organization admins
- Team-specific access controls for organization assets
