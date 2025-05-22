-- Fix for 401 Unauthorized error - Update notification policies to handle auth token format mismatch

-- First, drop the existing policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Admin/system can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

-- Recreate policies with more flexible auth checks that work with Clerk JWT format
-- Policy to allow users to read their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (
    (auth.uid()::TEXT = user_id::TEXT) OR
    (email IS NOT NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Policy to allow authenticated users to update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid()::TEXT = user_id::TEXT)
  WITH CHECK (auth.uid()::TEXT = user_id::TEXT);

-- Policy to allow system/admin to create notifications
CREATE POLICY "Admin/system can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    -- Either the notification is for the current user
    auth.uid()::TEXT = user_id::TEXT OR
    -- Or the user has admin privileges (check admin role in auth.users metadata)
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND (raw_user_meta_data->>'role' = 'admin' OR raw_user_meta_data->>'isAdmin' = 'true')
    )
  );

-- Policy to allow users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (auth.uid()::TEXT = user_id::TEXT);

-- Fix for 400 PGRST200 error - Create foreign key between project_members.project_id and projects.id

-- First, check if the projects table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) THEN
    -- Create the projects table if it doesn't exist
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      organization_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- Now add foreign key constraint to project_members table
-- First, check if we already have a foreign key constraint
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
    -- Add foreign key constraint
    ALTER TABLE project_members
    ADD CONSTRAINT fk_project_members_project
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure there are indexes on both sides of the relationship for better performance
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_id ON projects(id);

-- Add Row Level Security to projects table if not already enabled
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Project admins can update their projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;
DROP POLICY IF EXISTS "Project admins can delete their projects" ON projects;

-- Policy to allow users to view projects they are members of
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()::TEXT
    )
  );

-- Policy to allow project admins to update their projects
CREATE POLICY "Project admins can update their projects"
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
CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy to allow project admins to delete their projects
CREATE POLICY "Project admins can delete their projects"
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

-- Fix for profile relationships - Add columns to store user information directly

-- Add the necessary columns to project_members table if they don't exist
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS sender_email TEXT;

-- Add similar columns to messages table if they don't exist
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_email TEXT;

-- Add similar columns to tasks table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    EXECUTE 'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_name TEXT';
    EXECUTE 'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_email TEXT';
  ELSE
    RAISE NOTICE 'Skipping tasks table modifications as it does not exist';
  END IF;
END
$$;

-- Update project_members table to store user email
UPDATE project_members
SET sender_email = email
WHERE sender_email IS NULL;

-- Check if we need to migrate any data from profiles to project_members
DO $$
BEGIN
  -- Instead of trying to join on a possibly non-existent column,
  -- let's be more cautious about profile data
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles'
  ) AND EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'display_name'
  ) THEN
    -- Update existing records if display_name column exists
    EXECUTE '
      UPDATE project_members
      SET sender_name = p.display_name
      FROM profiles p
      WHERE p.email = project_members.email
      AND project_members.sender_name IS NULL
    ';
  ELSE
    -- If profiles table doesn't exist or doesn't have display_name column,
    -- use email as fallback for sender_name
    UPDATE project_members
    SET sender_name = email
    WHERE sender_email IS NOT NULL 
    AND sender_name IS NULL;
  END IF;
END
$$;

-- Create indexes for project_members and messages
CREATE INDEX IF NOT EXISTS idx_project_members_sender_email ON project_members(sender_email);
CREATE INDEX IF NOT EXISTS idx_messages_sender_email ON messages(sender_email);

-- Create index on tasks table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tasks_assignee_email ON tasks(assignee_email)';
  END IF;
END
$$;
