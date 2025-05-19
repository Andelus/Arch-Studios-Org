import { NextResponse } from 'next/server';

// This is a redirect handler for when webhooks are sent to the incorrect path
export async function POST(req: Request) {
  // Get the request body and headers
  const body = await req.text();
  
  // Get the headers we need to forward
  const svix_id = req.headers.get("svix-id");
  const svix_timestamp = req.headers.get("svix-timestamp");
  const svix_signature = req.headers.get("svix-signature");
  
  // Forward the request to the correct endpoint
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://chateauxai.org'}/api/webhooks/clerk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': svix_id || '',
      'svix-timestamp': svix_timestamp || '',
      'svix-signature': svix_signature || ''
    },
    body
  });
  
  // Return the response from the correct endpoint
  return response;
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
