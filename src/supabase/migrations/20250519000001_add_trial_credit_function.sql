-- Create function to handle organization trial credit usage
CREATE OR REPLACE FUNCTION use_organization_trial_credits(
    org_id TEXT,
    credits_amount INT,
    description TEXT DEFAULT 'Model generation'
) RETURNS BOOLEAN AS $$
DECLARE
    subscription_record RECORD;
    subscription_id UUID;
    transaction_id UUID;
BEGIN
    -- Check if organization exists and has an active trial subscription
    SELECT id, trial_credits
    INTO subscription_record
    FROM organization_subscriptions
    WHERE organization_id = org_id
      AND status = 'active'
      AND is_trial = TRUE
    LIMIT 1;
    
    -- If no subscription found or insufficient credits, return false
    IF subscription_record IS NULL OR subscription_record.trial_credits < credits_amount THEN
        RETURN FALSE;
    END IF;
    
    -- Get the subscription ID
    subscription_id := subscription_record.id;
    
    -- Update trial credits
    UPDATE organization_subscriptions
    SET trial_credits = trial_credits - credits_amount,
        updated_at = NOW()
    WHERE id = subscription_id;
    
    -- Generate transaction ID
    transaction_id := uuid_generate_v4();
    
    -- Record the transaction
    INSERT INTO organization_subscription_transactions
    (id, organization_id, tx_ref, amount, currency, status, payment_provider_response)
    VALUES (
        transaction_id,
        org_id,
        'trial-usage-' || transaction_id,
        0,
        'USD',
        'completed',
        jsonb_build_object(
            'type', 'trial_credit_usage',
            'credits_used', credits_amount,
            'description', description
        )
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
