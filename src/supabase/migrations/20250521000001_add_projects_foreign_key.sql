-- Create foreign key relationship between project_members and projects
-- This addresses the 400 PGRST200 error by ensuring referential integrity

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
      organization_id TEXT REFERENCES organizations(id),
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
