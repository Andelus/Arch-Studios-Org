import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

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

export default clerkMiddleware((auth, req) => {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }
  
  // Protect all non-public routes to require authentication
  auth.protect();
  
  const path = req.nextUrl.pathname;
  
  // Skip organization check for API routes
  if (path.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // In Clerk v6, the structure is different - we should check auth differently
  // No need to explicitly get userId and orgId here as we're just allowing users
  // to access the dashboard whether they have an organization or not
  
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