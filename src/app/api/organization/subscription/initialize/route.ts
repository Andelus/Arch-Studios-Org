import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { organizationId, planType } = await req.json();
    const authResponse = await auth();
    const { userId, orgId } = authResponse;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate that the user is accessing their current organization
    if (orgId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch organization details to get name and email
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
    
    // Get user's email from Clerk
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

    // Determine subscription amount based on plan type
    const amount = planType === 'unlimited' ? 200 : 0;

    // Generate a unique transaction reference
    const txRef = `arch-org-${Date.now()}`;
    
    // Create Flutterwave payment payload
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
    const redirectUrl = `${baseUrl}/organization-billing`;
    
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
        title: 'Arch Studios',
        description: `${orgData.name} - ${planType.charAt(0).toUpperCase() + planType.slice(1)} Plan`,
        logo: `${baseUrl}/logo.svg`,
      },
      meta: {
        organizationId,
        userId,
        planType,
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
    
    // Create a pending subscription record
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // 1 month from now
    
    const { error: subscriptionError } = await supabase
      .from('organization_subscriptions')
      .insert({
        organization_id: organizationId,
        plan_type: planType,
        amount: amount,
        status: 'pending',
        start_date: new Date().toISOString(),
        end_date: endDate.toISOString()
      });
    
    if (subscriptionError) {
      console.error('Error creating subscription record:', subscriptionError);
      // Continue anyway, as we can create/update the record when payment is verified
    }
    
    return NextResponse.json({ paymentUrl: data.data.link });
  } catch (error) {
    console.error('Error initializing organization subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
