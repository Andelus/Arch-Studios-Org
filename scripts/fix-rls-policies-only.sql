-- Modified version that only updates RLS policies without changing column types
-- This script focuses purely on ensuring proper type casting in the policies

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
    (auth.uid() = user_id::UUID) OR 
    (user_id::TEXT = current_setting('request.jwt.claims', true)::json->>'sub') OR
    (email IS NOT NULL AND email = current_setting('request.jwt.claims', true)::json->>'email')
  );

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (
    (auth.uid() = user_id::UUID) OR 
    (user_id::TEXT = current_setting('request.jwt.claims', true)::json->>'sub')
  )
  WITH CHECK (
    (auth.uid() = user_id::UUID) OR 
    (user_id::TEXT = current_setting('request.jwt.claims', true)::json->>'sub')
  );

CREATE POLICY "Admin/system can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    -- Either the notification is for the current user
    (auth.uid() = user_id::UUID) OR 
    (user_id::TEXT = current_setting('request.jwt.claims', true)::json->>'sub') OR
    -- Or we're using the service role
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (
    (auth.uid() = user_id::UUID) OR 
    (user_id::TEXT = current_setting('request.jwt.claims', true)::json->>'sub')
  );

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
        project_members.user_id::UUID = auth.uid() OR
        project_members.user_id::TEXT = current_setting('request.jwt.claims', true)::json->>'sub'
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
        project_members.user_id::UUID = auth.uid() OR
        project_members.user_id::TEXT = current_setting('request.jwt.claims', true)::json->>'sub'
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
        project_members.user_id::UUID = auth.uid() OR
        project_members.user_id::TEXT = current_setting('request.jwt.claims', true)::json->>'sub'
      )
    )
  );

CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'authenticated'
  );

-- =================================================================
-- STEP 3: Create consistent policies for user assets
-- =================================================================

DROP POLICY IF EXISTS "Users can view their own assets" ON user_assets;
DROP POLICY IF EXISTS "Users can insert their own assets" ON user_assets;
DROP POLICY IF EXISTS "Users can update their own assets" ON user_assets;

CREATE POLICY "Users can view their own assets" 
  ON user_assets FOR SELECT
  USING (
    user_id::UUID = auth.uid() OR
    user_id::TEXT = current_setting('request.jwt.claims', true)::json->>'sub'
  );

CREATE POLICY "Users can insert their own assets" 
  ON user_assets FOR INSERT
  WITH CHECK (
    user_id::UUID = auth.uid() OR
    user_id::TEXT = current_setting('request.jwt.claims', true)::json->>'sub'
  );

CREATE POLICY "Users can update their own assets" 
  ON user_assets FOR UPDATE
  USING (
    user_id::UUID = auth.uid() OR
    user_id::TEXT = current_setting('request.jwt.claims', true)::json->>'sub'
  )
  WITH CHECK (
    user_id::UUID = auth.uid() OR
    user_id::TEXT = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- =================================================================
-- STEP 4: Create a view for debugging JWT claims (safer approach)
-- =================================================================

-- Create a view for debugging JWT claims without requiring auth schema access
CREATE OR REPLACE VIEW public.debug_jwt AS
SELECT 
  current_setting('request.jwt.claims', true)::json AS jwt_claims,
  current_setting('request.jwt.claims', true)::json->>'role' AS jwt_role,
  current_setting('request.jwt.claims', true)::json->>'sub' AS jwt_sub,
  current_setting('request.jwt.claims', true)::json->>'email' AS jwt_email;

-- Grant access to the view
GRANT SELECT ON public.debug_jwt TO authenticated;
GRANT SELECT ON public.debug_jwt TO anon;

-- =================================================================
-- STEP 5: Create only a foreign key index (without changing column type)
-- =================================================================

-- Create index to optimize join queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_project_members_user_id_profiles
ON project_members(user_id);
