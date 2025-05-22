"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getAuthenticatedClient } from '@/lib/supabase';

export function AuthDebugger() {
  const [debugInfo, setDebugInfo] = useState<{
    hasToken: boolean;
    tokenLength?: number;
    tokenSource?: string;
    jwtPayload?: Record<string, any>;
    testRequest?: {
      success: boolean;
      status?: number;
      error?: string;
      data?: any;
    },
    notificationsTest?: {
      success: boolean;
      status?: number;
      error?: string;
    }
  }>({
    hasToken: false
  });
  
  const [expanded, setExpanded] = useState(false);
  const { getToken, userId, isSignedIn } = useAuth();
  
  useEffect(() => {
    async function checkAuth() {
      // Only run this in development
      if (process.env.NODE_ENV !== 'development') return;
      
      try {
        // Get session storage token
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
        
        // If no token in storage but we have userId, try to get one from Clerk
        if (!token && userId) {
          token = await getToken({ template: 'supabase' });
          if (token) tokenSource = 'clerk (fresh)';
        }
        
        // Extract JWT payload if we have a token
        let jwtPayload: Record<string, any> | undefined;
        if (token) {
          try {
            const base64Payload = token.split('.')[1];
            jwtPayload = JSON.parse(atob(base64Payload));
          } catch (e) {
            console.error('Error parsing JWT payload:', e);
          }
        }
        
        setDebugInfo(prev => ({
          ...prev,
          hasToken: !!token,
          tokenLength: token?.length,
          tokenSource,
          jwtPayload
        }));
        
        // Test the token with a simple request to profiles
        if (token) {
          try {
            const client = getAuthenticatedClient(token);
            const { data, error, status } = await client.from('profiles').select('id, email').limit(1);
            
            setDebugInfo(prev => ({
              ...prev,
              testRequest: {
                success: !error && !!data,
                status,
                error: error?.message,
                data
              }
            }));
            
            // Also test the notifications endpoint specifically
            const notificationsResponse = await fetch(
              `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/notifications?select=id&limit=1`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                }
              }
            );
            
            setDebugInfo(prev => ({
              ...prev,
              notificationsTest: {
                success: notificationsResponse.ok,
                status: notificationsResponse.status,
                error: notificationsResponse.ok ? undefined : notificationsResponse.statusText
              }
            }));
            
            console.log('Auth debug - API test results:', { 
              profiles: { data, error, status },
              notifications: { 
                ok: notificationsResponse.ok,
                status: notificationsResponse.status
              }
            });
          } catch (err) {
            setDebugInfo(prev => ({
              ...prev,
              testRequest: {
                success: false,
                error: err instanceof Error ? err.message : String(err)
              }
            }));
          }
        }
      } catch (err) {
        console.error('Auth debugger error:', err);
      }
    }
    
    if (isSignedIn) {
      checkAuth();
    } else {
      // Reset debug info when signed out
      setDebugInfo({ hasToken: false });
    }
  }, [userId, isSignedIn, getToken]);
  
  // Don't render anything in production
  if (process.env.NODE_ENV !== 'development') return null;
  
  // Render a debug panel that can be expanded/collapsed
  const bgColor = debugInfo.testRequest?.success === false || debugInfo.notificationsTest?.success === false
    ? 'rgba(255, 50, 50, 0.9)'  // Red for issues
    : debugInfo.hasToken 
      ? 'rgba(50, 200, 80, 0.9)' // Green for success
      : 'rgba(255, 150, 50, 0.9)'; // Orange for warning
  
  if (!isSignedIn) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '10px', 
      right: '10px',
      zIndex: 9999,
      background: bgColor,
      color: 'white',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '12px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      maxWidth: expanded ? '500px' : '250px',
      maxHeight: expanded ? '80vh' : '60px',
      overflow: 'auto',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
        cursor: 'pointer'
      }} onClick={() => setExpanded(!expanded)}>
        <p style={{ margin: 0 }}>
          <strong>
            {debugInfo.testRequest?.success === false || debugInfo.notificationsTest?.success === false
              ? '⚠️ Auth Issue'
              : '✅ Auth Status'}
          </strong>
        </p>
        <span>{expanded ? '▼' : '▶'}</span>
      </div>
      
      {expanded && (
        <>
          <hr style={{ border: '1px solid rgba(255,255,255,0.2)', margin: '4px 0' }} />
          
          <p style={{ margin: '4px 0' }}>User ID: {userId || 'Not signed in'}</p>
          
          <p style={{ margin: '4px 0' }}>
            Token: {debugInfo.hasToken 
              ? `Yes (${debugInfo.tokenLength} chars, from ${debugInfo.tokenSource})` 
              : 'No'}
          </p>
          
          {debugInfo.testRequest && (
            <div style={{ margin: '8px 0' }}>
              <p style={{ margin: '4px 0', fontWeight: 'bold' }}>Profiles API Test:</p>
              <p style={{ margin: '2px 0' }}>
                {debugInfo.testRequest.success 
                  ? '✅ Success' 
                  : `❌ Error ${debugInfo.testRequest.status || ''}: ${debugInfo.testRequest.error}`}
              </p>
              {debugInfo.testRequest.data && (
                <pre style={{ 
                  margin: '2px 0', 
                  fontSize: '10px', 
                  maxHeight: '100px', 
                  overflow: 'auto', 
                  background: 'rgba(0,0,0,0.2)', 
                  padding: '4px'
                }}>
                  {JSON.stringify(debugInfo.testRequest.data, null, 2)}
                </pre>
              )}
            </div>
          )}
          
          {debugInfo.notificationsTest && (
            <div style={{ margin: '8px 0' }}>
              <p style={{ margin: '4px 0', fontWeight: 'bold' }}>Notifications API Test:</p>
              <p style={{ margin: '2px 0' }}>
                {debugInfo.notificationsTest.success 
                  ? '✅ Success' 
                  : `❌ Error ${debugInfo.notificationsTest.status || ''}: ${debugInfo.notificationsTest.error}`}
              </p>
            </div>
          )}
          
          {debugInfo.jwtPayload && (
            <div style={{ margin: '8px 0' }}>
              <p style={{ margin: '4px 0', fontWeight: 'bold' }}>JWT Claims:</p>
              <pre style={{ 
                margin: '2px 0', 
                fontSize: '10px', 
                maxHeight: '150px', 
                overflow: 'auto', 
                background: 'rgba(0,0,0,0.2)', 
                padding: '4px'
              }}>
                {JSON.stringify(debugInfo.jwtPayload, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
