-- Update RLS policies for user_assets to use proper UUID comparison
BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own assets" ON user_assets;
DROP POLICY IF EXISTS "Users can insert their own assets" ON user_assets;
DROP POLICY IF EXISTS "Users can update their own assets" ON user_assets;
DROP POLICY IF EXISTS "Users can delete their own assets" ON user_assets;

-- Create new policies using direct text comparison with user_id
CREATE POLICY "Users can view their own assets" ON user_assets
    FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own assets" ON user_assets
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own assets" ON user_assets
    FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own assets" ON user_assets
    FOR DELETE
    USING (auth.uid()::text = user_id);

COMMIT;
