-- Begin transaction
BEGIN;

-- Add temporary UUID columns
ALTER TABLE profiles ADD COLUMN temp_id UUID;
ALTER TABLE credit_transactions ADD COLUMN temp_user_id UUID;
ALTER TABLE payment_transactions ADD COLUMN temp_user_id UUID;
ALTER TABLE subscription_periods ADD COLUMN temp_user_id UUID;

-- Update the temporary columns with UUID values
-- For existing text values that are already UUIDs, we can cast them
UPDATE profiles SET temp_id = id::UUID WHERE id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
UPDATE credit_transactions SET temp_user_id = user_id::UUID WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
UPDATE payment_transactions SET temp_user_id = user_id::UUID WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
UPDATE subscription_periods SET temp_user_id = user_id::UUID WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- For any non-UUID values, generate new UUIDs
UPDATE profiles SET temp_id = uuid_generate_v4() WHERE temp_id IS NULL;

-- Update foreign key references to use the new UUIDs
UPDATE credit_transactions ct 
SET temp_user_id = p.temp_id 
FROM profiles p 
WHERE ct.user_id = p.id 
AND ct.temp_user_id IS NULL;

UPDATE payment_transactions pt 
SET temp_user_id = p.temp_id 
FROM profiles p 
WHERE pt.user_id = p.id 
AND pt.temp_user_id IS NULL;

UPDATE subscription_periods sp 
SET temp_user_id = p.temp_id 
FROM profiles p 
WHERE sp.user_id = p.id 
AND sp.temp_user_id IS NULL;

-- Create new tables with UUID columns
CREATE TABLE profiles_new (
    id UUID PRIMARY KEY,
    email TEXT,
    credits_balance INTEGER DEFAULT 0,
    auto_buy_enabled BOOLEAN DEFAULT FALSE,
    current_plan_id UUID REFERENCES subscription_plans(id),
    subscription_status TEXT DEFAULT 'TRIAL',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_subscription_status CHECK (subscription_status IN ('TRIAL', 'ACTIVE', 'CANCELLED', 'EXPIRED'))
);

CREATE TABLE credit_transactions_new (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
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

CREATE TABLE payment_transactions_new (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
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

CREATE TABLE subscription_periods_new (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    plan_id UUID REFERENCES subscription_plans(id),
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    status TEXT DEFAULT 'ACTIVE',
    payment_transaction_id UUID REFERENCES payment_transactions(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN ('ACTIVE', 'CANCELLED', 'EXPIRED'))
);

-- Copy data to new tables
INSERT INTO profiles_new 
SELECT temp_id, email, credits_balance, auto_buy_enabled, current_plan_id, 
       subscription_status, created_at, updated_at
FROM profiles;

INSERT INTO credit_transactions_new 
SELECT id, temp_user_id, amount, type, generation_type, description, created_at
FROM credit_transactions;

INSERT INTO payment_transactions_new 
SELECT id, temp_user_id, flutterwave_transaction_id, amount, currency, status, 
       payment_method, auto_buy, created_at, updated_at
FROM payment_transactions;

INSERT INTO subscription_periods_new 
SELECT id, temp_user_id, plan_id, start_date, end_date, status, 
       payment_transaction_id, created_at, updated_at
FROM subscription_periods;

-- Drop old tables
DROP TABLE subscription_periods;
DROP TABLE payment_transactions;
DROP TABLE credit_transactions;
DROP TABLE profiles;

-- Rename new tables
ALTER TABLE profiles_new RENAME TO profiles;
ALTER TABLE credit_transactions_new RENAME TO credit_transactions;
ALTER TABLE payment_transactions_new RENAME TO payment_transactions;
ALTER TABLE subscription_periods_new RENAME TO subscription_periods;

-- Re-add foreign key constraints
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE subscription_periods ADD CONSTRAINT subscription_periods_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update the RLS policies to use UUID type
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid()::uuid = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid()::uuid = id)
    WITH CHECK (auth.uid()::uuid = id);

DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;
CREATE POLICY "Users can view own transactions"
    ON credit_transactions FOR SELECT
    USING (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Users can view own payments" ON payment_transactions;
CREATE POLICY "Users can view own payments"
    ON payment_transactions FOR SELECT
    USING (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Users can view own subscription periods" ON subscription_periods;
CREATE POLICY "Users can view own subscription periods"
    ON subscription_periods FOR SELECT
    USING (auth.uid()::uuid = user_id);

-- Re-enable triggers
ALTER TABLE credit_transactions ENABLE TRIGGER ALL;
ALTER TABLE payment_transactions ENABLE TRIGGER ALL;
ALTER TABLE subscription_periods ENABLE TRIGGER ALL;
ALTER TABLE profiles ENABLE TRIGGER ALL;

-- Add indices for better performance
DROP INDEX IF EXISTS idx_credit_transactions_user_id;
DROP INDEX IF EXISTS idx_payment_transactions_user_id;
DROP INDEX IF EXISTS idx_subscription_periods_user_id;

CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_subscription_periods_user_id ON subscription_periods(user_id);

-- Update any stored procedures that use text type for user_id
CREATE OR REPLACE FUNCTION handle_payment_verification(
    p_user_id uuid,
    p_transaction_id text,
    p_amount numeric,
    p_plan_id uuid,
    p_auto_buy boolean,
    p_credits integer
) RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_payment_id uuid;
BEGIN
    -- Update profile with new subscription
    UPDATE profiles 
    SET 
        current_plan_id = p_plan_id,
        credits_balance = credits_balance + p_credits,
        subscription_status = 'ACTIVE',
        auto_buy_enabled = p_auto_buy,
        updated_at = now()
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
        now(),
        now() + interval '1 month',
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

CREATE OR REPLACE FUNCTION handle_subscription_cancellation(
    p_user_id uuid
) RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- Update current subscription period to cancelled
    UPDATE subscription_periods
    SET 
        status = 'CANCELLED',
        updated_at = now()
    WHERE 
        user_id = p_user_id 
        AND status = 'ACTIVE';

    -- Update user profile
    UPDATE profiles
    SET 
        subscription_status = 'CANCELLED',
        current_plan_id = null,
        updated_at = now()
    WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION handle_generation_deduction(
    p_user_id uuid,
    p_generation_type text,
    p_description text default null
) RETURNS integer
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_credit_cost integer;
    v_current_balance integer;
    v_transaction_type text;
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
        updated_at = now()
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
