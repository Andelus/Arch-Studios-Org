// This file contains TypeScript declarations to help with type checking where runtime does not match types

// Extend the Clerk middleware types to match the actual runtime behavior
declare module '@clerk/nextjs/server' {
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
}
