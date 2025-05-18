-- Complete Arch Studios Database Schema
-- Created: May 18, 2025
-- This file combines all schema and migration files into a single deployment script

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- *******************************************************************
-- CLEAN UP - Drop existing tables and functions if they exist
-- *******************************************************************
DROP TABLE IF EXISTS organization_subscription_transactions CASCADE;
DROP TABLE IF EXISTS organization_subscriptions CASCADE;
DROP TABLE IF EXISTS custom_pricing_requests CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS user_assets CASCADE;
DROP TABLE IF EXISTS subscription_periods CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;

DROP FUNCTION IF EXISTS get_organization_usage_statistics CASCADE;
DROP FUNCTION IF EXISTS can_upload_assets CASCADE;
DROP FUNCTION IF EXISTS update_subscription_updated_at CASCADE;
DROP FUNCTION IF EXISTS maintain_user_assets_limit CASCADE;
DROP FUNCTION IF EXISTS handle_payment_verification CASCADE;
DROP FUNCTION IF EXISTS check_subscription_expiry CASCADE;
DROP FUNCTION IF EXISTS handle_subscription_cancellation CASCADE;
DROP FUNCTION IF EXISTS handle_generation_deduction CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS update_organizations_updated_at CASCADE;

-- *******************************************************************
-- CORE TABLES
-- *******************************************************************

-- Create subscription_plans table (kept for backward compatibility but no longer used)
-- New system uses organization_subscriptions instead
CREATE TABLE subscription_plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE, 
    total_credits INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    image_credit_cost INTEGER NOT NULL,
    model_credit_cost INTEGER NOT NULL,
    features JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create organizations table to track organization details
CREATE TABLE organizations (
    id TEXT PRIMARY KEY, -- Organization ID from Clerk
    name TEXT NOT NULL,
    slug TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    settings JSONB DEFAULT '{}'::jsonb
);

-- Create profiles table with UUID
CREATE TABLE profiles (
    id UUID PRIMARY KEY,
    email TEXT,
    credits_balance INTEGER DEFAULT 0,
    auto_buy_enabled BOOLEAN DEFAULT FALSE,
    current_plan_id UUID REFERENCES subscription_plans(id),
    subscription_status TEXT DEFAULT 'TRIAL',
    organization_id TEXT REFERENCES organizations(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_subscription_status CHECK (subscription_status IN ('TRIAL', 'ACTIVE', 'CANCELLED', 'EXPIRED'))
);

-- Create credit_transactions table
CREATE TABLE credit_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    generation_type TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_type CHECK (type IN (
        'INITIAL_TRIAL_CREDIT',
        'TRIAL_IMAGE_GENERATION',
        'TRIAL_MODEL_GENERATION',
        'IMAGE_GENERATION',
        'MODEL_GENERATION',
        'PURCHASE'
    )),
    CONSTRAINT valid_generation_type CHECK (
        generation_type IS NULL OR 
        generation_type IN ('IMAGE', '3D_MODEL')
    )
);

-- Create payment_transactions table
CREATE TABLE payment_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    flutterwave_transaction_id TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'PENDING',
    payment_method TEXT,
    auto_buy BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED'))
);

-- Create subscription_periods table
CREATE TABLE subscription_periods (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES subscription_plans(id),
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    status TEXT DEFAULT 'ACTIVE',
    payment_transaction_id UUID REFERENCES payment_transactions(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN ('ACTIVE', 'CANCELLED', 'EXPIRED'))
);

-- Create user_assets table
CREATE TABLE user_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL, -- Using TEXT to match Clerk user IDs
    asset_type TEXT NOT NULL CHECK (asset_type IN ('image', '3d', 'multi_view')),
    asset_url TEXT NOT NULL,
    prompt TEXT,
    organization_id TEXT REFERENCES organizations(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- *******************************************************************
-- ORGANIZATION SUBSCRIPTION TABLES
-- *******************************************************************

-- Create table for organization subscriptions
CREATE TABLE organization_subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    plan_type TEXT NOT NULL DEFAULT 'unlimited',
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending' NOT NULL,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    last_payment_date TIMESTAMPTZ,
    last_transaction_id UUID,
    storage_limit BIGINT, -- NULL means unlimited
    asset_limit INTEGER, -- NULL means unlimited
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'cancelled', 'expired'))
);

-- Table for tracking subscription transactions
CREATE TABLE organization_subscription_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    tx_ref TEXT UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending' NOT NULL,
    payment_provider_transaction_id TEXT,
    payment_provider_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed'))
);

-- Table for custom pricing requests from organizations
CREATE TABLE custom_pricing_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    team_size TEXT,
    use_case TEXT,
    required_features TEXT[],
    budget_range TEXT,
    additional_info TEXT,
    status TEXT DEFAULT 'received' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN ('received', 'contacted', 'proposal_sent', 'closed'))
);

-- *******************************************************************
-- FUNCTIONS AND TRIGGERS
-- *******************************************************************

-- Updated timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update organization timestamps
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to set updated_at timestamp for subscriptions
CREATE OR REPLACE FUNCTION update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function for maintaining asset limits
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

-- Function for payment verification
CREATE OR REPLACE FUNCTION handle_payment_verification(
    p_user_id UUID,
    p_transaction_id TEXT,
    p_amount NUMERIC,
    p_plan_id UUID,
    p_auto_buy BOOLEAN,
    p_credits INTEGER
) RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_payment_id UUID;
BEGIN
    -- Update profile with new subscription
    UPDATE profiles 
    SET 
        current_plan_id = p_plan_id,
        credits_balance = credits_balance + p_credits,
        subscription_status = 'ACTIVE',
        auto_buy_enabled = p_auto_buy,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Record payment transaction
    INSERT INTO payment_transactions (
        id,
        user_id,
        flutterwave_transaction_id,
        amount,
        currency,
        status,
        auto_buy
    ) VALUES (
        uuid_generate_v4(),
        p_user_id,
        p_transaction_id,
        p_amount,
        'USD',
        'COMPLETED',
        p_auto_buy
    ) RETURNING id INTO v_payment_id;

    -- Create new subscription period
    INSERT INTO subscription_periods (
        user_id,
        plan_id,
        start_date,
        end_date,
        status,
        payment_transaction_id
    ) VALUES (
        p_user_id,
        p_plan_id,
        NOW(),
        NOW() + INTERVAL '1 month',
        'ACTIVE',
        v_payment_id
    );

    -- Record credit transaction
    INSERT INTO credit_transactions (
        user_id,
        amount,
        type,
        description
    ) VALUES (
        p_user_id,
        p_credits,
        'PURCHASE',
        'Credits from subscription plan purchase'
    );
END;
$$;

-- Function to check and update expired subscriptions
CREATE OR REPLACE FUNCTION check_subscription_expiry()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- If subscription period has ended, mark it as expired
    IF NEW.end_date < NOW() AND NEW.status = 'ACTIVE' THEN
        NEW.status := 'EXPIRED';
        
        -- Also update the user's profile subscription status
        UPDATE profiles
        SET 
            subscription_status = 'EXPIRED',
            current_plan_id = NULL,
            updated_at = NOW()
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

-- Function to handle subscription cancellation
CREATE OR REPLACE FUNCTION handle_subscription_cancellation(
    p_user_id UUID
) RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- Update current subscription period to cancelled
    UPDATE subscription_periods
    SET 
        status = 'CANCELLED',
        updated_at = NOW()
    WHERE 
        user_id = p_user_id 
        AND status = 'ACTIVE';

    -- Update user profile
    UPDATE profiles
    SET 
        subscription_status = 'CANCELLED',
        current_plan_id = NULL,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$;

-- Function to handle credit deductions for generation
CREATE OR REPLACE FUNCTION handle_generation_deduction(
    p_user_id UUID,
    p_generation_type TEXT,
    p_description TEXT DEFAULT NULL
) RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_credit_cost INTEGER;
    v_current_balance INTEGER;
    v_transaction_type TEXT;
BEGIN
    -- Get user's current profile and subscription details
    SELECT 
        p.credits_balance,
        CASE 
            WHEN p_generation_type = 'IMAGE' THEN COALESCE(sp.image_credit_cost, 10)
            WHEN p_generation_type = '3D_MODEL' THEN COALESCE(sp.model_credit_cost, 10)
        END,
        CASE 
            WHEN p.subscription_status = 'TRIAL' THEN 
                CASE 
                    WHEN p_generation_type = 'IMAGE' THEN 'TRIAL_IMAGE_GENERATION'
                    ELSE 'TRIAL_MODEL_GENERATION'
                END
            ELSE
                CASE 
                    WHEN p_generation_type = 'IMAGE' THEN 'IMAGE_GENERATION'
                    ELSE 'MODEL_GENERATION'
                END
        END
    INTO v_current_balance, v_credit_cost, v_transaction_type
    FROM profiles p
    LEFT JOIN subscription_plans sp ON p.current_plan_id = sp.id
    WHERE p.id = p_user_id;

    -- Check if user has enough credits
    IF v_current_balance < v_credit_cost THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;

    -- Deduct credits
    UPDATE profiles
    SET 
        credits_balance = credits_balance - v_credit_cost,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Record transaction
    INSERT INTO credit_transactions (
        user_id,
        amount,
        type,
        generation_type,
        description
    ) VALUES (
        p_user_id,
        -v_credit_cost,
        v_transaction_type,
        p_generation_type,
        COALESCE(p_description, p_generation_type || ' generation')
    );

    RETURN v_credit_cost;
END;
$$;

-- Function for getting organization usage statistics
CREATE OR REPLACE FUNCTION get_organization_usage_statistics(org_id TEXT)
RETURNS TABLE(
    totalAssets BIGINT,
    totalStorageUsed BIGINT,
    lastUpdated TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS totalAssets,
        COALESCE(SUM(
            CASE
                WHEN metadata->>'fileSize' IS NOT NULL 
                THEN (metadata->>'fileSize')::BIGINT
                ELSE 1048576 -- Default 1MB if size not available
            END
        ), 0)::BIGINT AS totalStorageUsed,
        NOW() AS lastUpdated
    FROM
        user_assets
    WHERE
        organization_id = org_id;
END;
$$ LANGUAGE plpgsql;

-- Function for usage validation
CREATE OR REPLACE FUNCTION can_upload_assets(org_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_limit INTEGER;
    v_current BIGINT;
BEGIN
    -- Get the asset limit from the subscription
    SELECT asset_limit INTO v_limit
    FROM organization_subscriptions
    WHERE organization_id = org_id AND status = 'active'
    ORDER BY current_period_end DESC
    LIMIT 1;
    
    -- If no limit (NULL) or no active subscription, allow uploads
    IF v_limit IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Count current assets
    SELECT COUNT(*) INTO v_current
    FROM user_assets
    WHERE organization_id = org_id;
    
    -- Return true if under limit, false otherwise
    RETURN v_current < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Add stored procedure for atomic image generation transaction
CREATE OR REPLACE FUNCTION process_image_generation(
    p_user_id TEXT,
    p_credit_cost INT,
    p_is_trial BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update credits balance and record transaction in a single transaction
    UPDATE profiles 
    SET credits_balance = credits_balance - p_credit_cost
    WHERE id = p_user_id::UUID;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    INSERT INTO credit_transactions (
        user_id,
        amount,
        type,
        generation_type,
        description,
        created_at
    ) VALUES (
        p_user_id::UUID,
        -p_credit_cost,
        CASE WHEN p_is_trial THEN 'TRIAL_IMAGE_GENERATION' ELSE 'IMAGE_GENERATION' END,
        'IMAGE',
        'Image generation',
        NOW()
    );
END;
$$;

-- Add stored procedure for atomic credit deduction and transaction logging
CREATE OR REPLACE FUNCTION deduct_credits_and_log(
    p_user_id TEXT,
    p_credit_amount INTEGER,
    p_transaction_type TEXT,
    p_generation_type TEXT,
    p_description TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Perform credit deduction and transaction logging in a single transaction
    UPDATE profiles 
    SET credits_balance = credits_balance - p_credit_amount
    WHERE id = p_user_id::UUID;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    -- Record the transaction
    INSERT INTO credit_transactions (
        user_id,
        amount,
        type,
        generation_type,
        description,
        created_at
    ) VALUES (
        p_user_id::UUID,
        -p_credit_amount,
        p_transaction_type,
        p_generation_type,
        p_description,
        NOW()
    );

    -- Check if credits are running low and auto-buy is enabled
    DECLARE
        v_auto_buy BOOLEAN;
        v_current_balance INTEGER;
    BEGIN
        SELECT auto_buy_enabled, credits_balance
        INTO v_auto_buy, v_current_balance
        FROM profiles
        WHERE id = p_user_id::UUID;

        IF v_auto_buy AND v_current_balance < 500 THEN
            -- Trigger auto-buy process (implement this part based on your auto-buy logic)
            NULL; -- Placeholder for now
        END IF;
    END;
END;
$$;

-- *******************************************************************
-- TRIGGERS
-- *******************************************************************

-- Trigger for subscription expiry
CREATE TRIGGER check_subscription_expiry_trigger
    BEFORE INSERT OR UPDATE ON subscription_periods
    FOR EACH ROW
    EXECUTE FUNCTION check_subscription_expiry();

-- Apply updated_at triggers
CREATE TRIGGER set_timestamp 
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_timestamp 
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_timestamp 
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_timestamp 
    BEFORE UPDATE ON subscription_periods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_organizations_updated_at();

CREATE TRIGGER update_org_subscription_updated_at
    BEFORE UPDATE ON organization_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_updated_at();

CREATE TRIGGER update_org_subscription_tx_updated_at
    BEFORE UPDATE ON organization_subscription_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_updated_at();

CREATE TRIGGER update_custom_pricing_updated_at
    BEFORE UPDATE ON custom_pricing_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_updated_at();

CREATE TRIGGER user_assets_limit_trigger
    BEFORE INSERT ON user_assets
    FOR EACH ROW
    EXECUTE FUNCTION maintain_user_assets_limit();

-- *******************************************************************
-- INDICES
-- *******************************************************************

-- Indices for organizations and organization subscriptions
CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_org_id 
    ON organization_subscriptions(organization_id);
  
CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_status 
    ON organization_subscriptions(status);
  
CREATE INDEX IF NOT EXISTS idx_org_subscription_transactions_org_id 
    ON organization_subscription_transactions(organization_id);
  
CREATE INDEX IF NOT EXISTS idx_custom_pricing_requests_org_id 
    ON custom_pricing_requests(organization_id);

-- Indices for user assets
CREATE INDEX IF NOT EXISTS user_assets_user_id_idx 
    ON user_assets(user_id);

CREATE INDEX IF NOT EXISTS user_assets_asset_type_idx 
    ON user_assets(asset_type);

CREATE INDEX IF NOT EXISTS user_assets_organization_id_idx 
    ON user_assets(organization_id);

-- Indices for better performance
CREATE INDEX idx_profiles_current_plan 
    ON profiles(current_plan_id);

CREATE INDEX idx_credit_transactions_user_id 
    ON credit_transactions(user_id);

CREATE INDEX idx_credit_transactions_type 
    ON credit_transactions(type);

CREATE INDEX idx_credit_transactions_created_at 
    ON credit_transactions(created_at);

CREATE INDEX idx_payment_transactions_user_id 
    ON payment_transactions(user_id);

CREATE INDEX idx_payment_transactions_status 
    ON payment_transactions(status);

CREATE INDEX idx_payment_transactions_created_at 
    ON payment_transactions(created_at);

CREATE INDEX idx_subscription_periods_user_id 
    ON subscription_periods(user_id);

CREATE INDEX idx_subscription_periods_status 
    ON subscription_periods(status);

CREATE INDEX idx_subscription_periods_end_date 
    ON subscription_periods(end_date);

CREATE INDEX idx_subscription_periods_payment_transaction_id 
    ON subscription_periods(payment_transaction_id);

CREATE INDEX idx_subscription_periods_plan_id 
    ON subscription_periods(plan_id);

-- *******************************************************************
-- ROW LEVEL SECURITY POLICIES
-- *******************************************************************

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscription_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_pricing_requests ENABLE ROW LEVEL SECURITY;

-- Subscription plans policies (public readable)
CREATE POLICY "Anyone can view subscription plans"
    ON subscription_plans FOR SELECT
    USING (TRUE);

CREATE POLICY "Only service role can modify plans"
    ON subscription_plans FOR ALL
    WITH CHECK (FALSE);

-- Profiles policies
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid()::UUID = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid()::UUID = id)
    WITH CHECK (auth.uid()::UUID = id);

-- Credit transactions policies
CREATE POLICY "Users can view own transactions"
    ON credit_transactions FOR SELECT
    USING (auth.uid()::UUID = user_id);

CREATE POLICY "Only service role can create transactions"
    ON credit_transactions FOR INSERT
    WITH CHECK (FALSE);

-- Payment transactions policies
CREATE POLICY "Users can view own payments"
    ON payment_transactions FOR SELECT
    USING (auth.uid()::UUID = user_id);

CREATE POLICY "Service role only for payment modifications"
    ON payment_transactions FOR INSERT 
    WITH CHECK (FALSE);

-- Subscription periods policies
CREATE POLICY "Users can view own subscription periods"
    ON subscription_periods FOR SELECT
    USING (auth.uid()::UUID = user_id);

-- User assets policies
CREATE POLICY "Users can view their own assets" 
    ON user_assets FOR SELECT
    USING ((auth.jwt() ->> 'sub')::TEXT = user_id);

CREATE POLICY "Users can insert their own assets" 
    ON user_assets FOR INSERT
    WITH CHECK ((auth.jwt() ->> 'sub')::TEXT = user_id);

CREATE POLICY "Users can update their own assets" 
    ON user_assets FOR UPDATE
    USING ((auth.jwt() ->> 'sub')::TEXT = user_id)
    WITH CHECK ((auth.jwt() ->> 'sub')::TEXT = user_id);

CREATE POLICY "Users can delete their own assets" 
    ON user_assets FOR DELETE
    USING ((auth.jwt() ->> 'sub')::TEXT = user_id);

-- Organization access policies 
CREATE POLICY "Users can view their organization's assets" 
    ON user_assets FOR SELECT 
    USING (
        (auth.jwt() ->> 'sub')::TEXT = user_id OR
        organization_id IN (
            SELECT organization_id 
            FROM profiles 
            WHERE id = auth.uid()::UUID
        )
    );

-- *******************************************************************
-- INITIAL DATA
-- *******************************************************************

-- No need for subscription_plans under the new model

-- Example organization subscription setup (can be used as a template)
-- INSERT INTO organization_subscriptions (
--     organization_id,
--     plan_type,
--     amount,
--     currency,
--     status,
--     current_period_start,
--     current_period_end
-- ) VALUES (
--     '{organization_id}',  -- This should be filled with actual organization ID
--     'unlimited',
--     200.00,
--     'USD',
--     'active',
--     NOW(),
--     NOW() + INTERVAL '1 month'
-- );
