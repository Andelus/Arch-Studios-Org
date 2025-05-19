-- Migration: Create notifications table for in-app notifications
-- This replaces the email-based notification system with in-app notifications
-- Used for team invitations, system alerts, and other user notifications

-- Create notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  email TEXT, -- For users who haven't registered yet
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add foreign key constraint for user_id
  CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_email ON notifications(email);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Create row level security policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (
    auth.uid() = user_id OR
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Policy to allow authenticated users to update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy to allow system/admin to create notifications
CREATE POLICY "Admin/system can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    -- Either the notification is for the current user
    auth.uid() = user_id OR
    -- Or the user has admin privileges (check admin role in auth.users metadata)
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy to allow users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Grant necessary privileges to authenticated users
GRANT SELECT, UPDATE, DELETE ON notifications TO authenticated;
