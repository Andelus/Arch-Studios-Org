import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createPaymentPayload, getPaymentHeaders, isCardPermissionError } from '@/lib/payment-utils';

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
    
    // Find plan by name
    const { data: planData, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .ilike('name', planName)
      .limit(1);
    
    if (planError || !planData || planData.length === 0) {
      console.error('Error fetching plan:', planError);
      return NextResponse.json({ 
        error: 'Invalid plan',
        details: 'Could not find the specified plan'
      }, { status: 400 });
    }

    const plan = planData[0];

    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      console.error('Flutterwave configuration missing');
      return NextResponse.json({ 
        error: 'Payment service unavailable',
        details: 'Missing payment configuration'
      }, { status: 500 });
    }

    // Initialize Flutterwave payment
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://chateauxai.com';
    const redirectUrl = `${baseUrl}/credit-subscription/verify`;

    // Generate a transaction reference with more uniqueness
    const txRef = `chateaux-${userId.substring(0, 8)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create a payload using our utility function
    const payload = createPaymentPayload({
      txRef,
      amount: plan.price,
      email: userEmail,
      userId,
      planId: plan.id,
      planName: plan.name,
      autoBuy,
      redirectUrl,
      publicKey: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY,
      baseUrl,
      direct: true // Set direct flag for tracking the source
    });
    
    // Get standardized headers for the payment request
    const headers = getPaymentHeaders(process.env.FLUTTERWAVE_SECRET_KEY);
    
    // Make the request to Flutterwave
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
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
