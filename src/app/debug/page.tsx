'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getAuthenticatedClient } from '@/lib/supabase';

export default function DebugPage() {
  const [authStatus, setAuthStatus] = useState<{
    userId?: string | null;
    hasToken: boolean;
    tokenInfo?: {
      source: string;
      length: number;
      preview?: string;
      decoded?: any;
    };
    apiTests: Record<string, {
      success: boolean;
      status?: number;
      error?: string;
      data?: any;
    }>;
  }>({
    hasToken: false,
    apiTests: {}
  });

  const { userId, getToken, isSignedIn } = useAuth();

  // Function to run an API test
  const runApiTest = async (endpoint: string, token: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${endpoint}?select=id&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          }
        }
      );
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }
      
      return {
        success: response.ok,
        status: response.status,
        data,
        error: response.ok ? undefined : response.statusText
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  };

  // Function to check auth status
  const checkAuth = async () => {
    if (!isSignedIn) {
      setAuthStatus({
        userId: null,
        hasToken: false,
        apiTests: {}
      });
      return;
    }
    
    try {
      // Get token from storage or Clerk
      let token: string | null = null;
      let tokenSource = 'none';
      
      if (typeof window !== 'undefined') {
        if (sessionStorage.getItem('supabase_auth_token')) {
          token = sessionStorage.getItem('supabase_auth_token');
          tokenSource = 'sessionStorage';
        } else if (localStorage.getItem('supabase_auth_token')) {
          token = localStorage.getItem('supabase_auth_token');
          tokenSource = 'localStorage';
        }
      }
      
      // If no token in storage, get from Clerk
      if (!token && userId) {
        token = await getToken({ template: 'supabase' });
        if (token) {
          tokenSource = 'clerk (fresh)';
          // Store the token in both storage mechanisms
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('supabase_auth_token', token);
              localStorage.setItem('supabase_auth_token', token);
            } catch (e) {
              console.error('Error storing token:', e);
            }
          }
        }
      }
      
      // Extract JWT payload
      let decodedToken;
      if (token) {
        try {
          const base64Payload = token.split('.')[1];
          decodedToken = JSON.parse(atob(base64Payload));
        } catch (e) {
          console.error('Error decoding token:', e);
        }
      }
      
      // Run tests for different endpoints
      const tests: Record<string, any> = {};
      
      if (token) {
        tests['profiles'] = await runApiTest('profiles', token);
        tests['notifications'] = await runApiTest('notifications', token);
        tests['projects'] = await runApiTest('projects', token);
        tests['project_members'] = await runApiTest('project_members', token);
      }
      
      setAuthStatus({
        userId,
        hasToken: !!token,
        tokenInfo: token ? {
          source: tokenSource,
          length: token.length,
          preview: `${token.substring(0, 5)}...${token.substring(token.length - 5)}`,
          decoded: decodedToken
        } : undefined,
        apiTests: tests
      });
      
    } catch (err) {
      console.error('Debug page error:', err);
    }
  };

  // Function to fix auth by refreshing token
  const refreshToken = async () => {
    if (!userId) return;
    
    try {
      // Clear existing tokens
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('supabase_auth_token');
        localStorage.removeItem('supabase_auth_token');
      }
      
      // Get fresh token
      const token = await getToken({ template: 'supabase' });
      
      if (token && typeof window !== 'undefined') {
        sessionStorage.setItem('supabase_auth_token', token);
        localStorage.setItem('supabase_auth_token', token);
        
        // Recheck auth status
        await checkAuth();
      }
    } catch (err) {
      console.error('Error refreshing token:', err);
    }
  };
  
  // Check auth status on load
  useEffect(() => {
    checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isSignedIn]);
  
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Authentication Debug Tool</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={checkAuth}
          style={{
            padding: '8px 16px',
            marginRight: '10px',
            background: '#4a90e2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Refresh Status
        </button>
        
        <button 
          onClick={refreshToken}
          style={{
            padding: '8px 16px',
            background: '#e2944a',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Force Token Refresh
        </button>
      </div>
      
      <div style={{ 
        background: '#f5f5f5', 
        padding: '15px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h2>User & Auth Status</h2>
        <p><strong>User ID:</strong> {authStatus.userId || 'Not signed in'}</p>
        <p>
          <strong>Token:</strong> {authStatus.hasToken 
            ? `✅ Found (${authStatus.tokenInfo?.length} chars, from ${authStatus.tokenInfo?.source})` 
            : '❌ Missing'}
        </p>
        {authStatus.tokenInfo?.preview && (
          <p><strong>Token Preview:</strong> {authStatus.tokenInfo.preview}</p>
        )}
      </div>
      
      {authStatus.tokenInfo?.decoded && (
        <div style={{ 
          background: '#f5f5f5', 
          padding: '15px', 
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h2>JWT Claims</h2>
          <pre style={{ 
            background: '#eee', 
            padding: '10px', 
            borderRadius: '4px',
            overflow: 'auto'
          }}>
            {JSON.stringify(authStatus.tokenInfo.decoded, null, 2)}
          </pre>
          
          <div style={{ marginTop: '10px' }}>
            <h3>Key Claims Check</h3>
            <p>
              <strong>role:</strong> {authStatus.tokenInfo.decoded?.role === 'authenticated' 
                ? '✅ authenticated' 
                : `❌ Missing or wrong (${authStatus.tokenInfo.decoded?.role || 'not set'})`}
            </p>
            <p>
              <strong>sub (user ID):</strong> {authStatus.tokenInfo.decoded?.sub 
                ? `✅ ${authStatus.tokenInfo.decoded.sub}` 
                : '❌ Missing'}
            </p>
            <p>
              <strong>exp (expiry):</strong> {authStatus.tokenInfo.decoded?.exp 
                ? `✅ ${new Date(authStatus.tokenInfo.decoded.exp * 1000).toLocaleString()}` 
                : '❌ Missing'}
            </p>
          </div>
        </div>
      )}
      
      <div style={{ 
        background: '#f5f5f5', 
        padding: '15px', 
        borderRadius: '8px'
      }}>
        <h2>API Tests</h2>
        {Object.entries(authStatus.apiTests).length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Endpoint</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(authStatus.apiTests).map(([endpoint, result]) => (
                <tr key={endpoint}>
                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{endpoint}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
                    {result.success ? '✅' : '❌'} {result.status || ''}
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
                    {result.error || (result.success ? 'Success' : 'Unknown error')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No API tests run yet. Sign in and refresh status.</p>
        )}
      </div>
      
      <div style={{ marginTop: '30px' }}>
        <h2>Troubleshooting Steps</h2>
        <ol>
          <li>Check if the token has the correct <code>role: "authenticated"</code> claim</li>
          <li>Verify the token has a valid <code>sub</code> claim matching your user ID</li>
          <li>Make sure you have properly set up the Clerk integration in Supabase Auth settings</li>
          <li>Run the database fix script with <code>npm run db:fix</code> to repair any relationship issues</li>
          <li>Check that Supabase RLS (Row Level Security) policies are correctly configured</li>
        </ol>
      </div>
    </div>
  );
}
