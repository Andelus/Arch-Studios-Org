import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, autoBuy } = await req.json();

    // Fetch plan details from database
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Initialize Flutterwave payment
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: `plan-${planId}-${Date.now()}`,
        amount: plan.price,
        currency: 'USD',
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/verify`,
        customer: {
          email: userId, // You might want to fetch the user's email from Clerk
        },
        customizations: {
          title: 'Chateaux AI Subscription',
          description: `Subscription to ${plan.name} plan`,
        },
        meta: {
          planId,
      userId,
      autoBuy,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: 'Payment initialization failed' }, { status: 400 });
    }

    return NextResponse.json({ paymentUrl: data.data.link });
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 