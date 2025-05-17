import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    console.log('Payment initialize API called');
    
    // Check authentication from multiple sources
    const auth = getAuth(req);
    let userId = auth.userId;
    
    // Also check for Authorization header (Bearer token)
    const authHeader = req.headers.get('authorization');
    if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
      // For Clerk, we'd need to validate the token, but we'll log it for now
      console.log('Found Bearer token in Authorization header');
    }
    
    // Debug auth state
    console.log('Auth state:', {
      hasUserId: !!userId,
      hasAuthHeader: !!authHeader,
      sessionId: auth.sessionId || 'none' 
    });
    
    if (!userId) {
      console.log('Unauthorized: No userId found in request');
      return NextResponse.json({ 
        error: 'Unauthorized', 
        details: 'Please sign in again to continue'
      }, { status: 401 });
    }
    console.log('User authenticated with ID:', userId);

    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      console.error('ERROR: Flutterwave secret key is missing in environment config');
      return NextResponse.json({ 
        error: 'Payment service unavailable',
        details: 'Missing payment configuration'
      }, { status: 500 });
    }
    console.log('Flutterwave config check passed');
    

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
      console.error('Error fetching plan:', planError);
      return NextResponse.json({ 
        error: 'Invalid plan',
        details: 'Could not find the specified plan'
      }, { status: 400 });
    }

    plan = planData;

    // Ensure proper URL formatting for live mode
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://chateauxai.com';
    const redirectUrl = `${baseUrl}/credit-subscription/verify`;

    const txRef = `chateaux-${Date.now()}`;
    const requestPayload = {
      tx_ref: txRef,
      amount: plan.price,
      currency: 'USD',
      payment_type: 'card',
      redirect_url: redirectUrl,
      customer: {
        email: profile.email,
      },
      customizations: {
        title: 'Chateaux AI',
        description: `Subscribe to ${plan.name} plan`,
        logo: `${baseUrl}/logo.svg`,
      },
      meta: {
        planId,
        userId,
        autoBuy,
      }
    };
    
    console.log('Initializing Flutterwave payment with:', {
      ...requestPayload,
      tx_ref: txRef, // Safe to log
      amount: plan.price,
      email: profile.email
    });
    
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(requestPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Flutterwave API error:', data);
      console.error('Response status:', response.status, response.statusText);
      return NextResponse.json({ 
        error: 'Payment initialization failed',
        details: data.message || 'Unknown error',
        code: data.code || 'UNKNOWN'
      }, { status: response.status });
    }
    
    console.log('Flutterwave payment initialized successfully, returning payment URL');
    

    return NextResponse.json({ paymentUrl: data.data.link });
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}