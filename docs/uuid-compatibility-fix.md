# UUID Compatibility Fix for Clerk Integration

## Problem Overview

We encountered two related but distinct UUID compatibility issues:

1. **Clerk and Supabase ID Mismatch**: Clerk user IDs are string-based (e.g., "user_2Xabcd123"), but Supabase's `profiles` table requires valid UUIDs (e.g., "123e4567-e89b-12d3-a456-426614174000") for its primary key.

2. **RLS Policy Type Mismatch**: PostgreSQL Row Level Security (RLS) policies were failing with errors like `operator does not exist: uuid = text` when comparing IDs without explicit type casting.

## Solution Implemented

We've implemented a bidirectional mapping system between Clerk user IDs and Supabase UUIDs:

### 1. UUID Generation and Storage

- When a new user is created in Clerk, we generate a valid UUID v4 for their Supabase profile
- This UUID is stored in the user's Clerk metadata under `public_metadata.supabase_profile_id`
- All database tables use this UUID for foreign key relationships to profiles

### 2. Utility Functions

We've created a utility module (`src/utils/clerk-supabase.ts`) with the following functions:

- `getSupabaseProfileIdFromClerk(clerkUserId)`: Retrieves or creates a Supabase UUID for a Clerk user
- `getClerkUserIdFromSupabaseProfile(supabaseProfileId)`: Looks up the corresponding Clerk user ID
- `updateClerkUserMetadata(userId, metadata)`: Updates the Clerk user's metadata
- `ensureProfileExists(clerkUserId, email)`: Creates profile if needed and returns the UUID

### 3. Webhook Handler Updates

- Modified the Clerk webhook handler to use the new UUID mapping system
- Created a more robust error handling and logging mechanism
- Added a redirect handler to support both `/api/webhook/clerk` and `/api/webhooks/clerk` paths

### 4. Sync Script

Created a script to retroactively fix existing users:

- `scripts/sync-auth-uuids.ts` - Maps all existing Clerk users to valid UUIDs
- Run with `npm run sync-uuids` to ensure all users have proper UUID mappings

### 5. Database Access Pattern

- All database queries now use the Supabase UUID instead of the Clerk ID
- Authentication still uses Clerk ID, but database operations use the mapped UUID

## Implementation Details

### UUID Mapping Flow

```
┌─────────────┐     ┌────────────────┐     ┌──────────────┐
│   Clerk ID  │────▶│ Clerk Metadata │────▶│ Supabase UUID│
│ user_abc123 │◀────│supabase_profile_id│◀────│   valid-uuid │
└─────────────┘     └────────────────┘     └──────────────┘
```

### API Routes Updated

- `/api/webhooks/clerk/route.ts`: Main webhook handler
- `/api/webhook/clerk/route.ts`: Redirect handler
- All organization-related API routes now use UUID mapping

### Next.js 15 Compatibility

All API routes have been updated to Next.js 15 standards with Promise-based params:

```typescript
// Before
export async function GET(
  req: Request,
  { params }: { params: { organizationId: string } }
) { /* ... */ }

// After
export async function GET(
  req: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await params;
  /* ... */
}
```

## Testing

To test the UUID compatibility fix:

1. Run `npm run sync-uuids` to ensure all existing users have proper UUID mappings
2. Monitor Clerk webhook events in the logs when new users sign up
3. Verify UUID mapping in Clerk by using the Clerk dashboard to inspect user metadata

## RLS Policy Fix Implementation

We encountered persistent issues with altering database columns due to RLS policy dependencies. After multiple approaches, we implemented a solution that focuses on explicit type casting in RLS policies:

### Problem
- SQL errors: `operator does not exist: uuid = text` in RLS policies
- Authentication failures when accessing protected endpoints
- Policies failing to match Clerk JWT claims with database UUIDs

### Solution
We updated all RLS policies to include proper type casting:

```sql
-- Example of fixed policy with type casting
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (
    (auth.uid() = user_id::UUID) OR 
    (user_id::TEXT = current_setting('request.jwt.claims', true)::json->>'sub') OR
    (email IS NOT NULL AND email = current_setting('request.jwt.claims', true)::json->>'email')
  );
```

### Applied Fix
To apply the RLS policy fixes, run:
```bash
npm run db:fix-rls-only
```

This script only updates policies, avoiding schema changes that were causing errors.

## Security Considerations

- The service role key is only used server-side in webhooks and protected API routes
- The UUID mapping is stored in Clerk's metadata, which is secured by Clerk's authentication
- All database operations validate the current user's access rights regardless of UUID mapping
- RLS policies now properly handle both UUID and text format IDs
