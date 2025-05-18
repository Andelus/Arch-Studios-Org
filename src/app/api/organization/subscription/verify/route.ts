import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

// Utility function to verify transaction with Flutterwave
async function verifyFlutterwaveTransaction(transactionId: string): Promise<any> {
  try {
    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Verification failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Flutterwave verification error:', error);
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    // Parse the request body
    const { transaction_id, tx_ref } = await req.json();

    // Validate required parameters
    if (!transaction_id || !tx_ref) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Parse organization ID and other metadata from tx_ref
    // Format should be: org_sub_{organizationId}_{timestamp}
    const parts = tx_ref.split('_');
    if (parts.length < 4 || parts[0] !== 'org' || parts[1] !== 'sub') {
      return NextResponse.json(
        { error: 'Invalid transaction reference' },
        { status: 400 }
      );
    }

    const organizationId = parts[2];

    // Using the imported supabase client, no need to create a new one
    // We already imported it from '@/lib/supabase'

    // 1. Verify the transaction with Flutterwave
    const verificationResult = await verifyFlutterwaveTransaction(transaction_id);
    
    if (!verificationResult.success) {
      // Update transaction status to failed
      await supabase
        .from('organization_subscription_transactions')
        .update({
          status: 'failed',
          payment_provider_response: JSON.stringify(verificationResult),
          updated_at: new Date().toISOString()
        })
        .eq('tx_ref', tx_ref);

      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    // Transaction is valid, update subscription
    const { data: transactionData } = await supabase
      .from('organization_subscription_transactions')
      .update({
        status: 'completed',
        payment_provider_response: JSON.stringify(verificationResult),
        payment_provider_transaction_id: transaction_id,
        updated_at: new Date().toISOString()
      })
      .eq('tx_ref', tx_ref)
      .select('*')
      .single();

    if (!transactionData) {
      console.error('Transaction not found:', tx_ref);
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // 2. Update or create subscription
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setMonth(expiryDate.getMonth() + 1); // Add 1 month

    const { data: existingSubscription } = await supabase
      .from('organization_subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (existingSubscription) {
      // Update existing subscription
      await supabase
        .from('organization_subscriptions')
        .update({
          status: 'active',
          updated_at: now.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: expiryDate.toISOString(),
          last_payment_date: now.toISOString(),
          last_transaction_id: transactionData.id
        })
        .eq('id', existingSubscription.id);
    } else {
      // Create new subscription
      await supabase
        .from('organization_subscriptions')
        .insert({
          organization_id: organizationId,
          plan_type: 'unlimited',
          amount: 200.00, // $200/month
          currency: 'USD',
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: expiryDate.toISOString(),
          last_payment_date: now.toISOString(),
          last_transaction_id: transactionData.id,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and subscription activated'
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
