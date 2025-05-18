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

    // First, find the active subscription
    const { data: subscriptionData, error: fetchError } = await supabase
      .from('organization_subscriptions')
      .select('id, status')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // No active subscription found
        return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
      }
      console.error('Error fetching organization subscription:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
    }

    // Update the subscription status to 'cancelled'
    const { error: updateError } = await supabase
      .from('organization_subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', subscriptionData.id);

    if (updateError) {
      console.error('Error updating subscription status:', updateError);
      return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Subscription cancelled successfully',
      // Keep access until the end of the billing period
      retainsAccessUntil: true
    });
  } catch (error) {
    console.error('Error in cancel subscription API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
