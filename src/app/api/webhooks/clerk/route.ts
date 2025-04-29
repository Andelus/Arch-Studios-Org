import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  console.log('Webhook received');
  
  try {
    const payload = await req.json();
    console.log('Webhook payload:', payload);

    // Process the webhook payload
    const { type, data } = payload;
    console.log('Webhook type:', type);

    if (type === 'user.created') {
      console.log('Processing user.created event');
      const { id, email_addresses } = data;
      const email = email_addresses[0]?.email_address;

      console.log('User created:', { id, email });
      
      // Here you can add your own user creation logic
      // For example, store in your own database or send welcome email
      
      return NextResponse.json({ 
        message: 'User processed successfully',
        userId: id,
        email: email
      });
    }

    return NextResponse.json({ 
      message: 'Event received but not processed',
      type: type
    });
  } catch (error) {
    console.error('Webhook Handler Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: (error as Error).message 
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({ message: 'ok' });
}