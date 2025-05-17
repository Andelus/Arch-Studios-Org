-- Drop existing table and related objects if they exist
DROP TABLE IF EXISTS user_assets CASCADE;
DROP FUNCTION IF EXISTS maintain_user_assets_limit CASCADE;

-- Create user_assets table to store generation history
CREATE TABLE IF NOT EXISTS user_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- Changed to TEXT to match Clerk user IDs
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', '3d', 'multi_view')),
  asset_url TEXT NOT NULL,
  prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Add any additional metadata fields you might need
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for faster queries by user_id
CREATE INDEX IF NOT EXISTS user_assets_user_id_idx ON user_assets(user_id);

-- Create index for faster queries by asset_type
CREATE INDEX IF NOT EXISTS user_assets_asset_type_idx ON user_assets(asset_type);

-- Add trigger to maintain maximum 10 assets per user per type
CREATE OR REPLACE FUNCTION maintain_user_assets_limit()
RETURNS TRIGGER AS $$
DECLARE
  assets_count INTEGER;
BEGIN
  -- Count existing assets for this user and type
  SELECT COUNT(*) INTO assets_count
  FROM user_assets
  WHERE user_id = NEW.user_id AND asset_type = NEW.asset_type;
  
  -- If we'll have more than 10 after this insert
  IF assets_count >= 10 THEN
    -- Delete the oldest asset for this user and type
    DELETE FROM user_assets
    WHERE id IN (
      SELECT id FROM user_assets
      WHERE user_id = NEW.user_id AND asset_type = NEW.asset_type
      ORDER BY created_at ASC
      LIMIT 1
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on insert
CREATE TRIGGER user_assets_limit_trigger
BEFORE INSERT ON user_assets
FOR EACH ROW
EXECUTE FUNCTION maintain_user_assets_limit();

-- Enable Row Level Security
ALTER TABLE user_assets ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access (for admin operations)
CREATE POLICY "Service role has full access" ON user_assets
  USING (auth.jwt() IS NULL);

-- Create policy for selecting assets (consistent type handling)
CREATE POLICY "Users can view their own assets" ON user_assets
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Create policy for inserting assets (consistent type handling)
CREATE POLICY "Users can insert their own assets" ON user_assets
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Create policy for updating assets (consistent type handling)
CREATE POLICY "Users can update their own assets" ON user_assets
  FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Create policy for deleting assets (consistent type handling)
CREATE POLICY "Users can delete their own assets" ON user_assets
  FOR DELETE
  USING (auth.uid()::text = user_id);
