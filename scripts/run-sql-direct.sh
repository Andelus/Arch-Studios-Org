#!/bin/bash
# Script to run SQL scripts using psql directly against the Supabase database
# This approach avoids using the RPC exec_sql function which might have permission issues

# Load environment variables
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
else
  echo "Error: .env.local file not found"
  exit 1
fi

# Check for required variables
if [ -z "$SUPABASE_DB_URL" ] && [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: Neither SUPABASE_DB_URL nor SUPABASE_SERVICE_ROLE_KEY set in .env.local"
  echo "You need either:"
  echo "- SUPABASE_DB_URL=postgres://postgres:password@db.example.supabase.co:5432/postgres"
  echo "- or SUPABASE_SERVICE_ROLE_KEY with NEXT_PUBLIC_SUPABASE_URL"
  exit 1
fi

# If we have service role key but no direct DB URL, construct one
if [ -z "$SUPABASE_DB_URL" ] && [ -n "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  # Extract host from URL
  SUPABASE_HOST=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed -E 's/https?:\/\/(.*)/\1/')
  
  # Use service role key as password and construct connection string
  SUPABASE_DB_URL="postgres://postgres:${SUPABASE_SERVICE_ROLE_KEY}@${SUPABASE_HOST}:5432/postgres"
  
  echo "Created database URL from service role key and project URL"
fi

# Get SQL file name from arguments or use default
SQL_FILE=${1:-scripts/fix-profiles-relationship.sql}

if [ ! -f "$SQL_FILE" ]; then
  echo "Error: SQL file $SQL_FILE not found"
  echo "Available SQL files:"
  find scripts -name "*.sql" | xargs -n1 basename
  exit 1
fi

echo "==================================="
echo "Running SQL script: $SQL_FILE"
echo "Database: $SUPABASE_DB_URL"
echo "==================================="

# Execute the SQL file directly with psql
# Note: This requires the PostgreSQL client (psql) to be installed
psql "$SUPABASE_DB_URL" -f "$SQL_FILE"

exit_status=$?

if [ $exit_status -eq 0 ]; then
  echo "==================================="
  echo "SQL execution completed successfully!"
  echo "==================================="
else
  echo "==================================="
  echo "SQL execution encountered errors. Exit code: $exit_status"
  echo "==================================="
fi

exit $exit_status
