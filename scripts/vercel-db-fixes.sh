#!/bin/bash
# Script to fix project creation and authentication issues (Vercel-friendly version)
echo "Fixing project creation and authentication issues..."

# Validate environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables"
  exit 1
fi

# Extract project reference from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed -E 's/https:\/\/([^.]+).supabase.co/\1/')
echo "Supabase Project Reference: $PROJECT_REF"

# Create SQL fixes
SQL_FIXES=$(cat <<'EOL'
-- Fix 1: Add columns to project_members to avoid joining with profiles
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS sender_email TEXT;

-- Update project_members table to store user email
UPDATE project_members
SET sender_email = email
WHERE sender_email IS NULL;

-- Set the sender_name to email if it's NULL
UPDATE project_members
SET sender_name = email
WHERE sender_email IS NOT NULL 
AND sender_name IS NULL;

-- Fix 2: Ensure foreign key exists between project_members and projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'project_members'
      AND ccu.table_name = 'projects'
      AND ccu.column_name = 'id'
  ) THEN
    ALTER TABLE project_members
    ADD CONSTRAINT fk_project_members_project
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Create helpful indexes
CREATE INDEX IF NOT EXISTS idx_project_members_sender_email ON project_members(sender_email);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_id ON projects(id);

-- Fix 3: Update notification RLS policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (
    (auth.uid()::TEXT = user_id::TEXT) OR 
    (email IS NOT NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );
EOL
)

# Apply SQL fixes
echo "Applying SQL fixes to Supabase..."
curl -s -X POST "https://api.supabase.com/v1/sql" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"ref\": \"$PROJECT_REF\", \"query\": $(echo "$SQL_FIXES" | sed 's/"/\\"/g' | tr '\n' ' ')}" > /dev/null

echo ""
echo "✅ All fixes have been applied successfully!"
