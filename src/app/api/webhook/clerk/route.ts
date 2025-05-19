import { NextResponse } from 'next/server';

// This is a redirect handler for when webhooks are sent to the incorrect path
export async function POST(req: Request) {
  // Get the request body and headers
  const body = await req.text();
  
  // Get the headers we need to forward
  const svix_id = req.headers.get("svix-id");
  const svix_timestamp = req.headers.get("svix-timestamp");
  const svix_signature = req.headers.get("svix-signature");
  
  console.log('Redirecting Clerk webhook from /api/webhook/clerk to /api/webhooks/clerk');
  
  // Determine the base URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                 (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://chateauxai.org');
  
  // Forward the request to the correct endpoint
  const forwardUrl = `${baseUrl}/api/webhooks/clerk`;
  console.log(`Forwarding request to: ${forwardUrl}`);
  
  try {
    const response = await fetch(forwardUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': svix_id || '',
        'svix-timestamp': svix_timestamp || '',
        'svix-signature': svix_signature || ''
      },
      body
    });
    
    if (!response.ok) {
      console.error(`Failed to forward webhook. Status: ${response.status}`);
      const responseText = await response.text();
      console.error(`Response: ${responseText}`);
    }
    
    // Return the response from the correct endpoint
    return response;
  } catch (error) {
    console.error('Error forwarding webhook request:', error);
    return new Response(JSON.stringify({ error: 'Failed to forward webhook' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, svix-id, svix-timestamp, svix-signature',
      'Access-Control-Max-Age': '86400',
    },
  });
}
