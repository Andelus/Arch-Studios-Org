import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';



export async function POST(req: NextRequest) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, autoBuy } = await req.json();

    // Fetch user profile to get email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

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
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/credit-subscription/verify`,
        customer: {
          email: profile.email,
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