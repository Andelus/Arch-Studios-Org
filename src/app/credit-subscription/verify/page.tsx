import { redirect } from 'next/navigation';
import { verifyPayment } from '@/lib/flutterwave';
import { createClient } from '@supabase/supabase-js';
import { Suspense } from 'react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function VerifyPayment({ searchParams }: { searchParams: any }) {
  const status = searchParams['status'];
  const transaction_id = searchParams['transaction_id'];

  if (!transaction_id || typeof transaction_id !== 'string') {
    redirect('/credit-subscription?error=payment_failed');
  }

  if (status === 'successful') {
    try {
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
          redirect('/credit-subscription?error=invalid_plan');
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
          redirect('/credit-subscription?error=payment_processing');
        }

        redirect('/credit-subscription?success=true');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
    }
  }

  redirect('/credit-subscription?error=payment_failed');
}