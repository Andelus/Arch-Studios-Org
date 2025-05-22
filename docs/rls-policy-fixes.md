# RLS Policy Fixes for Clerk/Supabase Integration

## Understanding the Issues

When using Clerk as an authentication provider with Supabase, there are two common issues that need to be addressed:

1. **Permission Denied for Auth Schema**: The SQL scripts may fail with "42501: permission denied for schema auth" when trying to access Supabase's protected `auth` schema or functions.

2. **Type Mismatch Errors**: Errors like "42883: operator does not exist: uuid = text" occur when there's a mismatch between UUID and text types in comparisons.

## Solution: Updated SQL Scripts

The `fix-rls-policies-final.sql` script has been created to address both issues:

1. It uses `current_setting('request.jwt.claims')` instead of direct `auth.jwt()` access where possible
2. It includes explicit type casts (`::UUID` or `::TEXT`) to ensure type compatibility
3. It handles both standard Supabase auth and Clerk JWT claims

## Running the Fix Script

To apply these fixes, you should use the Supabase dashboard's SQL editor with administrator privileges:

1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to the SQL Editor
4. Copy and paste the contents of `fix-rls-policies-final.sql`
5. Run the entire script

If you prefer to run it programmatically, you can also use the service role key:

```bash
# Run from the project directory
PGPASSWORD=$SUPABASE_SERVICE_ROLE_KEY psql -h $SUPABASE_HOST -U postgres -d postgres -f ./scripts/fix-rls-policies-final.sql
```

## Implementation Details

### Key Changes Made:

1. **Type Casting**: Added explicit casts like `user_id::UUID` and `user_id::TEXT` to ensure type compatibility

2. **JWT Access**: Used `current_setting('request.jwt.claims', true)::json->>'sub'` to access JWT claims

3. **Dual Auth Support**: Each policy supports both native Supabase auth (`auth.uid()`) and Clerk JWT claims

4. **Debugging Support**: Added a safe public view to inspect JWT claims without requiring schema permissions

### Testing the Changes

After applying the script, you can test if the RLS policies are working properly by:

1. Accessing the `/debug` page in your application
2. Making requests to protected tables via the app
3. Querying the `public.debug_jwt` view to see the current JWT claims:

```sql
-- Run this in SQL Editor to see JWT claims
SELECT * FROM public.debug_jwt;
```

## Maintaining JWT Claims Compatibility

To ensure ongoing compatibility between Clerk and Supabase:

1. Make sure Clerk is configured as a third-party provider in Supabase
2. Verify Clerk generates JWTs with the proper claims (`role: "authenticated"` and a valid `sub` claim)
3. Use the `useSupabaseAuth` hook in your app for centralized auth management

## Reference

- [Clerk Supabase Integration Documentation](https://clerk.com/docs/integrations/databases/supabase)
- [Supabase Row Level Security Documentation](https://supabase.com/docs/guides/auth/row-level-security)
