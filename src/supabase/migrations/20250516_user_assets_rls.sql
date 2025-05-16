-- Enable Row Level Security
ALTER TABLE user_assets ENABLE ROW LEVEL SECURITY;

-- Create policy for selecting assets
-- This allows users to read only their own assets
CREATE POLICY "Users can view their own assets" ON user_assets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for inserting assets
-- This allows users to insert only their own assets
CREATE POLICY "Users can insert their own assets" ON user_assets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy for updating assets
-- This allows users to update only their own assets
CREATE POLICY "Users can update their own assets" ON user_assets
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy for deleting assets
-- This allows users to delete only their own assets
CREATE POLICY "Users can delete their own assets" ON user_assets
  FOR DELETE
  USING (auth.uid() = user_id);
