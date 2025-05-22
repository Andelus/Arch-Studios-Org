#!/bin/bash
# Comprehensive fix for 401 Unauthorized errors with Clerk and Supabase
# This script applies all necessary fixes to resolve authentication issues

# Load environment variables
source .env.local 2>/dev/null || source .env

echo "🔄 Starting authentication fix process..."

# 1. First, update the JWT claims template in Clerk
echo "📝 Updating Clerk JWT template..."
node scripts/fix-jwt-claims.js

# 2. Ensure all users have the Supabase profile ID in their metadata
echo "👥 Synchronizing user IDs between Clerk and Supabase..."
npm run sync-uuids || node scripts/sync-auth-uuids.ts

# 3. Apply updated RLS policies to Supabase
echo "🔒 Updating Supabase Row Level Security policies..."
if [ -z "$SUPABASE_DB_URL" ]; then
  echo "❌ Error: SUPABASE_DB_URL environment variable is not set"
  exit 1
fi

# Apply the RLS policy fixes
psql "$SUPABASE_DB_URL" -f scripts/fix-all-rls-policies.sql

echo "✅ Authentication fix process completed!"
echo ""
echo "To test if authentication is working correctly, run:"
echo "npm run test-auth"
