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

    // Query for the organization's assets and storage usage
    const { data: usageData, error: usageError } = await supabase
      .rpc('get_organization_usage_statistics', { org_id: organizationId });

    if (usageError) {
      console.error('Error fetching organization usage statistics:', usageError);
      return NextResponse.json({ error: 'Failed to fetch usage statistics' }, { status: 500 });
    }

    // If there's no data, return defaults
    if (!usageData) {
      return NextResponse.json({
        totalAssets: 0,
        totalStorageUsed: 0,
        lastUpdated: new Date().toISOString()
      });
    }

    return NextResponse.json(usageData);
  } catch (error) {
    console.error('Error in organization usage API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
