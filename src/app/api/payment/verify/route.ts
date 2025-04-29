import { NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/flutterwave';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transaction_id');

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Verify payment with Flutterwave
    const verificationResponse = await verifyPayment(transactionId);

    if (verificationResponse.status !== 'success') {
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    const { userId, plan, autoBuy } = verificationResponse.meta;

    // Define plan credits
    const planCredits = {
      STANDARD: 2000,
      PRO: 3500,
    };

    // Update user's credits in Supabase
    const { error: updateError } = await supabase
      .from('users')
      .update({
        credits: supabase.rpc('increment_credits', {
          amount: planCredits[plan as keyof typeof planCredits],
        }),
        auto_buy: autoBuy,
        current_plan: plan,
      })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    // Create transaction record
    const { error: transactionError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: userId,
        flutterwave_transaction_id: transactionId,
        amount: verificationResponse.amount,
        status: 'COMPLETED',
        auto_buy: autoBuy,
      });

    if (transactionError) {
      console.error('Error creating transaction record:', transactionError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
} 