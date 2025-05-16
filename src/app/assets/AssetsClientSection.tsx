'use client';

import { Suspense } from 'react';
import AssetsClient from './AssetsClient';

export default function AssetsClientSection() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="ml-2">Loading assets...</span>
        </div>
      }
    >
      <AssetsClient />
    </Suspense>
  );
}
