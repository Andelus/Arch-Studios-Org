#!/bin/bash
# filepath: /Users/Shared/VScode/Arch Studios Org/Arch-Studios/scripts/run-all-db-fixes.sh
# This script runs database fixes with the simplified approach (RLS policies only)

set -e  # Exit immediately if a command exits with a non-zero status

echo "==================================="
echo "Running database fixes"
echo "==================================="

# Apply the RLS policy fixes with proper type casting
echo "Applying RLS policy fixes with type casting..."
npm run db:fix-direct-only

# Step 3: Verify the database changes
echo "Step 3: Verifying the fixes..."

# Let's check if we can query the debug_jwt view 
echo "Checking debug_jwt view..."
./scripts/run-sql-direct.sh <(echo "SELECT * FROM debug_jwt LIMIT 1;")

# Check if profiles and project_members relationship works
echo "Checking profiles and project_members relationship..."
./scripts/run-sql-direct.sh <(echo "SELECT pm.id, p.id as profile_id, p.email FROM project_members pm LEFT JOIN profiles p ON pm.user_id = p.id LIMIT 5;")

echo "==================================="
echo "All database fixes completed!"
echo "==================================="
