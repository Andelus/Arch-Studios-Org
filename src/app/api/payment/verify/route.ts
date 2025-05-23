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
    const tx_ref = searchParams.get('tx_ref');
    const transaction_id = searchParams.get('transaction_id');

    if (status === 'successful' && transaction_id) {
      // Verify payment with Flutterwave
      const verificationResponse = await verifyPayment(transaction_id);

      if (verificationResponse.status === 'successful') {
        const { amount, meta } = verificationResponse.data;
        const { planId, userId, autoBuy } = meta;

        // Get plan details from database
        const { data: planData, error: planError } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('id', planId)
          .single();

        if (planError || !planData) {
          console.error('Error fetching plan details:', planError);
          return redirect('/credit-subscription?error=invalid_plan');
        }

        // Update subscription and credits
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
          return redirect('/credit-subscription?error=payment_processing');
        }

        return redirect('/credit-subscription?success=true');
      }
    }

    return redirect('/credit-subscription?error=payment_failed');
  } catch (error) {
    console.error('Payment verification error:', error);
    return redirect('/credit-subscription?error=payment_failed');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { transactionId } = await request.json();

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Verify payment with Flutterwave
    const verificationResponse = await verifyPayment(transactionId);

    if (verificationResponse.status !== 'successful') {
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    // Extract relevant data from the verification response
    const { amount, meta } = verificationResponse.data;
    const { planId, autoBuy } = meta;

    // Get plan details from database
    const { data: planData, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !planData) {
      console.error('Error fetching plan details:', planError);
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      );
    }

    // Start a transaction to update multiple tables
    const { error: dbError } = await supabase.rpc('handle_payment_verification', {
      p_user_id: userId,
      p_transaction_id: transactionId,
      p_amount: amount,
      p_plan_id: planId,
      p_auto_buy: autoBuy,
      p_credits: planData.total_credits
    });

    if (dbError) {
      console.error('Database Error:', dbError);
      return NextResponse.json(
        { error: 'Failed to process payment' },
        { status: 500 }
      );
    }

    // Return success response with payment details
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
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}