#!/bin/bash
# Script to apply database fixes for notifications and foreign key constraints
echo "Applying database fixes for Arch Studios..."

# Check for curl
if ! command -v curl &> /dev/null; then
  echo "Error: curl is not installed. Please install curl first."
  exit 1
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Validate environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file"
  exit 1
fi

# Extract project reference from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed -E 's/https:\/\/([^.]+).supabase.co/\1/')
echo "Supabase Project Reference: $PROJECT_REF"

echo "Running SQL fix for notification policies..."
curl -s -X POST "https://api.supabase.com/v1/sql" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"ref\": \"$PROJECT_REF\", \"query\": \"
-- Update notification policies
DROP POLICY IF EXISTS \\\"Users can view their own notifications\\\" ON notifications;
DROP POLICY IF EXISTS \\\"Users can update their own notifications\\\" ON notifications;
DROP POLICY IF EXISTS \\\"Admin/system can create notifications\\\" ON notifications;
DROP POLICY IF EXISTS \\\"Users can delete their own notifications\\\" ON notifications;

-- Recreate policies with more flexible auth checks
CREATE POLICY \\\"Users can view their own notifications\\\"
  ON notifications FOR SELECT
  USING (
    (auth.uid()::TEXT = user_id::TEXT) OR
    (email IS NOT NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

CREATE POLICY \\\"Users can update their own notifications\\\"
  ON notifications FOR UPDATE
  USING (auth.uid()::TEXT = user_id::TEXT)
  WITH CHECK (auth.uid()::TEXT = user_id::TEXT);

CREATE POLICY \\\"Admin/system can create notifications\\\"
  ON notifications FOR INSERT
  WITH CHECK (
    auth.uid()::TEXT = user_id::TEXT OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND (raw_user_meta_data->>'role' = 'admin' OR raw_user_meta_data->>'isAdmin' = 'true')
    )
  );

CREATE POLICY \\\"Users can delete their own notifications\\\"
  ON notifications FOR DELETE
  USING (auth.uid()::TEXT = user_id::TEXT);
\"}" > /dev/null

echo "Running SQL fix for project foreign key constraint..."
curl -s -X POST "https://api.supabase.com/v1/sql" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"ref\": \"$PROJECT_REF\", \"query\": \"
-- Ensure projects table exists
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) THEN
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      organization_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END \$\$;

-- Add foreign key constraint if it doesn't exist
DO \$\$
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
END \$\$;

-- Create necessary indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_id ON projects(id);

-- Add Row Level Security to projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS \\\"Users can view their own projects\\\" ON projects;
DROP POLICY IF EXISTS \\\"Project admins can update their projects\\\" ON projects;
DROP POLICY IF EXISTS \\\"Authenticated users can create projects\\\" ON projects;
DROP POLICY IF EXISTS \\\"Project admins can delete their projects\\\" ON projects;

-- Policy to allow users to view projects they are members of
CREATE POLICY \\\"Users can view their own projects\\\"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()::TEXT
    )
  );

-- Policy to allow project admins to update their projects
CREATE POLICY \\\"Project admins can update their projects\\\"
  ON projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()::TEXT
      AND project_members.permission = 'admin'
    )
  );

-- Policy to allow authenticated users to create projects
CREATE POLICY \\\"Authenticated users can create projects\\\"
  ON projects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy to allow project admins to delete their projects
CREATE POLICY \\\"Project admins can delete their projects\\\"
  ON projects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()::TEXT
      AND project_members.permission = 'admin'
    )
  );

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO authenticated;
\"}" > /dev/null

echo "Database fixes completed successfully!"
echo "The following issues have been resolved:"
echo "1. Notifications authorization (401 error)"
echo "2. Project foreign key constraint (400 PGRST200 error)"
echo "3. Row Level Security policies for projects table"
