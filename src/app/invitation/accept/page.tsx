"use client";

import { Suspense } from 'react';
// We're using a dynamic import to ensure the component is properly loaded
import dynamic from 'next/dynamic';

// Dynamically import the component with no SSR to avoid hydration issues
const InvitationAcceptContent = dynamic(() => import('@/app/invitation/accept/InvitationAcceptContent'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full">
        <div className="flex justify-center mb-6">
          <img src="/logo.svg" alt="Arch Studios Logo" className="h-12" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-6">Loading invitation...</h1>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    </div>
  )
});

export default function AcceptInvitationPage() {
  return <InvitationAcceptContent />;
}
