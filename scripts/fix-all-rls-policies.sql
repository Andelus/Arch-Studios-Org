-- Comprehensive fix for JWT claim issues between Clerk and Supabase
-- This script updates ALL row-level security policies to properly handle Clerk JWT claims

-- =================================================================
-- STEP 1: Update notification policies
-- =================================================================

-- First, drop the existing notification policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Admin/system can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

-- Recreate notification policies with more flexible auth checks that work with Clerk JWT format
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (
    (auth.uid()::TEXT = user_id::TEXT) OR 
    (auth.jwt() ->> 'supabase_user_id')::TEXT = user_id::TEXT OR
    (email IS NOT NULL AND email = (auth.jwt() ->> 'email'))
  );

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING ((auth.uid()::TEXT = user_id::TEXT) OR (auth.jwt() ->> 'supabase_user_id')::TEXT = user_id::TEXT)
  WITH CHECK ((auth.uid()::TEXT = user_id::TEXT) OR (auth.jwt() ->> 'supabase_user_id')::TEXT = user_id::TEXT);

CREATE POLICY "Admin/system can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    -- Either the notification is for the current user
    (auth.uid()::TEXT = user_id::TEXT) OR 
    (auth.jwt() ->> 'supabase_user_id')::TEXT = user_id::TEXT OR
    -- Or the user has admin privileges
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() 
      AND (
        raw_user_meta_data->>'role' = 'admin' OR 
        raw_user_meta_data->>'isAdmin' = 'true'
      )
    ) OR
    -- Or we're using the service role
    auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING ((auth.uid()::TEXT = user_id::TEXT) OR (auth.jwt() ->> 'supabase_user_id')::TEXT = user_id::TEXT);

-- =================================================================
-- STEP 2: Update project-related policies
-- =================================================================

-- First, drop existing project policies
DROP POLICY IF EXISTS "Users can view projects they are members of" ON projects;
DROP POLICY IF EXISTS "Project admins can update their projects" ON projects;
DROP POLICY IF EXISTS "Project admins can delete their projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;

-- Recreate project policies with flexible auth checks
CREATE POLICY "Users can view projects they are members of"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
      AND (
        project_members.user_id = (auth.uid())::TEXT OR
        project_members.user_id = (auth.jwt() ->> 'supabase_user_id')::TEXT
      )
    )
  );

CREATE POLICY "Project admins can update their projects"
  ON projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
      AND project_members.permission = 'admin'
      AND (
        project_members.user_id = (auth.uid())::TEXT OR
        project_members.user_id = (auth.jwt() ->> 'supabase_user_id')::TEXT
      )
    )
  );

CREATE POLICY "Project admins can delete their projects"
  ON projects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
      AND project_members.permission = 'admin'
      AND (
        project_members.user_id = (auth.uid())::TEXT OR
        project_members.user_id = (auth.jwt() ->> 'supabase_user_id')::TEXT
      )
    )
  );

CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- =================================================================
-- STEP 3: Update project member policies
-- =================================================================

DROP POLICY IF EXISTS "Users can view their project memberships" ON project_members;
DROP POLICY IF EXISTS "Project admins can manage project members" ON project_members;

CREATE POLICY "Users can view their project memberships"
  ON project_members FOR SELECT
  USING (
    user_id = (auth.uid())::TEXT OR
    user_id = (auth.jwt() ->> 'supabase_user_id')::TEXT OR
    EXISTS (
      SELECT 1 FROM project_members AS pm
      WHERE pm.project_id = project_members.project_id
      AND pm.permission = 'admin'
      AND (
        pm.user_id = (auth.uid())::TEXT OR
        pm.user_id = (auth.jwt() ->> 'sub')::TEXT
      )
    )
  );

CREATE POLICY "Project admins can manage project members" 
  ON project_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_members AS pm
      WHERE pm.project_id = project_members.project_id
      AND pm.permission = 'admin'
      AND (
        pm.user_id = (auth.uid())::TEXT OR
        pm.user_id = (auth.jwt() ->> 'supabase_user_id')::TEXT
      )
    )
  );

-- =================================================================
-- STEP 4: Update user assets policies
-- =================================================================

DROP POLICY IF EXISTS "Users can view their own assets" ON user_assets;
DROP POLICY IF EXISTS "Users can insert their own assets" ON user_assets;
DROP POLICY IF EXISTS "Users can update their own assets" ON user_assets;

CREATE POLICY "Users can view their own assets" 
  ON user_assets FOR SELECT
  USING (
    (auth.uid()::TEXT = user_id::TEXT) OR
    (auth.jwt() ->> 'supabase_user_id')::TEXT = user_id::TEXT
  );

CREATE POLICY "Users can insert their own assets" 
  ON user_assets FOR INSERT
  WITH CHECK (
    (auth.uid()::TEXT = user_id::TEXT) OR
    (auth.jwt() ->> 'supabase_user_id')::TEXT = user_id::TEXT
  );

CREATE POLICY "Users can update their own assets" 
  ON user_assets FOR UPDATE
  USING (
    (auth.uid()::TEXT = user_id::TEXT) OR
    (auth.jwt() ->> 'supabase_user_id')::TEXT = user_id::TEXT
  )
  WITH CHECK (
    (auth.uid()::TEXT = user_id::TEXT) OR
    (auth.jwt() ->> 'supabase_user_id')::TEXT = user_id::TEXT
  );

-- =================================================================
-- STEP 5: Add JWT inspection function to help with debugging
-- =================================================================

CREATE OR REPLACE FUNCTION auth.debug_jwt()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'role', auth.role(),
    'uid', auth.uid(),
    'email', auth.jwt() ->> 'email',
    'sub', auth.jwt() ->> 'sub',
    'jwt', auth.jwt()
  );
END;
$$;
