import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Create a matcher for public routes
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/webhooks/clerk',
  '/api/webhooks/flutterwave',
  '/privacy',
  '/terms',
  '/about',
  '/contact',
  '/sign-in',
  '/sign-up',
  // Add these static paths
  '/_next/static/(.*)',
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

export const config = {
  matcher: [
    // Match all paths except static files and api routes
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    // Match all api routes except webhooks
    "/api/((?!webhooks).*)"
  ],
};