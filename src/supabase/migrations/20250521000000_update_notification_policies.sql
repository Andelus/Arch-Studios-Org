-- Update notification policies to fix auth issues
-- This addresses the 401 Unauthorized error that can occur due to auth token format mismatch

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
