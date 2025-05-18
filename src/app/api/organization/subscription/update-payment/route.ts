import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { organizationId } = await req.json();
    const authResponse = await auth();
    const { userId, orgId } = authResponse;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate that the user is accessing their current organization
    if (orgId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get organization details
    const clerkOrgResponse = await fetch(`https://api.clerk.dev/v1/organizations/${organizationId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!clerkOrgResponse.ok) {
      throw new Error('Failed to fetch organization details from Clerk');
    }
    
    const orgData = await clerkOrgResponse.json();
    
    // Get the organization's subscription to determine the plan type
    const { data: subscription } = await supabase
      .from('organization_subscriptions')
      .select('plan_type, amount')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const planType = subscription?.plan_type || 'unlimited';
    const amount = subscription?.amount || 200; // Default to $200 for unlimited plan

    // Generate a transaction reference
    const txRef = `arch-org-payment-update-${organizationId}-${Date.now()}`;
    
    // Prepare Flutterwave payment
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
    const redirectUrl = `${baseUrl}/organization-billing`;
    
    // Get user's email
    const clerkUserResponse = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!clerkUserResponse.ok) {
      throw new Error('Failed to fetch user details from Clerk');
    }
    
    const userData = await clerkUserResponse.json();
    const userEmail = userData.email_addresses[0]?.email_address || 'user@example.com';
    
    // Prepare payment payload
    const requestPayload = {
      tx_ref: txRef,
      amount: amount,
      currency: 'USD',
      payment_type: 'card',
      redirect_url: redirectUrl,
      customer: {
        email: userEmail,
        name: userData.first_name || 'User',
      },
      customizations: {
        title: 'Arch Studios - Update Payment Method',
        description: `${orgData.name} - Update Payment Method`,
        logo: `${baseUrl}/logo.svg`,
      },
      meta: {
        organizationId,
        userId,
        planType,
        isPaymentUpdate: true
      }
    };
    
    // Initialize payment with Flutterwave
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
      return NextResponse.json({ 
        error: 'Payment initialization failed',
        details: data.message || 'Unknown error',
      }, { status: response.status });
    }
    
    return NextResponse.json({ paymentUrl: data.data.link });
  } catch (error) {
    console.error('Error updating organization payment method:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
