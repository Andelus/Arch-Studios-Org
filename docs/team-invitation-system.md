# Team Invitation System

This document outlines the team invitation system for Arch Studios, implemented for production use.

## Overview

The team invitation system allows project administrators to invite team members to join projects. The system uses in-app notifications and direct project assignment for a more streamlined experience.

## Architecture

The system consists of the following components:

1. **Notification Service** (`notification-service.ts`) - Handles in-app notifications to users
2. **Email Service** (`email-service.ts`) - Simple backup email service for subscription notifications only
3. **Invitation Service** (`invitation-service.ts`) - Manages the creation and validation of invitations
4. **Database Tables** - Stores invitation and notification data
5. **API Routes** - For resending invitations
6. **UI Components** - For displaying and managing invitations

## Implementation Details

### Database Schema

Invitations are stored in the `team_invitations` table with the following structure:

- `id` - UUID (primary key)
- `project_id` - References the project
- `email` - The invitee's email address
- `role` - The role assigned to the invitee (e.g., "Architect")
- `permission` - The permission level (admin, editor, viewer)
- `inviter_id` - The user who sent the invitation
- `status` - Current status (pending, accepted, expired)
- `created_at` - When the invitation was created
- `expires_at` - When the invitation expires
- `accepted_at` - When the invitation was accepted (if applicable)

### Workflow

1. **Sending an Invitation**:
   - Admin user enters email, role, and permission level
   - System checks if the user already exists in the system
   - If user exists, system adds them directly to the project and creates an in-app notification
   - If user doesn't exist, system creates record in `team_invitations` table and creates a pending notification
   - UI shows pending invitation in team management interface

2. **Processing Invitations for Existing Users**:
   - When a user logs in, the system checks for pending notifications
   - System shows notifications about new project assignments
   - User can click the notification to navigate directly to the project

3. **Processing Invitations for New Users**:
   - When a new user registers with an email that has pending invitations
   - System automatically adds them to the relevant projects
   - System shows notifications about their project assignments
   - System updates invitation status to "accepted"

4. **Invitation Expiration**:
   - Invitations automatically expire after 7 days
   - Expired invitations cannot be processed
   - Admins can resend expired invitations

## Security Considerations

- Invitations are tied to a specific email address
- Only users with that email address can accept the invitation
- Invitations expire after 7 days
- Invitation tokens are non-guessable UUIDs
- Only project admins can send invitations
- Database transaction ensures atomic operations when accepting invitations
- Input sanitization and validation for all API endpoints

## Production Configuration

To use this system in production, you need to:

1. Set up a SendGrid account and get an API key
2. Create email templates in SendGrid for invitations
3. Set the required environment variables (see `.env.template`)
4. Run the database migrations to create the necessary tables

## Notification System Configuration

The team invitation system uses in-app notifications to inform users about invitations and project assignments. No external email service configuration is required for the core functionality.

### Notification Types

The system uses the following notification types:

1. **Team Invitation** - Created when a user is invited to join a project
   - Shows up in the notification center when the user logs in
   - Contains a direct link to the project
   - Dynamic fields:
     - Project name
     - Inviter name
     - Role assigned to the user
     
2. **Invitation Accepted** - Created when a user accepts an invitation
   - Notifies the inviter that their invitation was accepted
   - Contains a link to the team management page
   - Dynamic fields:
     - Invitee name
     - Project name
     - Role assigned to the invitee

### Testing the Notification System

To test the notification system:

```bash
npm run test:invitation-notification
```

This script:
- Creates test notifications for a given email
- Simulates the invitation process
- Verifies that notifications are properly created
- Tests both existing and new user scenarios

### Backup Email Functionality

While the core invitation system uses in-app notifications, the application still maintains a simple email service for subscription notifications. This service:

1. Logs emails in development mode
2. Can be connected to an email provider in production
3. Is used only for critical transactional emails like subscription updates

## API Reference

### Invitation Service

- `createInvitation` - Creates a new invitation and sends an email
- `validateInvitation` - Checks if an invitation token is valid
- `acceptInvitation` - Accepts an invitation and adds the user to the project

### API Routes

- `POST /api/invitations/resend` - Resends an invitation

## UI Components

- `TeamManagementModal` - For managing team members and sending invitations
- `PendingInvitations` - For displaying and resending pending invitations
- Invitation acceptance page at `/invitation/accept`

## Environment Variables

The following environment variables are required:

- `NEXT_PUBLIC_APP_URL` - The base URL of the application
- `NEXT_PUBLIC_ENABLE_TEAM_INVITATIONS` - Feature flag to enable/disable invitations
- `INVITATION_EXPIRY_DAYS` - Number of days until an invitation expires (default: 7)
- `ADMIN_EMAIL` - Email address for admin notifications (optional)

For the subscription notification email service:
- `EMAIL_FROM_ADDRESS` - The email address system emails are sent from (if using a provider)
- `EMAIL_PROVIDER` - Which email provider to use (optional, blank for development mode)

## Testing

The invitation system includes:

1. Unit tests for the invitation and notification services
2. Integration tests for API routes
3. End-to-end tests for the complete invitation flow

To run tests:

```bash
npm run test:invitation-notification
```

## Error Handling

The system handles the following error scenarios:

- Invalid invitation tokens
- Expired invitations
- Email sending failures
- Database errors
- Authentication failures
- Missing permissions

All errors are logged with appropriate context and user-friendly error messages are displayed in the UI.
