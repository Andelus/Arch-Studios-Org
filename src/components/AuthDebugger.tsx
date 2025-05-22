'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';

export default function AuthDebugger() {
  const { userId, isSignedIn, getToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const checkAuth = async () => {
    try {
      // Check local storage
      const sessionToken = sessionStorage.getItem('supabase_auth_token');
      const localToken = localStorage.getItem('supabase_auth_token');
      
      // Get fresh token
      const freshToken = await getToken({ template: 'supabase' });
      
      // Test Supabase connection
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
        headers: {
          'Authorization': `Bearer ${freshToken || sessionToken || ''}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        }
      });

      setDebugInfo({
        userId,
        isSignedIn,
        hasSessionToken: !!sessionToken,
        hasLocalToken: !!localToken,
        hasFreshToken: !!freshToken,
        tokenLength: freshToken ? freshToken.length : 0,
        apiResponse: {
          status: response.status,
          ok: response.ok,
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      setDebugInfo({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };
  
  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-gray-700 text-white px-3 py-1 rounded-md opacity-40 hover:opacity-100 text-xs"
      >
        Debug Auth
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 p-4 rounded-lg shadow-lg max-w-md z-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Authentication Debugger</h3>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Close
        </button>
      </div>
      
      <div className="mb-4">
        <button 
          onClick={checkAuth}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
        >
          Check Auth Status
        </button>
      </div>
      
      {debugInfo && (
        <div className="overflow-auto max-h-80 text-xs">
          <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
