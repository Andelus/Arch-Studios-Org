// Type definitions for Clerk middleware
// These types match the actual runtime structure but may not align exactly with what's in @clerk/nextjs package
// We use these to patch type errors while maintaining functionality

export interface ClerkMiddlewareAuth {
  userId: string | null;
  sessionId: string | null;
  getToken: (options: { template: string; skipCache?: boolean }) => Promise<string | null>;
  sessionClaims: Record<string, any> | null;
  protect: () => void;
  isSignedIn: boolean;
  isPublicRoute: boolean;
  has: (params: { permission: string }) => boolean;
  // Add other properties as needed
}
