import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  req: Request,
  { params }: { params: { organizationId: string } }
) {
  try {
    const { organizationId } = params;
    const authResponse = await auth();
    const { userId, orgId } = authResponse;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate that the user is accessing their current organization
    if (orgId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Query for the organization's active subscription
    const { data, error } = await supabase
      .from('organization_subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No subscription found
        return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
      }
      console.error('Error fetching organization subscription:', error);
      return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in organization subscription API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
