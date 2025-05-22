#!/bin/bash

# Comprehensive Authentication Fix Script for Clerk-Supabase Integration
# This script runs all the fixes needed to resolve JWT authentication issues

# Print colored text
print_green() {
  echo -e "\033[0;32m$1\033[0m"
}

print_yellow() {
  echo -e "\033[0;33m$1\033[0m"
}

print_red() {
  echo -e "\033[0;31m$1\033[0m"
}

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
elif [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

print_green "===== Clerk-Supabase Authentication Fix Runner ====="
print_yellow "This script will apply all fixes required to resolve authentication issues"

# Check if required environment variables are set
missing_vars=0
if [ -z "$CLERK_SECRET_KEY" ]; then
  print_red "Error: CLERK_SECRET_KEY is not set"
  missing_vars=1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  print_red "Error: NEXT_PUBLIC_SUPABASE_URL is not set"
  missing_vars=1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  print_red "Error: SUPABASE_SERVICE_ROLE_KEY is not set"
  missing_vars=1
fi

if [ $missing_vars -eq 1 ]; then
  print_red "Please set all required environment variables and try again"
  exit 1
fi

print_green "Environment variables loaded successfully"

# Step 1: Fix JWT claims in Clerk
print_green "\n===== Step 1: Fixing JWT claims in Clerk ====="
print_yellow "Running fix-jwt-claims.js script..."

if [ ! -f "./scripts/fix-jwt-claims.js" ]; then
  print_red "Error: fix-jwt-claims.js script not found"
  exit 1
fi

# Make sure the NEXT_PUBLIC_SUPABASE_URL is available
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  print_yellow "Warning: NEXT_PUBLIC_SUPABASE_URL is not set, extracting from .env..."
  
  if [ -f .env ]; then
    export $(grep -v '^#' .env | grep NEXT_PUBLIC_SUPABASE_URL | xargs)
  elif [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | grep NEXT_PUBLIC_SUPABASE_URL | xargs)
  fi
  
  if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    print_red "Error: Could not find NEXT_PUBLIC_SUPABASE_URL in environment or .env files"
    print_yellow "Please set NEXT_PUBLIC_SUPABASE_URL before continuing"
    exit 1
  fi
fi

print_yellow "Using Supabase URL: $NEXT_PUBLIC_SUPABASE_URL"

# Run the script with node
node ./scripts/fix-jwt-claims.js
if [ $? -ne 0 ]; then
  print_red "Error: Failed to update JWT claims in Clerk"
  exit 1
fi

print_green "JWT claims updated successfully"

# Step 2: Fix database RLS policies
print_green "\n===== Step 2: Updating database RLS policies ====="
print_yellow "Running fix-all-rls-policies.sql script..."

if [ ! -f "./scripts/fix-all-rls-policies.sql" ]; then
  print_red "Error: fix-all-rls-policies.sql script not found"
  exit 1
fi

# Use psql if available, otherwise use Supabase API
if command -v psql &>/dev/null; then
  print_yellow "Using psql to apply database changes..."
  
  # Extract the database host from URL
  DB_HOST=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed -e 's|^[^/]*//||' -e 's|/.*$||' -e 's|:.*$||')
  
  # Run the SQL file
  PGPASSWORD=$SUPABASE_DB_PASSWORD psql -h $DB_HOST -U postgres -f ./scripts/fix-all-rls-policies.sql
  
  if [ $? -ne 0 ]; then
    print_red "Error: Failed to apply SQL fixes using psql"
    print_yellow "Falling back to Supabase API..."
  else
    print_green "Database RLS policies updated successfully using psql"
  fi
else
  print_yellow "Using Supabase API to apply database changes..."
  
  # Extract project reference from URL
  PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | grep -o 'https://[^.]*' | sed 's/https:\/\///')
  
  # Read the SQL file content
  SQL_CONTENT=$(cat ./scripts/fix-all-rls-policies.sql)
  
  # Escape quotes for JSON
  SQL_JSON=$(echo "$SQL_CONTENT" | sed 's/"/\\"/g')
  
  # Call the Supabase API
  curl -s -X POST "https://api.supabase.com/v1/sql" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"ref\": \"$PROJECT_REF\", \"query\": \"$SQL_JSON\"}"
  
  if [ $? -ne 0 ]; then
    print_red "Error: Failed to apply SQL fixes using Supabase API"
    exit 1
  fi
  
  print_green "Database RLS policies updated successfully using Supabase API"
fi

# Step 3: Sync user UUIDs
print_green "\n===== Step 3: Synchronizing user UUIDs ====="
print_yellow "Running sync-auth-uuids.js script..."

if [ ! -f "./scripts/sync-auth-uuids.js" ]; then
  print_red "Warning: sync-auth-uuids.js script not found"
  print_yellow "Skipping UUID synchronization step"
else
  # Make the script executable if needed
  chmod +x ./scripts/sync-auth-uuids.js
  
  # Run the script with node
  node ./scripts/sync-auth-uuids.js
  if [ $? -ne 0 ]; then
    print_red "Error: Failed to synchronize user UUIDs"
    exit 1
  fi
  
  print_green "User UUIDs synchronized successfully"
fi

# Step 4: Test the authentication
print_green "\n===== Step 4: Testing the authentication ====="
print_yellow "Running test-auth.sh script..."

if [ ! -f "./scripts/test-auth.sh" ]; then
  print_red "Warning: test-auth.sh script not found"
  print_yellow "Skipping authentication test step"
else
  # Make the script executable if needed
  chmod +x ./scripts/test-auth.sh
  
  # Run the test script
  ./scripts/test-auth.sh
fi

# Conclusion
print_green "\n===== Authentication Fix Complete ====="
print_green "The authentication issues should now be resolved"
print_yellow "Please restart your application to apply the changes"
print_yellow "If you still encounter issues, please check the error messages and logs"
