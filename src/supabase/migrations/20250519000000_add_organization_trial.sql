-- Add organization trial fields to organization_subscriptions table
ALTER TABLE organization_subscriptions
  ADD COLUMN IF NOT EXISTS trial_credits INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT TRUE;

-- Update indexes
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_is_trial ON organization_subscriptions(is_trial);

-- Add check constraint for trial_credits
ALTER TABLE organization_subscriptions
  ADD CONSTRAINT check_trial_credits CHECK (trial_credits >= 0);

-- Migration comment
COMMENT ON TABLE organization_subscriptions IS 
  'Stores organization subscription data including trial status and credits';
