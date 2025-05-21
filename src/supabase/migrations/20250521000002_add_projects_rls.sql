-- Add Row Level Security to projects table
-- This ensures proper access controls for projects data

-- First, enable Row Level Security on projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

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

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO authenticated;
