-- Convert user_assets table to use UUID for user_id
BEGIN;

-- Add temporary UUID column
ALTER TABLE user_assets ADD COLUMN temp_user_id UUID;

-- Update the temporary column with UUID values from profiles table
UPDATE user_assets ua 
SET temp_user_id = p.id::UUID
FROM profiles p 
WHERE ua.user_id = p.id
AND ua.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Create new table with UUID column
CREATE TABLE user_assets_new (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('image', '3d', 'multi_view')),
    asset_url TEXT NOT NULL,
    prompt TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Copy data to new table
INSERT INTO user_assets_new 
SELECT 
    id,
    temp_user_id,
    asset_type,
    asset_url,
    prompt,
    created_at,
    metadata
FROM user_assets
WHERE temp_user_id IS NOT NULL;

-- Drop old table and rename new one
DROP TABLE user_assets;
ALTER TABLE user_assets_new RENAME TO user_assets;

-- Add foreign key constraint
ALTER TABLE user_assets 
ADD CONSTRAINT user_assets_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Recreate indices
CREATE INDEX user_assets_user_id_idx ON user_assets(user_id);
CREATE INDEX user_assets_asset_type_idx ON user_assets(asset_type);

-- Update RLS policies to use UUID comparison
DROP POLICY IF EXISTS "Users can view their own assets" ON user_assets;
CREATE POLICY "Users can view their own assets"
    ON user_assets FOR SELECT
    USING (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Users can insert their own assets" ON user_assets;
CREATE POLICY "Users can insert their own assets"
    ON user_assets FOR INSERT
    WITH CHECK (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Users can update their own assets" ON user_assets;
CREATE POLICY "Users can update their own assets"
    ON user_assets FOR UPDATE
    USING (auth.uid()::uuid = user_id)
    WITH CHECK (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Users can delete their own assets" ON user_assets;
CREATE POLICY "Users can delete their own assets"
    ON user_assets FOR DELETE
    USING (auth.uid()::uuid = user_id);

-- Add trigger for maintaining asset limits
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

COMMIT;
