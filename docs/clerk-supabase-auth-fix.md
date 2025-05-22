# Clerk-Supabase Authentication Fix

This document explains how to fix the JWT authentication issues between Clerk and Supabase in the Arch Studios application.

## Issues Fixed

1. **401 Unauthorized errors** when accessing `/notifications` endpoint
2. **401 Unauthorized errors** when creating projects
3. **JWSError JWSInvalidSignature** error indicating problems with JWT validation

## Root Causes

1. **JWT Claim Mismatch**: The JWT template in Clerk didn't include the correct claims that Supabase expects:
   - `sub` claim should be the Supabase UUID, not the Clerk user ID
   - `aud` claim should be "authenticated"
   - `role` claim should be "authenticated"
   - Hasura claims need the correct format with `x-hasura-user-id` set to the Supabase UUID

   The correct JWT claims structure should be:
   ```json
   {
     "aud": "authenticated",
     "exp": "{{exp}}",
     "sub": "{{user.public_metadata.supabase_profile_id}}",
     "email": "{{user.primary_email_address}}",
     "role": "authenticated",
     "https://<your-project-ref>.supabase.co/jwt/claims": {
       "x-hasura-role": "authenticated",
       "x-hasura-user-id": "{{user.public_metadata.supabase_profile_id}}",
       "x-hasura-default-role": "authenticated"
     }
   }
   ```

2. **UUID vs String ID Format**: Clerk's string IDs don't match Supabase's UUID requirements, requiring mapping.

3. **Row Level Security (RLS) Policies**: Some policies were using `auth.uid()::UUID` while others were using `auth.uid()::TEXT` or `auth.jwt() ->> 'sub'`, causing inconsistencies.

## Solution Components

### 1. Fix the JWT Template in Clerk

The `fix-jwt-claims.js` script updates the Clerk JWT template to include the correct claims for Supabase:

```json
{
  "aud": "authenticated",
  "exp": "{{exp}}",
  "sub": "{{user.public_metadata.supabase_profile_id}}",
  "email": "{{user.primary_email_address}}",
  "role": "authenticated"
}
```

### 2. Update Database RLS Policies

The `fix-all-rls-policies.sql` script updates all Row Level Security policies to handle both Clerk and Supabase authentication formats:

```sql
-- Example updated policy
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (
    (auth.uid()::TEXT = user_id::TEXT) OR 
    (auth.jwt() ->> 'sub')::TEXT = user_id::TEXT OR
    (email IS NOT NULL AND email = (auth.jwt() ->> 'email'))
  );
```

### 3. Enhanced Middleware

The updated `middleware.ts` file improves JWT handling by:
- Validating JWT claims against expected values
- Setting custom headers for Supabase authentication
- Automatically refreshing tokens when claims are incorrect

### 4. Improved Client-Side Authentication

Enhanced `auth-sync.tsx` component with:
- Better token caching and validation
- JWT expiration checking
- Automatic token refreshing
- Improved error handling

### 5. Updated Hooks

Modified `useNotifications.ts` and other hooks to:
- Check token validity before using
- Properly handle authentication headers
- Fall back gracefully when authentication fails

## How to Apply the Fixes

Run the `fix-auth.sh` script which will:

1. Update the JWT template in Clerk
2. Apply the SQL fixes to database policies
3. Sync user UUIDs between Clerk and Supabase
4. Test the authentication

```bash
chmod +x ./scripts/fix-auth.sh
./scripts/fix-auth.sh
```

## Manual Testing

Use the `test-auth.sh` script to verify authentication is working:

```bash
chmod +x ./scripts/test-auth.sh
./scripts/test-auth.sh
```

## Applying Individual Fixes

If you need to apply fixes individually:

1. **Fix JWT claims in Clerk**:
   ```bash
   node ./scripts/fix-jwt-claims.js
   ```

2. **Update database policies**:
   ```bash
   psql -h your-supabase-host -U postgres -f ./scripts/fix-all-rls-policies.sql
   ```

3. **Sync user UUIDs**:
   ```bash
   node ./scripts/sync-auth-uuids.js
   ```

4. **Replace middleware and auth components**:
   Copy the files from `temp_fix/` to their respective locations in `src/`

## Troubleshooting

If issues persist:

1. Check browser console for JWT-related errors
2. Verify the JWT claims using the JWT debugger at https://jwt.io
3. Check Supabase logs for authentication errors
4. Make sure all users have proper UUID mappings in Clerk metadata

## Long-Term Maintenance

To ensure continued compatibility:

1. Always check JWT claims when updating Clerk or Supabase
2. Keep the UUID mapping system in place
3. Test authentication thoroughly after any changes to auth system
4. Consider implementing WebAuthn for enhanced security in the future
