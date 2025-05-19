-- filepath: /Users/Shared/VScode/Arch Studios Org/Arch-Studios/src/supabase/migrations/20250519100000_team_invitations.sql
-- Create team_invitations table for managing project invitations
-- This migration should run after the project_members table is created
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY,
  project_id TEXT NOT NULL, -- Using TEXT to match string project IDs like "proj-1"
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('admin', 'editor', 'viewer')),
  inviter_id TEXT NOT NULL, -- Using TEXT to match string user IDs like "user-1" 
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS team_invitations_email_idx ON team_invitations(email);
CREATE INDEX IF NOT EXISTS team_invitations_status_idx ON team_invitations(status);
CREATE INDEX IF NOT EXISTS team_invitations_project_id_idx ON team_invitations(project_id);
CREATE INDEX IF NOT EXISTS team_invitations_inviter_id_idx ON team_invitations(inviter_id);

-- Add partial index to prevent duplicate pending invitations for the same email in the same project
-- Using a partial index instead of a constraint with WHERE clause
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_invitation_idx 
ON team_invitations (project_id, email) 
WHERE status = 'pending';

-- Enable Row Level Security
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Policy to allow project admins to create invitations
CREATE POLICY "Project admins can create invitations"
  ON team_invitations FOR INSERT
  WITH CHECK (
    inviter_id = auth.uid()::TEXT AND
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = team_invitations.project_id
      AND user_id = auth.uid()::TEXT
      AND permission = 'admin'
    )
  );

-- Policy to allow users to view invitations for their email
CREATE POLICY "Users can view invitations addressed to them"
  ON team_invitations FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
    inviter_id = auth.uid()::TEXT OR
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = team_invitations.project_id
      AND user_id = auth.uid()::TEXT
      AND permission = 'admin'
    )
  );

-- Policy to allow project admins to update invitations
CREATE POLICY "Project admins can update invitations"
  ON team_invitations FOR UPDATE
  USING (
    inviter_id = auth.uid()::TEXT OR
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = team_invitations.project_id
      AND user_id = auth.uid()::TEXT
      AND permission = 'admin'
    )
  );

-- Policy to allow project admins to delete/revoke invitations
CREATE POLICY "Project admins can delete invitations"
  ON team_invitations FOR DELETE
  USING (
    inviter_id = auth.uid()::TEXT OR
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = team_invitations.project_id
      AND user_id = auth.uid()::TEXT
      AND permission = 'admin'
    )
  );

-- Grant privileges to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON team_invitations TO authenticated;

-- Create stored procedure to accept invitations
CREATE OR REPLACE FUNCTION accept_team_invitation(invitation_token UUID, user_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inv RECORD;
BEGIN
  -- Get the invitation
  SELECT * INTO inv FROM team_invitations 
  WHERE id = invitation_token;
  
  -- Check if invitation exists  
  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  
  -- Check if invitation already accepted
  IF inv.status = 'accepted' THEN
    RAISE EXCEPTION 'Invitation has already been accepted';
  END IF;
  
  -- Check if invitation expired
  IF inv.status = 'expired' OR inv.expires_at <= NOW() THEN
    -- Update status if it's pending but has expired
    IF inv.status = 'pending' THEN
      UPDATE team_invitations
      SET status = 'expired'
      WHERE id = invitation_token;
    END IF;
    
    RAISE EXCEPTION 'Invitation has expired';
  END IF;
  
  -- Update invitation status
  UPDATE team_invitations
  SET status = 'accepted', accepted_at = NOW()
  WHERE id = invitation_token;
  
  -- Add user to the project team
  -- Note: This assumes you have a project_members table with appropriate structure
  -- Make sure user_id is in the expected format for project_members table
  BEGIN
    INSERT INTO project_members (project_id, user_id, email, role, permission, status)
    VALUES (
      inv.project_id, 
      user_id, -- Ensure this matches the expected type in project_members table
      inv.email,
      inv.role,
      inv.permission,
      'online' -- New users start as online
    )
    ON CONFLICT (project_id, user_id) 
    DO UPDATE SET
      role = EXCLUDED.role,
      permission = EXCLUDED.permission,
      status = 'online';
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the whole operation
    RAISE WARNING 'Failed to add user to project_members: %', SQLERRM;
  END;
END;
$$;

-- Function to count pending invitations for a project
CREATE OR REPLACE FUNCTION count_pending_invitations(project_id_param TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invitation_count 
  FROM team_invitations 
  WHERE project_id = project_id_param 
  AND status = 'pending';
  
  RETURN invitation_count;
END;
$$;

-- Function to expire old invitations (can be run on a schedule)
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE team_invitations
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Create a function to send notification when invitation is accepted
CREATE OR REPLACE FUNCTION notify_invitation_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_name TEXT;
  invitee_email TEXT;
  invitee_name TEXT;
  role TEXT;
  inviter_uuid UUID;
BEGIN
  -- Only proceed if the status changed from 'pending' to 'accepted'
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    -- Try to convert the inviter_id from TEXT to UUID (will raise exception if not valid UUID)
    BEGIN
      inviter_uuid := NEW.inviter_id::UUID;
    EXCEPTION WHEN OTHERS THEN
      -- Log error and exit if conversion fails
      RAISE NOTICE 'Failed to convert inviter_id % to UUID: %', NEW.inviter_id, SQLERRM;
      RETURN NEW;
    END;
    
    -- Get project name from the project table
    SELECT projects.name INTO project_name
    FROM projects
    WHERE projects.id = NEW.project_id;
    
    -- If no project name found, use a default
    IF project_name IS NULL THEN
      project_name := 'a project';
    END IF;
    
    -- Get invitee info if available
    SELECT profiles.display_name INTO invitee_name
    FROM profiles
    WHERE profiles.email = NEW.email;
    
    -- Set email
    invitee_email := NEW.email;
    
    -- Get role
    role := NEW.role;
    
    -- Insert a notification for the inviter
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      link,
      metadata,
      is_read
    ) VALUES (
      inviter_uuid,  -- Use the properly converted UUID
      'invitation_accepted',
      'Invitation Accepted: ' || project_name,
      COALESCE(invitee_name, invitee_email) || ' has accepted your invitation to join ' || project_name || ' as ' || role || '.',
      '/workspace/project/' || NEW.project_id || '/team',
      jsonb_build_object(
        'project_id', NEW.project_id,
        'project_name', project_name,
        'user_email', invitee_email,
        'user_name', invitee_name,
        'role', role
      ),
      FALSE
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger on the team_invitations table
CREATE TRIGGER team_invitation_accepted_trigger
AFTER UPDATE ON team_invitations
FOR EACH ROW
EXECUTE FUNCTION notify_invitation_accepted();
