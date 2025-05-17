-- Enable uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add auth_uuid column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS auth_uuid UUID UNIQUE DEFAULT uuid_generate_v4();

-- Add index for auth_uuid column
CREATE INDEX IF NOT EXISTS idx_profiles_auth_uuid ON profiles(auth_uuid);

-- Backfill auth_uuid for existing users
-- This will generate a new UUID for each existing user that doesn't have one
UPDATE profiles 
SET auth_uuid = uuid_generate_v4() 
WHERE auth_uuid IS NULL;

-- Update RLS policies to use auth_uuid
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.jwt()->>'sub' = auth_uuid::text);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.jwt()->>'sub' = auth_uuid::text)
    WITH CHECK (auth.jwt()->>'sub' = auth_uuid::text);

-- Update RLS policies for related tables to use auth_uuid through joins
DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;
CREATE POLICY "Users can view own transactions"
    ON credit_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = credit_transactions.user_id
            AND profiles.auth_uuid::text = auth.jwt()->>'sub'
        )
    );

DROP POLICY IF EXISTS "Users can view own payments" ON payment_transactions;
CREATE POLICY "Users can view own payments"
    ON payment_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = payment_transactions.user_id
            AND profiles.auth_uuid::text = auth.jwt()->>'sub'
        )
    );

DROP POLICY IF EXISTS "Users can view own subscription periods" ON subscription_periods;
CREATE POLICY "Users can view own subscription periods"
    ON subscription_periods FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = subscription_periods.user_id
            AND profiles.auth_uuid::text = auth.jwt()->>'sub'
        )
    );

-- Update user_assets policies to use auth_uuid
DROP POLICY IF EXISTS "Users can view their own assets" ON user_assets;
DROP POLICY IF EXISTS "Users can insert their own assets" ON user_assets;
DROP POLICY IF EXISTS "Users can update their own assets" ON user_assets;
DROP POLICY IF EXISTS "Users can delete their own assets" ON user_assets;

CREATE POLICY "Users can view their own assets" ON user_assets
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = user_assets.user_id
            AND profiles.auth_uuid::text = auth.jwt()->>'sub'
        )
    );

CREATE POLICY "Users can insert their own assets" ON user_assets
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = user_id
            AND profiles.auth_uuid::text = auth.jwt()->>'sub'
        )
    );

CREATE POLICY "Users can update their own assets" ON user_assets
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = user_assets.user_id
            AND profiles.auth_uuid::text = auth.jwt()->>'sub'
        )
    );

CREATE POLICY "Users can delete their own assets" ON user_assets
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = user_assets.user_id
            AND profiles.auth_uuid::text = auth.jwt()->>'sub'
        )
    );