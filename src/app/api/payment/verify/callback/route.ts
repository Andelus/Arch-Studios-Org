import { NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/flutterwave';
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