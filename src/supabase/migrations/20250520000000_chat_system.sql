-- Chat system database schema
-- Created: May 20, 2025

-- Create channels table
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id TEXT NOT NULL, -- References project ID
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Using TEXT to match Clerk user IDs
  content TEXT NOT NULL,
  is_announcement BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb, -- For additional message data like attachments
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create channel_members table to track who has access to private channels
CREATE TABLE IF NOT EXISTS channel_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Using TEXT to match Clerk user IDs
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_channel_state to track read/unread states
CREATE TABLE IF NOT EXISTS user_channel_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Using TEXT to match Clerk user IDs
  last_read_message_id UUID REFERENCES messages(id),
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create message_attachments table for file attachments
CREATE TABLE IF NOT EXISTS message_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create update_updated_at_column function if not exists
CREATE OR REPLACE FUNCTION update_chat_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER set_channels_timestamp
    BEFORE UPDATE ON channels
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at_column();

CREATE TRIGGER set_messages_timestamp
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at_column();

CREATE TRIGGER set_user_channel_states_timestamp
    BEFORE UPDATE ON user_channel_states
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at_column();

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_channels_project_id ON channels(project_id);
CREATE INDEX IF NOT EXISTS idx_channels_organization_id ON channels(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_states_channel_id ON user_channel_states(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_states_user_id ON user_channel_states(user_id);

-- Create unique composite index to prevent duplicate channel members
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_members_unique ON channel_members(channel_id, user_id);

-- Create unique composite index for user channel states
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_channel_states_unique ON user_channel_states(channel_id, user_id);

-- Enable row-level security
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_channel_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for channels
CREATE POLICY "Users can view channels of their organization"
  ON channels FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE profiles.id = auth.uid()::UUID
    )
  );

CREATE POLICY "Project members can create channels"
  ON channels FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = channels.project_id
      AND project_members.user_id = auth.uid()::TEXT
      AND project_members.permission IN ('admin', 'editor')
    )
  );

CREATE POLICY "Project admins can update channels"
  ON channels FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = channels.project_id
      AND project_members.user_id = auth.uid()::TEXT
      AND project_members.permission = 'admin'
    )
  );

CREATE POLICY "Project admins can delete channels"
  ON channels FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = channels.project_id
      AND project_members.user_id = auth.uid()::TEXT
      AND project_members.permission = 'admin'
    )
  );

-- Create RLS policies for messages
CREATE POLICY "Users can view messages in channels they have access to"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channels
      LEFT JOIN channel_members ON channels.id = channel_members.channel_id
      WHERE channels.id = messages.channel_id
      AND (
        channels.is_private = FALSE OR
        channel_members.user_id = auth.uid()::TEXT OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = channels.project_id
          AND project_members.user_id = auth.uid()::TEXT
          AND project_members.permission = 'admin'
        )
      )
      AND EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = channels.project_id
        AND project_members.user_id = auth.uid()::TEXT
      )
    )
  );

CREATE POLICY "Users can create messages in channels they have access to"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channels
      LEFT JOIN channel_members ON channels.id = channel_members.channel_id
      WHERE channels.id = messages.channel_id
      AND (
        channels.is_private = FALSE OR
        channel_members.user_id = auth.uid()::TEXT OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = channels.project_id
          AND project_members.user_id = auth.uid()::TEXT
          AND project_members.permission = 'admin'
        )
      )
      AND EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = channels.project_id
        AND project_members.user_id = auth.uid()::TEXT
      )
    )
  );

CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  USING (
    user_id = auth.uid()::TEXT OR
    EXISTS (
      SELECT 1 FROM channels
      JOIN project_members ON channels.project_id = project_members.project_id
      WHERE channels.id = messages.channel_id
      AND project_members.user_id = auth.uid()::TEXT
      AND project_members.permission = 'admin'
    )
  );

CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  USING (
    user_id = auth.uid()::TEXT OR
    EXISTS (
      SELECT 1 FROM channels
      JOIN project_members ON channels.project_id = project_members.project_id
      WHERE channels.id = messages.channel_id
      AND project_members.user_id = auth.uid()::TEXT
      AND project_members.permission = 'admin'
    )
  );

-- Create RLS policies for channel_members
CREATE POLICY "Project admins can manage channel members"
  ON channel_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM channels
      JOIN project_members ON channels.project_id = project_members.project_id
      WHERE channels.id = channel_members.channel_id
      AND project_members.user_id = auth.uid()::TEXT
      AND project_members.permission = 'admin'
    )
  );

CREATE POLICY "Users can view channel members"
  ON channel_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channels
      LEFT JOIN channel_members cm ON channels.id = cm.channel_id
      WHERE channels.id = channel_members.channel_id
      AND (
        channels.is_private = FALSE OR
        cm.user_id = auth.uid()::TEXT OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = channels.project_id
          AND project_members.user_id = auth.uid()::TEXT
          AND project_members.permission = 'admin'
        )
      )
    )
  );

-- Create RLS policies for user_channel_states
CREATE POLICY "Users can manage their own channel states"
  ON user_channel_states FOR ALL
  USING (user_id = auth.uid()::TEXT);

-- Create RLS policies for message_attachments
CREATE POLICY "Users can view message attachments they have access to"
  ON message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages
      JOIN channels ON messages.channel_id = channels.id
      LEFT JOIN channel_members ON channels.id = channel_members.channel_id
      WHERE messages.id = message_attachments.message_id
      AND (
        channels.is_private = FALSE OR
        channel_members.user_id = auth.uid()::TEXT OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = channels.project_id
          AND project_members.user_id = auth.uid()::TEXT
          AND project_members.permission = 'admin'
        )
      )
      AND EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = channels.project_id
        AND project_members.user_id = auth.uid()::TEXT
      )
    )
  );

CREATE POLICY "Users can create message attachments for their messages"
  ON message_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_attachments.message_id
      AND messages.user_id = auth.uid()::TEXT
    )
  );

CREATE POLICY "Users can delete their own message attachments"
  ON message_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_attachments.message_id
      AND messages.user_id = auth.uid()::TEXT
    )
  );

-- Grant permissions to authenticated users
GRANT ALL ON channels TO authenticated;
GRANT ALL ON messages TO authenticated;
GRANT ALL ON channel_members TO authenticated;
GRANT ALL ON user_channel_states TO authenticated;
GRANT ALL ON message_attachments TO authenticated;

-- Set up Realtime publication for chat tables
BEGIN;
  -- Drop existing publication if it exists
  DROP PUBLICATION IF EXISTS supabase_realtime;
  
  -- Create publication for Realtime
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    channels,
    messages,
    channel_members,
    user_channel_states,
    message_attachments;
COMMIT;

-- Helper function to create default channels for a project
CREATE OR REPLACE FUNCTION create_default_project_channels(
  p_project_id TEXT,
  p_organization_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_general_channel_id UUID;
  v_announcements_channel_id UUID;
BEGIN
  -- Create general channel
  INSERT INTO channels (
    project_id,
    organization_id,
    name,
    description,
    is_private
  ) VALUES (
    p_project_id,
    p_organization_id,
    'general',
    'General discussion for the project',
    FALSE
  )
  RETURNING id INTO v_general_channel_id;
  
  -- Create announcements channel
  INSERT INTO channels (
    project_id,
    organization_id,
    name,
    description,
    is_private
  ) VALUES (
    p_project_id,
    p_organization_id,
    'announcements',
    'Important announcements and updates',
    FALSE
  )
  RETURNING id INTO v_announcements_channel_id;
  
  -- Add welcome message to general channel
  INSERT INTO messages (
    channel_id,
    user_id,
    content,
    is_announcement
  ) VALUES (
    v_general_channel_id,
    'system',
    'Welcome to the new project! This channel is for general discussion.',
    FALSE
  );
END;
$$;
