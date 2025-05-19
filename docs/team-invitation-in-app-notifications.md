# Team Invitation System: In-App Notifications Approach

This document describes the streamlined team invitation system for Arch Studios using in-app notifications and direct project assignment.

## Overview

The team invitation system allows project administrators to invite users to join their projects with specified roles and permissions. Instead of relying on external email services, we now use:

1. **Direct Project Assignment** - For existing users already registered in the system
2. **In-App Notifications** - For both existing and future users (shown upon login)

This approach provides several advantages:
- Faster user onboarding (no email confirmation step required)
- Higher conversion rate from invitation to active participation
- Reduced dependency on third-party services
- Simplified maintenance with fewer credentials to manage

## How It Works

### 1. Invitation Creation

When a project admin invites someone to a project:

1. The system checks if the invited user already exists in the system
2. If yes, the user is added directly to the project team
3. If no, an invitation record is created and will be processed when they register

### 2. Notification Handling

- **Existing Users**: Receive an in-app notification that they've been added to a project
- **New Users**: When they register with the invited email address, they'll automatically be added to the project and notified

### 3. Auto-Processing on Login

When a user logs in, the system:
1. Checks for any pending invitations matching their email address
2. Automatically adds the user to the relevant projects
3. Displays in-app notifications about the new project assignments

## Database Schema

### Notifications Table

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  email TEXT, -- For users who haven't registered yet
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE
);
```

### Team Invitations Table (Existing)

The team_invitations table remains largely unchanged, but with updated processing logic:

```sql
-- Existing table structure
CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  inviter_id UUID NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

## Implementation Details

### 1. Notification Service

The notification service creates in-app notifications for users:

```typescript
// Create notification for users
export async function sendNotification({
  userId,
  email,
  type,
  title,
  message,
  link,
  metadata
}: {
  userId?: string;
  email?: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}): Promise<boolean> {
  // Insert notification into the database
}
```

### 2. Invitation Service

The invitation service automatically handles existing users:

```typescript
// Check if the user already exists in the system by email
const { data: existingUser } = await supabase
  .from('profiles')
  .select('id')
  .eq('email', params.email)
  .maybeSingle();

// If the user already exists, add them directly to the project
if (existingUser) {
  // Add the user directly to the project team
  await supabase.from('project_members').insert({
    project_id: params.projectId,
    user_id: existingUser.id,
    role: params.role,
    permission: params.permission
  });
  
  // Create an in-app notification
}
```

### 3. User Login Hook

On each user login, the system checks for and processes any pending invitations:

```typescript
// Inside useAuth or similar hook
useEffect(() => {
  if (user) {
    // Check for pending invitations for this user's email
    teamContext.checkUserNotifications(user.id, user.email);
  }
}, [user]);
```

## Security Considerations

- **Automatic Assignment**: Only users with the exact email address receive automatic project assignment
- **Row-Level Security**: Notifications are protected by RLS policies in the database
- **Rate Limiting**: Rate limiting still applies to prevent abuse of the invitation system
- **Expiration**: Invitations still expire after the configured time period

## Migration from Email-Based System

The migration from the email-based system to the in-app notification system involves:

1. Adding the new notifications table to the database
2. Replacing email-sending code with notification creation
3. Adding logic to automatically process invitations for existing users
4. Updating the UI to show notifications about new project assignments

## Testing the System

To test the invitation system:

1. Log in as a project admin
2. Invite another user by email
3. If the user already exists, they should be automatically added and notified
4. If not, an invitation should be created
5. When the invited user registers or logs in, they should be automatically added to the project
