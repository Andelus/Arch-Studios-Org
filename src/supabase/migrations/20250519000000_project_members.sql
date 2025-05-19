-- Create project_members table for managing project team members
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id TEXT NOT NULL, -- Using TEXT to match string project IDs like "proj-1"
  user_id TEXT NOT NULL, -- Using TEXT to match string user IDs like "user-1"
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('admin', 'editor', 'viewer')),
  status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'away')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by TEXT -- ID of the user who invited this member
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS project_members_project_id_idx ON project_members(project_id);
CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON project_members(user_id);
CREATE INDEX IF NOT EXISTS project_members_email_idx ON project_members(email);
CREATE INDEX IF NOT EXISTS project_members_status_idx ON project_members(status);

-- Add composite unique constraint to prevent duplicate user in project
CREATE UNIQUE INDEX project_members_project_user_idx ON project_members(project_id, user_id);

-- Enable Row Level Security
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view project members of projects they belong to
CREATE POLICY "Users can view members of their projects"
  ON project_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members AS pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()::TEXT
    )
  );

-- Policy to allow project admins to create new members
CREATE POLICY "Project admins can add members"
  ON project_members FOR INSERT
  WITH CHECK (
    auth.uid()::TEXT = invited_by AND
    EXISTS (
      SELECT 1 FROM project_members AS pm
      WHERE pm.project_id = project_members.project_id 
      AND pm.user_id = auth.uid()::TEXT
      AND pm.permission = 'admin'
    )
  );

-- Policy to allow project admins to update members
CREATE POLICY "Project admins can update any member"
  ON project_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members AS pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()::TEXT
      AND pm.permission = 'admin'
    )
  );

-- Policy to allow users to update their own records
CREATE POLICY "Users can update their own records"
  ON project_members FOR UPDATE
  USING (
    user_id = auth.uid()::TEXT
  );

-- Policy to allow project admins to remove members
CREATE POLICY "Project admins can remove members"
  ON project_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_members AS pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()::TEXT
      AND pm.permission = 'admin'
    )
  );

-- Grant privileges to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON project_members TO authenticated;

-- Create trigger function to enforce status-only updates for non-admins
CREATE OR REPLACE FUNCTION enforce_status_only_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check if the user is an admin for this project
  SELECT EXISTS (
    SELECT 1 FROM project_members AS pm
    WHERE pm.project_id = NEW.project_id
    AND pm.user_id = auth.uid()::TEXT
    AND pm.permission = 'admin'
  ) INTO is_admin;
  
  -- If user is an admin, allow any changes
  IF is_admin THEN
    RETURN NEW;
  END IF;
  
  -- If not admin and trying to change fields other than status/last_active_at, revert those changes
  IF OLD.user_id = auth.uid()::TEXT AND OLD.user_id = NEW.user_id THEN
    -- Only allow status and last_active_at to change
    IF OLD.project_id != NEW.project_id OR
       OLD.email != NEW.email OR
       OLD.role != NEW.role OR
       OLD.permission != NEW.permission OR
       OLD.invited_by != NEW.invited_by THEN
      
      -- Reset the fields back to original values
      NEW.project_id = OLD.project_id;
      NEW.email = OLD.email;
      NEW.role = OLD.role;
      NEW.permission = OLD.permission;
      NEW.invited_by = OLD.invited_by;
      
      -- But allow status update
      -- status and last_active_at can change
    END IF;
    RETURN NEW;
  END IF;
  
  -- If user is trying to update someone else's record and is not admin
  IF OLD.user_id != auth.uid()::TEXT THEN
    RETURN OLD; -- Reject the change
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce permissions on user status updates
CREATE TRIGGER enforce_status_updates_trigger
BEFORE UPDATE ON project_members
FOR EACH ROW
EXECUTE FUNCTION enforce_status_only_updates();

-- Create trigger function to set updated_at on status change
CREATE OR REPLACE FUNCTION set_updated_at_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status <> NEW.status THEN
    NEW.updated_at = NOW();
    NEW.last_active_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update timestamps on status change
CREATE TRIGGER status_change_timestamp
BEFORE UPDATE ON project_members
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION set_updated_at_on_status_change();

-- Create function to update status based on activity
CREATE OR REPLACE FUNCTION update_member_status_on_activity(user_id_param TEXT, project_id_param TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update member status to online and record the activity time
  UPDATE project_members
  SET 
    status = 'online',
    last_active_at = NOW(),
    updated_at = NOW()
  WHERE 
    user_id = user_id_param AND
    project_id = project_id_param;
END;
$$;

-- Create function to automatically set users to away/offline after inactivity
CREATE OR REPLACE FUNCTION auto_update_inactive_status()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  away_count INTEGER := 0;
  offline_count INTEGER := 0;
  total_count INTEGER;
BEGIN
  -- Set users to "away" if they've been inactive for 10 minutes
  UPDATE project_members
  SET status = 'away', updated_at = NOW()
  WHERE 
    status = 'online' AND 
    last_active_at < NOW() - INTERVAL '10 minutes';
  
  GET DIAGNOSTICS away_count = ROW_COUNT;
  
  -- Set users to "offline" if they've been away for 30 minutes
  UPDATE project_members
  SET status = 'offline', updated_at = NOW()
  WHERE 
    status = 'away' AND 
    last_active_at < NOW() - INTERVAL '30 minutes';
  
  GET DIAGNOSTICS offline_count = ROW_COUNT;
  
  total_count := away_count + offline_count;
  RETURN total_count;
END;
$$;
