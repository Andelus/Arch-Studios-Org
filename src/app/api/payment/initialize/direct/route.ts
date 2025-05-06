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

    const { planName, autoBuy } = await req.json();
    
    // Get user email from Clerk (bypassing Supabase)
    let userEmail = 'user@example.com'; // Default fallback
    
    try {
      const clerkResponse = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (clerkResponse.ok) {
        const clerkData = await clerkResponse.json();
        userEmail = clerkData.email_addresses[0]?.email_address || userEmail;
      }
    } catch (error) {
      console.error('Failed to fetch user from Clerk:', error);
      // Continue with default email
    }
    
    // Find plan by name or use default values
    let plan = {
      id: 'default-plan-id',
      name: planName || 'Standard Plan',
      price: 29.99
    };
    
    // Try to find the plan in the database by name
    if (planName) {
      const { data: planData } = await supabase
        .from('subscription_plans')
        .select('*')
        .ilike('name', planName)
        .limit(1);
      
      if (planData && planData.length > 0) {
        // Ensure the plan data has all required properties
        const dbPlan = planData[0];
        plan = {
          id: typeof dbPlan.id === 'string' ? dbPlan.id : 'default-plan-id',
          name: typeof dbPlan.name === 'string' ? dbPlan.name : (planName || 'Standard Plan'),
          price: typeof dbPlan.price === 'number' ? dbPlan.price : 29.99
        };
      }
    }

    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      console.error('Flutterwave configuration missing');
      return NextResponse.json({ 
        error: 'Payment service unavailable',
        details: 'Missing payment configuration'
      }, { status: 500 });
    }

    // Initialize Flutterwave payment
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
          email: userEmail,
        },
        customizations: {
          title: 'Chateaux AI',
          description: `Subscribe to ${plan.name} plan`,
          logo: `${process.env.NEXT_PUBLIC_APP_URL}/logo.svg`,
        },
        meta: {
          planId: plan.id,
          userId,
          autoBuy,
          direct: true
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
  } catch (error: any) {
    console.error('Payment initialization error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message || 'Unknown error'
    }, { status: 500 });
  }
}
