# Clerk-Supabase Integration Guide

This guide will help you properly set up and test the integration between Clerk and Supabase for authentication.

## Set Up Clerk as a Supabase Third-Party Auth Provider

1. Go to the Clerk Dashboard at https://dashboard.clerk.com
2. Navigate to the Supabase Integration setup: https://dashboard.clerk.com/setup/supabase
3. Select your configuration options and click "Activate Supabase integration"
4. Copy the Clerk Domain that is displayed

5. Go to your Supabase Dashboard at https://supabase.com/dashboard/project/_/auth/third-party
6. Select "Add provider" and choose "Clerk" from the list
7. Paste the Clerk Domain you copied and save the configuration

## Fix Database Relationships

Run the database fix script to ensure proper relationships between the `profiles` and `project_members` tables:

```bash
# Run the script to fix database relationships
npm run db:fix
```

This will execute the SQL queries in `scripts/fix-profiles-relationship.sql` to repair the necessary relationships.

## Testing Authentication

1. Make sure you're logged into the application using Clerk
2. Check the browser console for authentication messages
3. Navigate to the debug page at `/debug` to verify token validation
4. Try accessing notifications and project members data to ensure authenticated requests work

### Common Issues and Solutions

1. **401 Unauthorized errors**: 
   - Check that the token exists in both sessionStorage and localStorage
   - Verify the token format and JWT claims (`sub` and `role` fields)
   - Make sure the Clerk domain is properly set in Supabase

2. **400 Bad Request errors with relationships**:
   - Use the helper functions in `utils/db-helpers.ts` to work around relationship issues
   - Make sure the database relationships are properly set up with `run-db-fix.ts`

3. **JWT token issues**:
   - Make sure Clerk is configured to provide the required claims in the JWT
   - The token should have `"role": "authenticated"` claim
   - User ID from Clerk should match the user ID in Supabase

## Helpful Debugging Tools

- Use the AuthDebugger component to view current authentication state
- Check `/api/debug/supabase-check` endpoint for detailed auth diagnostics
- Run `test-invitation-notification.mjs` script to test notification functionality

## Required Environment Variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## References

- [Clerk Supabase Integration Documentation](https://clerk.com/docs/integrations/databases/supabase)
- [Supabase JWT Auth Documentation](https://supabase.com/docs/guides/auth/third-party/overview)
