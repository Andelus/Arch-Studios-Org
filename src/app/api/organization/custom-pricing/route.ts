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

    // Send notification email to finance team
    try {
      const { sendEmail } = await import('@/lib/email-service');
      await sendEmail({
        subject: `New Custom Pricing Request: ${companyName}`,
        to: 'finance@chateauxai.com',
        template: 'custom-pricing-request',
        data: { 
          companyName, 
          contactName, 
          email, 
          requirements,
          employeeCount,
          budget,
          organizationId
        }
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Don't fail the request if email fails
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
