#!/bin/bash

# Comprehensive Authentication Testing Script for Clerk-Supabase Integration
# This script tests token retrieval, claim validation, and database access

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
elif [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

echo "===== Clerk-Supabase Auth Testing Tool ====="
echo "This script will test the authentication between Clerk and Supabase"

# Check if required environment variables are set
if [ -z "$CLERK_SECRET_KEY" ]; then
  echo "Error: CLERK_SECRET_KEY is not set"
  exit 1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "Error: NEXT_PUBLIC_SUPABASE_URL is not set"
  exit 1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "Error: NEXT_PUBLIC_SUPABASE_ANON_KEY is not set"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: SUPABASE_SERVICE_ROLE_KEY is not set"
  exit 1
fi

echo "Environment variables loaded successfully"

# Step 1: Get list of users from Clerk
echo -e "\n===== Step 1: Fetching users from Clerk ====="
USERS=$(curl -s -X GET "https://api.clerk.dev/v1/users?limit=5" \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  -H "Content-Type: application/json")

if [ $? -ne 0 ]; then
  echo "Error: Failed to fetch users from Clerk"
  exit 1
fi

# Extract the first user ID
USER_ID=$(echo $USERS | jq -r '.[0].id')
if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  echo "Error: No users found in Clerk"
  exit 1
fi
echo "Selected user ID: $USER_ID"

# Step 2: Check if user has Supabase UUID in Clerk metadata
echo -e "\n===== Step 2: Checking for Supabase UUID mapping ====="
USER_DATA=$(curl -s -X GET "https://api.clerk.dev/v1/users/$USER_ID" \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  -H "Content-Type: application/json")

if [ $? -ne 0 ]; then
  echo "Error: Failed to fetch user data from Clerk"
  exit 1
fi

SUPABASE_ID=$(echo $USER_DATA | jq -r '.public_metadata.supabase_profile_id')
if [ -z "$SUPABASE_ID" ] || [ "$SUPABASE_ID" = "null" ]; then
  echo "Warning: User does not have a Supabase UUID in Clerk metadata"
  echo "Running sync-uuids script to create mapping..."
  
  # Run sync script if available
  if [ -f "scripts/sync-auth-uuids.js" ]; then
    node scripts/sync-auth-uuids.js
    
    # Check again for UUID
    USER_DATA=$(curl -s -X GET "https://api.clerk.dev/v1/users/$USER_ID" \
      -H "Authorization: Bearer $CLERK_SECRET_KEY" \
      -H "Content-Type: application/json")
    SUPABASE_ID=$(echo $USER_DATA | jq -r '.public_metadata.supabase_profile_id')
    
    if [ -z "$SUPABASE_ID" ] || [ "$SUPABASE_ID" = "null" ]; then
      echo "Error: Failed to create Supabase UUID mapping"
      exit 1
    fi
  else
    echo "Error: sync-auth-uuids.js script not found"
    exit 1
  fi
fi

echo "Found Supabase UUID: $SUPABASE_ID"

# Step 3: Get JWT token for the user
echo -e "\n===== Step 3: Requesting JWT token from Clerk ====="
TOKEN_RESPONSE=$(curl -s -X POST "https://api.clerk.dev/v1/users/$USER_ID/issue-token" \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"template\": \"supabase\"}")

if [ $? -ne 0 ]; then
  echo "Error: Failed to get JWT token from Clerk"
  exit 1
fi

JWT=$(echo $TOKEN_RESPONSE | jq -r '.jwt')
if [ -z "$JWT" ] || [ "$JWT" = "null" ]; then
  echo "Error: No JWT token received from Clerk"
  exit 1
fi

echo "JWT token received"

# Step 4: Decode and inspect JWT claims
echo -e "\n===== Step 4: Decoding JWT token to inspect claims ====="
# Extract header and payload
HEADER=$(echo $JWT | cut -d '.' -f1)
PAYLOAD=$(echo $JWT | cut -d '.' -f2)

# Decode base64
HEADER_DECODED=$(echo $HEADER | base64 -d 2>/dev/null || echo $HEADER | base64 -D)
PAYLOAD_DECODED=$(echo $PAYLOAD | base64 -d 2>/dev/null || echo $PAYLOAD | base64 -D)

echo "JWT Header:"
echo $HEADER_DECODED | jq .

echo "JWT Payload:"
echo $PAYLOAD_DECODED | jq .

# Check for critical claims
SUB=$(echo $PAYLOAD_DECODED | jq -r '.sub')
AUD=$(echo $PAYLOAD_DECODED | jq -r '.aud')
ROLE=$(echo $PAYLOAD_DECODED | jq -r '.role')
EMAIL=$(echo $PAYLOAD_DECODED | jq -r '.email')

# Try to extract the project reference from the URL
PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | grep -o 'https://[^.]*' | sed 's/https:\/\///')
HASURA_CLAIM_PATH="https://${PROJECT_REF}.supabase.co/jwt/claims"
HASURA_USER_ID=$(echo $PAYLOAD_DECODED | jq -r ".[\"$HASURA_CLAIM_PATH\"][\"x-hasura-user-id\"]")

echo -e "\nChecking required claims..."
if [ "$SUB" != "$SUPABASE_ID" ]; then
  echo "Warning: 'sub' claim ($SUB) does not match Supabase UUID ($SUPABASE_ID)"
  echo "This will cause authentication issues. Please run the fix-jwt-claims.js script."
else
  echo "✓ 'sub' claim matches Supabase UUID"
fi

if [ "$AUD" != "authenticated" ]; then
  echo "Warning: 'aud' claim is not 'authenticated' (found: $AUD)"
  echo "This will cause authentication issues. Please run the fix-jwt-claims.js script."
else
  echo "✓ 'aud' claim is correctly set to 'authenticated'"
fi

if [ "$ROLE" != "authenticated" ]; then
  echo "Warning: 'role' claim is not 'authenticated' (found: $ROLE)"
  echo "This will cause authentication issues. Please run the fix-jwt-claims.js script."
else
  echo "✓ 'role' claim is correctly set to 'authenticated'"
fi

# Check Hasura claims
echo -e "\nChecking Hasura claims..."
if [ -z "$HASURA_USER_ID" ] || [ "$HASURA_USER_ID" = "null" ]; then
  echo "Warning: 'x-hasura-user-id' claim is missing in the Hasura claims"
  echo "This will cause authentication issues with RLS policies. Please run the fix-jwt-claims.js script."
elif [ "$HASURA_USER_ID" != "$SUPABASE_ID" ]; then
  echo "Warning: 'x-hasura-user-id' claim ($HASURA_USER_ID) does not match Supabase UUID ($SUPABASE_ID)"
  echo "This will cause authentication issues with RLS policies. Please run the fix-jwt-claims.js script."
else
  echo "✓ Hasura claims are correctly configured with the Supabase UUID"
fi

# Step 5: Test Supabase access with the token
echo -e "\n===== Step 5: Testing Supabase access with JWT token ====="
echo "Testing notifications table access..."
NOTIFICATIONS_RESULT=$(curl -s -X GET "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/notifications?select=id,title&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT")

if [[ $NOTIFICATIONS_RESULT == *"error"* ]]; then
  echo "Error: Failed to access notifications"
  echo $NOTIFICATIONS_RESULT | jq .
else
  echo "✓ Successfully accessed notifications table"
  echo $NOTIFICATIONS_RESULT | jq .
fi

echo -e "\nTesting projects table access..."
PROJECTS_RESULT=$(curl -s -X GET "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/projects?select=id,name&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT")

if [[ $PROJECTS_RESULT == *"error"* ]]; then
  echo "Error: Failed to access projects"
  echo $PROJECTS_RESULT | jq .
else
  echo "✓ Successfully accessed projects table"
  echo $PROJECTS_RESULT | jq .
fi

# Step 6: Inspect RLS policies (requires service role)
echo -e "\n===== Step 6: Inspecting RLS policies ====="
echo "Checking row-level security policies for notifications table..."
RLS_POLICIES=$(curl -s -X GET "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/debug_jwt" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $JWT")

if [[ $RLS_POLICIES == *"error"* ]] || [ -z "$RLS_POLICIES" ]; then
  echo "Error: Could not fetch RLS debug info. Try running the fix-all-rls-policies.sql script first."
else
  echo "RLS debug info:"
  echo $RLS_POLICIES | jq .
fi

# Conclusion
echo -e "\n===== Authentication Test Complete ====="
echo "If you encountered any errors, please:"
echo "1. Run the scripts/fix-jwt-claims.js script to update the JWT template"
echo "2. Run the scripts/sync-auth-uuids.js script to ensure user mappings"
echo "3. Run the scripts/fix-all-rls-policies.sql script to update database policies"
echo "4. Restart your application"
