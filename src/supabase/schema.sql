-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Clean up existing tables and functions
drop table if exists credit_transactions cascade;
drop table if exists payment_transactions cascade;
drop table if exists subscription_periods cascade;
drop table if exists profiles cascade;
drop table if exists subscription_plans cascade;
drop function if exists handle_payment_verification(text, text, numeric, uuid, boolean, integer);
drop function if exists handle_payment_verification(p_user_id text, p_transaction_id text, p_amount numeric, p_plan_id uuid, p_auto_buy boolean, p_credits integer);
drop function if exists handle_payment_verification();
drop function if exists check_subscription_expiry cascade;
drop function if exists handle_subscription_cancellation cascade;
drop function if exists handle_generation_deduction cascade;
drop function if exists update_updated_at_column cascade;

-- Create subscription_plans table
create table subscription_plans (
    id uuid default uuid_generate_v4() primary key,
     name text not null unique,  -- Added unique constraint
    total_credits integer not null,
    price decimal(10,2) not null,
    image_credit_cost integer not null,
    model_credit_cost integer not null,
    features jsonb not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Create profiles table
create table profiles (
    id text primary key,
    email text,
    credits_balance integer default 0,
    auto_buy_enabled boolean default false,
    current_plan_id uuid references subscription_plans(id),
    subscription_status text default 'TRIAL',
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint valid_subscription_status check (subscription_status in ('TRIAL', 'ACTIVE', 'CANCELLED', 'EXPIRED'))
);

-- Create credit_transactions table
create table credit_transactions (
    id uuid default uuid_generate_v4() primary key,
    user_id text references profiles(id) on delete cascade,
    amount integer not null,
    type text not null,
    generation_type text,
    description text,
    created_at timestamptz default now(),
    constraint valid_type check (type in (
        'INITIAL_TRIAL_CREDIT',
        'TRIAL_IMAGE_GENERATION',
        'TRIAL_MODEL_GENERATION',
        'IMAGE_GENERATION',
        'MODEL_GENERATION',
        'PURCHASE'
    )),
    constraint valid_generation_type check (
        generation_type is null or 
        generation_type in ('IMAGE', '3D_MODEL')
    )
);

-- Create payment_transactions table
create table payment_transactions (
    id uuid default uuid_generate_v4() primary key,
    user_id text references profiles(id) on delete cascade,
    flutterwave_transaction_id text not null,
    amount decimal(10,2) not null,
    currency text default 'USD',
    status text default 'PENDING',
    payment_method text,
    auto_buy boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint valid_status check (status in ('PENDING', 'COMPLETED', 'FAILED'))
);

-- Create subscription_periods table
create table subscription_periods (
    id uuid default uuid_generate_v4() primary key,
    user_id text references profiles(id) on delete cascade,
    plan_id uuid references subscription_plans(id),
    start_date timestamptz default now(),
    end_date timestamptz,
    status text default 'ACTIVE',
    payment_transaction_id uuid references payment_transactions(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint valid_status check (status in ('ACTIVE', 'CANCELLED', 'EXPIRED'))
);

-- Enable Row Level Security on all tables
alter table subscription_plans enable row level security;
alter table profiles enable row level security;
alter table credit_transactions enable row level security;
alter table payment_transactions enable row level security;
alter table subscription_periods enable row level security;

-- RLS Policies

-- subscription_plans policies (public readable)
create policy "Anyone can view subscription plans"
    on subscription_plans for select
    using (true);

create policy "Only service role can modify plans"
    on subscription_plans for all
    with check (false);

-- profiles policies
create policy "Users can view own profile"
    on profiles for select
    using (auth.uid()::text = id);

create policy "Users can update own profile"
    on profiles for update
    using (auth.uid()::text = id)
    with check (auth.uid()::text = id);

-- credit_transactions policies
create policy "Users can view own transactions"
    on credit_transactions for select
    using (auth.uid()::text = user_id);

create policy "Only service role can create transactions"
    on credit_transactions for insert
    with check (false);

-- payment_transactions policies
create policy "Users can view own payments"
    on payment_transactions for select
    using (auth.uid()::text = user_id);

create policy "Service role only for payment modifications"
    on payment_transactions for insert 
    with check (false);

create policy "Service role only for payment updates"
    on payment_transactions for update
    using (false)
    with check (false);

create policy "Service role only for payment deletes"
    on payment_transactions for delete
    using (false);

-- subscription_periods policies
create policy "Users can view own subscription periods"
    on subscription_periods for select
    using (auth.uid()::text = user_id);

create policy "Service role only for subscription modifications"
    on subscription_periods for insert
    with check (false);

create policy "Service role only for subscription updates"
    on subscription_periods for update
    using (false)
    with check (false);

create policy "Service role only for subscription deletes"
    on subscription_periods for delete
    using (false);

-- Enhanced Indexes for better performance
create index idx_profiles_current_plan on profiles(current_plan_id);
create index idx_credit_transactions_user_id on credit_transactions(user_id);
create index idx_credit_transactions_type on credit_transactions(type);
create index idx_credit_transactions_created_at on credit_transactions(created_at);
create index idx_payment_transactions_user_id on payment_transactions(user_id);
create index idx_payment_transactions_status on payment_transactions(status);
create index idx_payment_transactions_created_at on payment_transactions(created_at);
create index idx_subscription_periods_user_id on subscription_periods(user_id);
create index idx_subscription_periods_status on subscription_periods(status);
create index idx_subscription_periods_end_date on subscription_periods(end_date);
create index idx_subscription_periods_payment_transaction_id on subscription_periods(payment_transaction_id);
create index idx_subscription_periods_plan_id on subscription_periods(plan_id);

-- Updated timestamp trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
create trigger set_timestamp before update on profiles
    for each row execute function update_updated_at_column();

create trigger set_timestamp before update on subscription_plans
    for each row execute function update_updated_at_column();

create trigger set_timestamp before update on payment_transactions
    for each row execute function update_updated_at_column();

create trigger set_timestamp before update on subscription_periods
    for each row execute function update_updated_at_column();

-- Payment verification function with explicit parameter types
create or replace function handle_payment_verification(
    p_user_id text,
    p_transaction_id text,
    p_amount numeric,
    p_plan_id uuid,
    p_auto_buy boolean,
    p_credits integer
) returns void
security definer
set search_path = public
language plpgsql as $$
declare
    v_payment_id uuid;
begin
    -- Update profile with new subscription
    update profiles 
    set 
        current_plan_id = p_plan_id,
        credits_balance = credits_balance + p_credits,
        subscription_status = 'ACTIVE',
        auto_buy_enabled = p_auto_buy,
        updated_at = now()
    where id = p_user_id;

    -- Record payment transaction
    insert into payment_transactions (
        id,
        user_id,
        flutterwave_transaction_id,
        amount,
        currency,
        status,
        auto_buy
    ) values (
        uuid_generate_v4(),
        p_user_id,
        p_transaction_id,
        p_amount,
        'USD',
        'COMPLETED',
        p_auto_buy
    ) returning id into v_payment_id;

    -- Create new subscription period
    insert into subscription_periods (
        user_id,
        plan_id,
        start_date,
        end_date,
        status,
        payment_transaction_id
    ) values (
        p_user_id,
        p_plan_id,
        now(),
        now() + interval '1 month',
        'ACTIVE',
        v_payment_id
    );

    -- Record credit transaction
    insert into credit_transactions (
        user_id,
        amount,
        type,
        description
    ) values (
        p_user_id,
        p_credits,
        'PURCHASE',
        'Credits from subscription plan purchase'
    );
end;
$$;

-- Function to check and update expired subscriptions
create or replace function check_subscription_expiry()
returns trigger
security definer
set search_path = public
language plpgsql as $$
begin
    -- If subscription period has ended, mark it as expired
    if new.end_date < now() and new.status = 'ACTIVE' then
        new.status := 'EXPIRED';
        
        -- Also update the user's profile subscription status
        update profiles
        set 
            subscription_status = 'EXPIRED',
            current_plan_id = null,
            updated_at = now()
        where id = new.user_id;
    end if;
    return new;
end;
$$;

-- Trigger for subscription expiry
create trigger check_subscription_expiry_trigger
    before insert or update on subscription_periods
    for each row
    execute function check_subscription_expiry();

-- Function to handle subscription cancellation
create or replace function handle_subscription_cancellation(
    p_user_id text
) returns void
security definer
set search_path = public
language plpgsql as $$
begin
    -- Update current subscription period to cancelled
    update subscription_periods
    set 
        status = 'CANCELLED',
        updated_at = now()
    where 
        user_id = p_user_id 
        and status = 'ACTIVE';

    -- Update user profile
    update profiles
    set 
        subscription_status = 'CANCELLED',
        current_plan_id = null,
        updated_at = now()
    where id = p_user_id;
end;
$$;

-- Function to handle credit deductions for generation
create or replace function handle_generation_deduction(
    p_user_id text,
    p_generation_type text,
    p_description text default null
) returns integer
security definer
set search_path = public
language plpgsql as $$
declare
    v_credit_cost integer;
    v_current_balance integer;
    v_transaction_type text;
begin
    -- Get user's current profile and subscription details
    select 
        p.credits_balance,
        case 
            when p_generation_type = 'IMAGE' then coalesce(sp.image_credit_cost, 10)
            when p_generation_type = '3D_MODEL' then coalesce(sp.model_credit_cost, 10)
        end,
        case 
            when p.subscription_status = 'TRIAL' then 
                case 
                    when p_generation_type = 'IMAGE' then 'TRIAL_IMAGE_GENERATION'
                    else 'TRIAL_MODEL_GENERATION'
                end
            else
                case 
                    when p_generation_type = 'IMAGE' then 'IMAGE_GENERATION'
                    else 'MODEL_GENERATION'
                end
        end
    into v_current_balance, v_credit_cost, v_transaction_type
    from profiles p
    left join subscription_plans sp on p.current_plan_id = sp.id
    where p.id = p_user_id;

    -- Check if user has enough credits
    if v_current_balance < v_credit_cost then
        raise exception 'Insufficient credits';
    end if;

    -- Deduct credits
    update profiles
    set 
        credits_balance = credits_balance - v_credit_cost,
        updated_at = now()
    where id = p_user_id;

    -- Record transaction
    insert into credit_transactions (
        user_id,
        amount,
        type,
        generation_type,
        description
    ) values (
        p_user_id,
        -v_credit_cost,
        v_transaction_type,
        p_generation_type,
        coalesce(p_description, p_generation_type || ' generation')
    );

    return v_credit_cost;
end;
$$;

-- Add stored procedure for atomic image generation transaction
CREATE OR REPLACE FUNCTION process_image_generation(
  p_user_id text,
  p_credit_cost INT,
  p_is_trial BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  -- Update credits balance and record transaction in a single transaction
  UPDATE profiles 
  SET credits_balance = credits_balance - p_credit_cost
  WHERE id = p_user_id;

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
    p_user_id,
    -p_credit_cost,
    CASE WHEN p_is_trial THEN 'TRIAL_IMAGE_GENERATION' ELSE 'IMAGE_GENERATION' END,
    'IMAGE',
    'Image generation',
    NOW()
  );
END;
$$;

-- Add stored procedure for atomic credit deduction and transaction logging
create or replace function deduct_credits_and_log(
    p_user_id text,
    p_credit_amount integer,
    p_transaction_type text,
    p_generation_type text,
    p_description text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Perform credit deduction and transaction logging in a single transaction
    update profiles 
    set credits_balance = credits_balance - p_credit_amount
    where id = p_user_id;

    if not found then
        raise exception 'Profile not found';
    end if;

    -- Record the transaction
    insert into credit_transactions (
        user_id,
        amount,
        type,
        generation_type,
        description,
        created_at
    ) values (
        p_user_id,
        -p_credit_amount,
        p_transaction_type,
        p_generation_type,
        p_description,
        now()
    );

    -- Check if credits are running low and auto-buy is enabled
    declare
        v_auto_buy boolean;
        v_current_balance integer;
    begin
        select auto_buy_enabled, credits_balance
        into v_auto_buy, v_current_balance
        from profiles
        where id = p_user_id;

        if v_auto_buy and v_current_balance < 500 then
            -- Trigger auto-buy process (implement this part based on your auto-buy logic)
            -- This could be a separate function call or direct implementation
            null; -- Placeholder for now
        end if;
    end;
end $$;

-- Clean existing plans before inserting
delete from subscription_plans where name in ('STANDARD', 'PRO');

-- Initial subscription plans
insert into subscription_plans (name, total_credits, price, image_credit_cost, model_credit_cost, features) values
    ('STANDARD', 2000, 5.00, 100, 100, '["Privacy mode", "Auto-buy option"]'::jsonb),
    ('PRO', 5000, 15.00, 100, 100, '["Privacy mode", "Auto-buy option", "Early access to new features"]'::jsonb);