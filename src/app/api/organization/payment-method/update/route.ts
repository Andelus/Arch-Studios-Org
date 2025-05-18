import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

// Function to check if user is org admin
async function isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.clerk.dev/v1/organizations/${orgId}/memberships`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to get organization memberships');
    }
    
    const memberships = await response.json();
    const userMembership = memberships.find(
      (membership: any) => membership.user_id === userId
    );
    
    return userMembership && userMembership.role === 'admin';
  } catch (error) {
    console.error('Error checking org admin status:', error);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    // Check authentication
    const authResponse = await auth();
    const { userId, orgId } = authResponse;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, paymentMethodId } = await req.json();

    // Validate required fields
    if (!organizationId || !paymentMethodId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user is an admin in this organization
    const isAdmin = await isOrgAdmin(userId, organizationId);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only organization admins can update payment methods' },
        { status: 403 }
      );
    }

    // Update payment method
    // NOTE: This is a simplified implementation. In a real-world scenario,
    // you would integrate with your payment processor's API to update
    // the payment method details
    const { error } = await supabase
      .from('organization_payment_methods')
      .upsert({
        organization_id: organizationId,
        payment_method_id: paymentMethodId,
        is_default: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'organization_id'
      });

    if (error) {
      console.error('Error updating payment method:', error);
      return NextResponse.json(
        { error: 'Failed to update payment method' },
        { status: 500 }
      );
    }

    // Also update the organization subscription payment method ID
    const { error: subscriptionError } = await supabase
      .from('organization_subscriptions')
      .update({ payment_method_id: paymentMethodId })
      .eq('organization_id', organizationId)
      .eq('status', 'active');

    if (subscriptionError) {
      console.error('Error updating subscription payment method:', subscriptionError);
      // Continue anyway - the payment method was updated successfully
    }

    return NextResponse.json({
      success: true,
      message: 'Payment method updated successfully'
    });
  } catch (error) {
    console.error('Error updating payment method:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
