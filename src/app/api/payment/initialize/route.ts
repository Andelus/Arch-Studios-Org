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

    const { planId, autoBuy, bypassChecks } = await req.json();
    
    // Variables to store plan and profile data
    let plan: any;
    let profile: any = { email: '' };
    
    // Only perform database checks if not bypassing
    if (!bypassChecks) {
      // Fetch user profile to get email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) {
        // If profile not found, create a default one with clerk email
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
          profile.email = 'user@example.com'; // Fallback email
        }
      } else {
        profile = profileData;
      }
    } else {
      // When bypassing checks, use a default email or fetch from Clerk
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
        } else {
          profile.email = 'user@example.com'; // Fallback email
        }
      } catch (error) {
        console.error('Failed to fetch user from Clerk:', error);
        profile.email = 'user@example.com'; // Fallback email
      }
    }

    // Fetch plan details from database
    const { data: planData, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !planData) {
      // If plan not found, use default values
      console.warn('Plan not found, using default values');
      plan = {
        name: 'Standard Plan',
        price: 29.99,
        id: planId
      };
    } else {
      plan = planData;
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
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/verify/callback`,
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