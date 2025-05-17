-- Begin transaction
BEGIN;

-- Drop new foreign key constraints if they exist
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_user_id_fkey;
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_user_id_fkey;
ALTER TABLE subscription_periods DROP CONSTRAINT IF EXISTS subscription_periods_user_id_fkey;

-- Create temporary tables with text columns
CREATE TABLE profiles_old (
    id TEXT PRIMARY KEY,
    email TEXT,
    credits_balance INTEGER DEFAULT 0,
    auto_buy_enabled BOOLEAN DEFAULT FALSE,
    current_plan_id UUID REFERENCES subscription_plans(id),
    subscription_status TEXT DEFAULT 'TRIAL',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_subscription_status CHECK (subscription_status IN ('TRIAL', 'ACTIVE', 'CANCELLED', 'EXPIRED'))
);

CREATE TABLE credit_transactions_old (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL,
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

CREATE TABLE payment_transactions_old (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL,
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

CREATE TABLE subscription_periods_old (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_id UUID REFERENCES subscription_plans(id),
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    status TEXT DEFAULT 'ACTIVE',
    payment_transaction_id UUID REFERENCES payment_transactions(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN ('ACTIVE', 'CANCELLED', 'EXPIRED'))
);

-- Copy data back from UUID to TEXT
INSERT INTO profiles_old 
SELECT id::TEXT, email, credits_balance, auto_buy_enabled, current_plan_id, 
       subscription_status, created_at, updated_at
FROM profiles;

INSERT INTO credit_transactions_old 
SELECT id, user_id::TEXT, amount, type, generation_type, description, created_at
FROM credit_transactions;

INSERT INTO payment_transactions_old 
SELECT id, user_id::TEXT, flutterwave_transaction_id, amount, currency, status, 
       payment_method, auto_buy, created_at, updated_at
FROM payment_transactions;

INSERT INTO subscription_periods_old 
SELECT id, user_id::TEXT, plan_id, start_date, end_date, status, 
       payment_transaction_id, created_at, updated_at
FROM subscription_periods;

-- Drop new tables
DROP TABLE subscription_periods;
DROP TABLE payment_transactions;
DROP TABLE credit_transactions;
DROP TABLE profiles;

-- Rename old tables back
ALTER TABLE profiles_old RENAME TO profiles;
ALTER TABLE credit_transactions_old RENAME TO credit_transactions;
ALTER TABLE payment_transactions_old RENAME TO payment_transactions;
ALTER TABLE subscription_periods_old RENAME TO subscription_periods;

-- Re-add foreign key constraints
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE subscription_periods ADD CONSTRAINT subscription_periods_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update RLS policies back to TEXT type
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid()::text = id)
    WITH CHECK (auth.uid()::text = id);

DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;
CREATE POLICY "Users can view own transactions"
    ON credit_transactions FOR SELECT
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can view own payments" ON payment_transactions;
CREATE POLICY "Users can view own payments"
    ON payment_transactions FOR SELECT
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can view own subscription periods" ON subscription_periods;
CREATE POLICY "Users can view own subscription periods"
    ON subscription_periods FOR SELECT
    USING (auth.uid()::text = user_id);

-- Update stored procedures back to text type
CREATE OR REPLACE FUNCTION handle_payment_verification(
    p_user_id text,
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
    p_user_id text
) RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE subscription_periods
    SET 
        status = 'CANCELLED',
        updated_at = now()
    WHERE 
        user_id = p_user_id 
        AND status = 'ACTIVE';

    UPDATE profiles
    SET 
        subscription_status = 'CANCELLED',
        current_plan_id = null,
        updated_at = now()
    WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION handle_generation_deduction(
    p_user_id text,
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

    IF v_current_balance < v_credit_cost THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;

    UPDATE profiles
    SET 
        credits_balance = credits_balance - v_credit_cost,
        updated_at = now()
    WHERE id = p_user_id;

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

COMMIT;
