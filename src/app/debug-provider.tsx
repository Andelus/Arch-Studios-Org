'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const AuthDebugger = dynamic(() => import('../components/AuthDebugger'), { ssr: false });

export default function DebugProvider() {
  const [showDebugger, setShowDebugger] = useState(false);
  
  useEffect(() => {
    // Only show in development environment
    if (process.env.NODE_ENV !== 'production') {
      setShowDebugger(true);
    }
  }, []);
  
  if (!showDebugger) return null;
  
  return <AuthDebugger />;
}
