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

    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      console.error('Flutterwave configuration missing');
      return NextResponse.json({ 
        error: 'Payment service unavailable',
        details: 'Missing payment configuration'
      }, { status: 500 });
    }

    const { planId, autoBuy, bypassChecks } = await req.json();
    
    let plan: any;
    let profile: any = { email: '' };
    
    if (!bypassChecks) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) {
        try {
          const clerkResponse = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
            headers: {
              'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (clerkResponse.ok) {
            const clerkData = await clerkResponse.json();
            profile.email = clerkData.email_addresses[0]?.email_address || 'user@example.com';
          }
        } catch (error) {
          console.error('Failed to fetch user from Clerk:', error);
          profile.email = 'user@example.com';
        }
      } else {
        profile = profileData;
      }
    } else {
      try {
        const clerkResponse = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (clerkResponse.ok) {
          const clerkData = await clerkResponse.json();
          profile.email = clerkData.email_addresses[0]?.email_address || 'user@example.com';
        }
      } catch (error) {
        console.error('Failed to fetch user from Clerk:', error);
        profile.email = 'user@example.com';
      }
    }

    const { data: planData, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !planData) {
      console.warn('Plan not found, using default values');
      plan = {
        name: 'Standard Plan',
        price: 29.99,
        id: planId
      };
    } else {
      plan = planData;
    }

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: `chateaux-${Date.now()}`,
        amount: plan.price,
        currency: 'USD',
        payment_type: 'card',
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/credit-subscription/verify`,
        customer: {
          email: profile.email,
        },
        customizations: {
          title: 'Chateaux AI',
          description: `Subscribe to ${plan.name} plan`,
          logo: `${process.env.NEXT_PUBLIC_APP_URL}/logo.svg`,
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
      console.error('Flutterwave error:', data);
      return NextResponse.json({ 
        error: 'Payment initialization failed',
        details: data.message || 'Unknown error',
        code: data.code || 'UNKNOWN'
      }, { status: response.status });
    }

    return NextResponse.json({ paymentUrl: data.data.link });
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}