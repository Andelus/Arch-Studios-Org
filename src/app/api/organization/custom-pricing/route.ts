import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  try {
    // Check authentication
    const authResponse = await auth();
    const { userId } = authResponse;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request data
    const {
      organizationId,
      companyName,
      contactName,
      email,
      phoneNumber,
      employeeCount,
      requirements,
      budget
    } = await req.json();

    // Validate required fields
    if (!organizationId || !companyName || !contactName || !email || !requirements) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Store custom pricing request
    const { data, error } = await supabase
      .from('custom_pricing_requests')
      .insert({
        organization_id: organizationId,
        company_name: companyName,
        contact_name: contactName,
        email,
        phone_number: phoneNumber,
        employee_count: employeeCount,
        requirements,
        budget: budget || null,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('Error creating custom pricing request:', error);
      return NextResponse.json(
        { error: 'Failed to submit custom pricing request' },
        { status: 500 }
      );
    }

    // Log the request in the system
    try {
      // In a real implementation, you might want to send a notification to admin users
      console.log('Custom pricing request received:', {
        organizationId,
        companyName, 
        contactName, 
        email, 
        requirements,
        employeeCount,
        budget
      });
    } catch (notificationError) {
      console.error('Failed to log notification:', notificationError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: 'Custom pricing request submitted successfully',
      requestId: data?.[0]?.id
    });
  } catch (error) {
    console.error('Error in custom pricing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
