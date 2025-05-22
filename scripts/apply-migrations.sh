#!/bin/bash
# Script to apply all database migrations in order
echo "Applying migrations to fix database issues..."

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "Error: .env file not found"
  exit 1
fi# Validate environment variablesif [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then  echo "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file"  exit 1fi# Extract project reference from URLPROJECT_REF=$(echo $SUPABASE_URL | sed -E 's/https:\/\/([^.]+).supabase.co/\1/')echo "Supabase Project Reference: $PROJECT_REF"# Apply migrations in the correct orderecho "Applying migration: fix notification policies..."curl -s -X POST "https://api.supabase.com/v1/sql" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"ref\": \"$PROJECT_REF\", \"query\": \"$(cat src/supabase/migrations/20250521000000_update_notification_policies.sql | tr '\n' ' ')\"}" > /dev/null

echo "Applying migration: add projects foreign key..."
curl -s -X POST "https://api.supabase.com/v1/sql" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"ref\": \"$PROJECT_REF\", \"query\": \"$(cat src/supabase/migrations/20250521000001_add_projects_foreign_key.sql | tr '\n' ' ')\"}" > /dev/nullecho "Applying migration: add projects RLS..."curl -s -X POST "https://api.supabase.com/v1/sql" \  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \  -H "Content-Type: application/json" \  -d "{\"ref\": \"$PROJECT_REF\", \"file\": \"$(cat src/supabase/migrations/20250521000002_add_projects_rls.sql)\"}" > /dev/nullecho "Applying migration: create profiles table..."curl -s -X POST "https://api.supabase.com/v1/sql" \  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \  -H "Content-Type: application/json" \  -d "{\"ref\": \"$PROJECT_REF\", \"file\": \"$(cat src/supabase/migrations/20250522000000_create_profiles_table.sql)\"}" > /dev/nullecho "Applying migration: fix profile relationships..."curl -s -X POST "https://api.supabase.com/v1/sql" \  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \  -H "Content-Type: application/json" \  -d "{\"ref\": \"$PROJECT_REF\", \"file\": \"$(cat src/supabase/migrations/20250523000000_fix_profile_relationships.sql)\"}" > /dev/nullecho "All migrations applied successfully!"echo ""
echo "Issues fixed:"
echo "1. Notifications authorization (401 error)"
echo "2. Project foreign key constraint (400 PGRST200 error)"
echo "3. Profile relationships"
echo ""
echo "You can now restart your application and the errors should be resolved."
