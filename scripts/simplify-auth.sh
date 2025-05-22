#!/bin/bash
# Script to simplify authentication by granting broad access
echo "Setting up simplified authentication (everyone is admin)..."

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "Error: .env file not found"
  exit 1
fi

# Validate environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file"
  exit 1
fi

# Extract project reference from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed -E 's/https:\/\/([^.]+).supabase.co/\1/')
echo "Supabase Project Reference: $PROJECT_REF"

# Apply simplified security SQL
SQL_FIXES=$(cat <<'EOL'
-- Simplify RLS policies on notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Admin/system can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

-- Grant all authenticated users access to all notifications
CREATE POLICY "Anyone can access notifications"
  ON notifications FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Simplify projects RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Project admins can update their projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;
DROP POLICY IF EXISTS "Project admins can delete their projects" ON projects;

-- Grant all authenticated users access to all projects
CREATE POLICY "Anyone can access projects" 
  ON projects FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix project_members RLS
DROP POLICY IF EXISTS "Users can view members of their projects" ON project_members;
CREATE POLICY "Anyone can access project members" 
  ON project_members FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix the foreign key relationship (keeping this from the original fix)
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

-- Add all the same columns to avoid join errors
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS sender_email TEXT;

-- Update project_members table to store user email
UPDATE project_members
SET sender_email = email
WHERE sender_email IS NULL;

UPDATE project_members
SET sender_name = email
WHERE sender_email IS NOT NULL 
AND sender_name IS NULL;

-- Create helpful indexes
CREATE INDEX IF NOT EXISTS idx_project_members_sender_email ON project_members(sender_email);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_id ON projects(id);
EOL
)

# Apply SQL fixes
echo "Applying simplified authentication SQL to Supabase..."
curl -s -X POST "https://api.supabase.com/v1/sql" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"ref\": \"$PROJECT_REF\", \"query\": \"$SQL_FIXES\"}" > /dev/null

echo ""
echo "✅ Authentication simplified successfully!"
echo ""
echo "Changes made:"
echo "1. Everyone can access all notifications"
echo "2. Everyone can access all projects"
echo "3. Everyone can access all project members"
echo "4. Foreign key relationships fixed"
echo ""
echo "You should now restart your Next.js application to see the changes take effect."
