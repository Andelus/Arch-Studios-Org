#!/bin/bash
# Test script to verify authentication is working correctly with JWT claims

# Load environment variables
source .env.local 2>/dev/null || source .env

echo "🧪 Testing JWT authentication between Clerk and Supabase..."

# Use the Clerk API to get a token for our test
echo "🔑 Fetching JWT token from Clerk..."
if [ -z "$CLERK_SECRET_KEY" ]; then
  echo "❌ Error: CLERK_SECRET_KEY environment variable is not set"
  exit 1
fi

# Get current user ID from Clerk
USER_ID=$(curl -s -X GET "https://api.clerk.dev/v1/users" \
  -H "Authorization: Bearer ${CLERK_SECRET_KEY}" \
  -H "Content-Type: application/json" | jq -r '.data[0].id')

if [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ]; then
  echo "❌ Error: Could not fetch user from Clerk API"
  exit 1
fi

echo "👤 Testing with user ID: $USER_ID"

# Get session token for this user
TOKEN=$(curl -s -X POST "https://api.clerk.dev/v1/tokens" \
  -H "Authorization: Bearer ${CLERK_SECRET_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"template_name\": \"supabase\", \"user_id\": \"${USER_ID}\"}" | jq -r '.jwt')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Error: Could not generate token from Clerk API"
  exit 1
fi

echo "🎟️ JWT token received from Clerk"

# Decode token and inspect claims
HEADER=$(echo $TOKEN | cut -d "." -f1 | base64 -d 2>/dev/null || echo $TOKEN | cut -d "." -f1 | base64 -D 2>/dev/null)
PAYLOAD=$(echo $TOKEN | cut -d "." -f2 | base64 -d 2>/dev/null || echo $TOKEN | cut -d "." -f2 | base64 -D 2>/dev/null)

echo "📋 Token header:"
echo $HEADER | jq .

echo "📋 Token payload:"
echo $PAYLOAD | jq .

echo "🧐 Inspecting custom claims:"
echo $PAYLOAD | jq '.supabase_user_id'

echo "🧐 Inspecting Hasura claims:"
PROJECT_REF=$(echo $SUPABASE_URL | sed -n 's/.*https:\/\/\([^.]*\).supabase.co.*/\1/p')
if [ -z "$PROJECT_REF" ]; then
  echo "⚠️ Warning: Could not extract project reference from SUPABASE_URL"
else
  HASURA_CLAIM_PATH="https://$PROJECT_REF.supabase.co/jwt/claims"
  echo $PAYLOAD | jq ".[\"$HASURA_CLAIM_PATH\"]"
fi

# Test the token against Supabase
echo "🔄 Testing token with Supabase..."
if [ -z "$SUPABASE_URL" ]; then
  echo "❌ Error: SUPABASE_URL environment variable is not set"
  exit 1
fi

# Test notifications endpoint (previously had 401 issues)
NOTIFICATION_TEST=$(curl -s -X GET "$SUPABASE_URL/rest/v1/notifications?limit=1" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $TOKEN")

if echo $NOTIFICATION_TEST | grep -q "error"; then
  echo "❌ Notification test failed:"
  echo $NOTIFICATION_TEST | jq .
else
  echo "✅ Notification API test passed!"
  echo $NOTIFICATION_TEST | jq .
fi

echo ""
echo "🔍 If you're still seeing 401 errors, check:"
echo "1. The Supabase profile ID in Clerk metadata (run npm run sync-uuids)"
echo "2. The JWT claims format in fix-jwt-claims.js"
echo "3. The Row Level Security policies in fix-all-rls-policies.sql"
