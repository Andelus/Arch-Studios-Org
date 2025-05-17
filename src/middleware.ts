import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Create a matcher for public routes
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/webhooks/clerk',
  '/api/webhooks/flutterwave',
  '/api/payment/verify/callback',
  '/api/payment/verify', // Add payment verification endpoint
  '/credit-subscription/verify', // Add verification page
  '/privacy',
  '/terms',
  '/about',
  '/contact',
  '/sign-in',
  '/sign-up',
  '/coming-soon',
  '/credit-subscription',
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
    return;
  }
  auth.protect();
});

// Ensure profile API endpoint is matched
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
    "/api/:path*"
  ]
};