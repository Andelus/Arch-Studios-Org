"use client";

import dynamic from 'next/dynamic';

// Dynamically import the AuthDebugger component to avoid SSR issues
const AuthDebugger = dynamic(
  () => import('@/components/AuthDebugger').then(mod => ({ default: mod.AuthDebugger })),
  { ssr: false }
);

export function DebugProvider() {
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return <AuthDebugger />;
}
