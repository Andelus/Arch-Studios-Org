-- Fix for the foreign key relationship between project_members and profiles
-- This addresses the issue with project_members not being able to join with profiles

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
    -- Log that we're skipping tasks table modifications as it doesn't exist
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

-- Create indexes for project_members
CREATE INDEX IF NOT EXISTS idx_project_members_sender_email ON project_members(sender_email);
CREATE INDEX IF NOT EXISTS idx_messages_sender_email ON messages(sender_email);

-- Create index on tasks table if it exists and if it has the assignee_email column
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) AND EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'assignee_email'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tasks_assignee_email ON tasks(assignee_email)';
  ELSE
    RAISE NOTICE 'Skipping creating index on tasks.assignee_email as either the table or column does not exist';
  END IF;
END
$$;
