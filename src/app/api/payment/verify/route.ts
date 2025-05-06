import { NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/flutterwave';
import { getAuth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const transaction_id = searchParams.get('transaction_id');

    if (!transaction_id) {
      return NextResponse.redirect(new URL('/credit-subscription?error=payment_failed', request.url));
    }

    if (status === 'successful') {
      const verificationResponse = await verifyPayment(transaction_id);

      if (verificationResponse.status === 'successful') {
        const { amount, meta } = verificationResponse.data;
        const { planId, userId, autoBuy } = meta;

        const { data: planData, error: planError } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('id', planId)
          .single();

        if (planError || !planData) {
          console.error('Error fetching plan details:', planError);
          return NextResponse.redirect(new URL('/credit-subscription?error=invalid_plan', request.url));
        }

        const { error: dbError } = await supabase.rpc('handle_payment_verification', {
          p_user_id: userId,
          p_transaction_id: transaction_id,
          p_amount: amount,
          p_plan_id: planId,
          p_auto_buy: autoBuy,
          p_credits: planData.total_credits
        });

        if (dbError) {
          console.error('Database Error:', dbError);
          return NextResponse.redirect(new URL('/credit-subscription?error=payment_processing', request.url));
        }

        return NextResponse.redirect(new URL('/credit-subscription?success=true', request.url));
      }
    }

    return NextResponse.redirect(new URL('/credit-subscription?error=payment_failed', request.url));
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.redirect(new URL('/credit-subscription?error=payment_failed', request.url));
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transactionId } = await request.json();

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const verificationResponse = await verifyPayment(transactionId);

    if (verificationResponse.status !== 'successful') {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    const { amount, meta } = verificationResponse.data;
    const { planId, autoBuy } = meta;

    const { data: planData, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !planData) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const { error: dbError } = await supabase.rpc('handle_payment_verification', {
      p_user_id: userId,
      p_transaction_id: transactionId,
      p_amount: amount,
      p_plan_id: planId,
      p_auto_buy: autoBuy,
      p_credits: planData.total_credits
    });

    if (dbError) {
      return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and processed successfully',
      data: {
        amount,
        credits: planData.total_credits,
        plan: planData.name,
        autoBuy,
        userId
      }
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
  }
}