import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

// Webhook to handle Flutterwave payment events
export async function POST(req: Request) {
  try {
    // Get the raw request body
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    // Verify webhook signature
    const signature = req.headers.get('verif-hash');
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;

    if (!signature || !secretHash || signature !== secretHash) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Process different event types
    const { event, data } = body;

    if (event === 'charge.completed' && data.status === 'successful') {
      const { tx_ref, id: transactionId, amount, customer } = data;
      
      // Check if this is an organization subscription payment
      if (tx_ref && tx_ref.startsWith('arch-org-')) {
        await handleOrganizationSubscription(tx_ref, transactionId, amount, customer);
      }
    }

    // Return success response
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing Flutterwave webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Process organization subscription payments
async function handleOrganizationSubscription(
  txRef: string,
  transactionId: string, 
  amount: number,
  customer: any
) {
  try {
    // Extract organization ID from tx_ref
    const parts = txRef.split('-');
    const organizationId = parts[2] || null;

    if (!organizationId) {
      console.error('Could not extract organization ID from tx_ref:', txRef);
      return;
    }

    // Set subscription dates
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setMonth(expiryDate.getMonth() + 1); // Add 1 month

    // Check if subscription already exists
    const { data: existingSubscription } = await supabase
      .from('organization_subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSubscription) {
      // Update existing subscription
      await supabase
        .from('organization_subscriptions')
        .update({
          status: 'active',
          flutterwave_transaction_id: transactionId,
          start_date: now.toISOString(),
          end_date: expiryDate.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', existingSubscription.id);

      // Update organization with subscription_id
      await supabase
        .from('organizations')
        .update({
          subscription_id: existingSubscription.id,
          updated_at: now.toISOString()
        })
        .eq('id', organizationId);
    } else {
      // Create new subscription
      const { data: newSubscription, error } = await supabase
        .from('organization_subscriptions')
        .insert({
          organization_id: organizationId,
          plan_type: 'unlimited', // Default is unlimited plan
          amount: amount,
          currency: 'USD',
          status: 'active',
          flutterwave_transaction_id: transactionId,
          start_date: now.toISOString(),
          end_date: expiryDate.toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating subscription:', error);
        return;
      }

      // Update organization with subscription_id
      if (newSubscription) {
        await supabase
          .from('organizations')
          .update({
            subscription_id: newSubscription.id,
            updated_at: now.toISOString()
          })
          .eq('id', organizationId);
      }
    }

    // Log transaction
    await supabase
      .from('organization_subscription_transactions')
      .insert({
        organization_id: organizationId,
        transaction_id: transactionId,
        tx_ref: txRef,
        amount: amount,
        currency: 'USD',
        customer_email: customer?.email || null,
        status: 'completed',
        created_at: now.toISOString()
      });

  } catch (error) {
    console.error('Error handling organization subscription webhook:', error);
  }
}
