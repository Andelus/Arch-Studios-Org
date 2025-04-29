import { NextResponse } from 'next/server';
import { initializePayment } from '@/lib/flutterwave';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { plan, autoBuy, userId } = await request.json();

    // Get user's email from Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // Define plan details
    const planDetails = {
      STANDARD: {
        amount: 5,
        credits: 2000,
      },
      PRO: {
        amount: 15,
        credits: 3500,
      },
    };

    const selectedPlan = planDetails[plan as keyof typeof planDetails];
    if (!selectedPlan) {
      throw new Error('Invalid plan selected');
    }

    // Initialize payment with Flutterwave
    const paymentData = {
      amount: selectedPlan.amount,
      email: userData.email,
      plan,
      userId,
      autoBuy,
    };

    const paymentResponse = await initializePayment(paymentData);

    return NextResponse.json(paymentResponse);
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize payment' },
      { status: 500 }
    );
  }
} 