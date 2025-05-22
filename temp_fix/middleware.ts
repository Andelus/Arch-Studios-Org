// @ts-nocheck - Disable TypeScript checking for this file due to Clerk types mismatch
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseProfileIdFromClerk } from '@/utils/clerk-supabase';

// Function to decode JWT without a library
function decodeJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error decoding JWT:', e);
    return null;
  }
}

// Create a matcher for public routes
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/webhooks/clerk',
  '/api/webhooks/flutterwave',
  '/api/payment/verify/callback',
  '/api/payment/verify', // Payment verification endpoint
  '/api/organization/subscription/verify', // Organization subscription verification endpoint
  '/privacy',
  '/terms',
  '/about',
  '/contact',
  '/sign-in',
  '/sign-up',
  '/coming-soon',
  '/organization-billing',
  // Organization setup is now handled through the dashboard
  // with Clerk's native UI components
  // Static paths
  '/_next/static/(.*)',
  '/_next/image/(.*)',
  '/favicon.ico',
  '/new-favicon.jpg',
  '/logo.svg',
  '/next.svg',
  '/vercel.svg',
  '/file.svg',
  '/globe.svg',
  '/window.svg'
]);

// Enhanced middleware with improved JWT handling
// Using any here to bypass TypeScript errors due to mismatch between actual runtime structure and type definitions
// @ts-expect-error - Clerk types don't match actual runtime structure
export default clerkMiddleware(async (auth: any, req: any) => {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }
  
  // Protect all non-public routes to require authentication
  auth.protect();
  
  const path = req.nextUrl.pathname;
  
  // Enhanced JWT handling for API routes to fix authentication issues
  if (path.startsWith('/api/')) {
    try {
      if (!auth.userId) {
        return NextResponse.next();
      }
      
      // Get the Supabase UUID for this user
      const supabaseId = await getSupabaseProfileIdFromClerk(auth.userId);
      
      // Get the Supabase JWT with correct claims
      const token = await auth.getToken({ 
        template: 'supabase',
        skipCache: false // Use cached token when possible
      });
      
      if (token) {
        // Verify the token has correct claims
        const decoded = decodeJwt(token);
        
        // Check if the custom supabase_user_id claim matches the expected Supabase ID
        // We're using a custom claim since Clerk doesn't allow overriding 'sub'
        if (decoded && decoded.supabase_user_id !== supabaseId) {
          console.error('JWT claim mismatch. Expected supabase_user_id:', supabaseId, 'Got:', 
            decoded.supabase_user_id || 'undefined');
          
          // Force refresh the token to fix claims
          const freshToken = await auth.getToken({ 
            template: 'supabase',
            skipCache: true // Force fresh token
          });
          
          // Create a new response with updated headers
          const response = NextResponse.next();
          response.headers.set('x-supabase-auth', freshToken || '');
          return response;
        }
        
        // If claims are correct, add the token to the request
        const response = NextResponse.next();
        response.headers.set('x-supabase-auth', token);
        return response;
      }
    } catch (error) {
      console.error('Error handling JWT for API route:', error);
    }
  }
  
  // Allow users to access the dashboard without an organization
  // Organization setup is now optional and can be done from the dashboard
  return NextResponse.next();
});

// Ensure profile API endpoint is matched
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
    "/api/:path*"
  ]
};
