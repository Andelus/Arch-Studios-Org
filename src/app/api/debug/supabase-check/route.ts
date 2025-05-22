import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase, getAuthenticatedClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Get auth data
    const session = await auth();
    const userId = session.userId;
    
    if (!userId) {
      return NextResponse.json({ 
        status: 'unauthenticated',
        message: 'No authenticated user found' 
      }, { status: 401 });
    }
    
    // Get JWT token
    let token: string | null = null;
    
    // Check auth status with Supabase
    const anonymousClient = supabase;
    const { data: anonData, error: anonError } = await anonymousClient
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (req.headers.get('Authorization')) {
      token = req.headers.get('Authorization')?.replace('Bearer ', '') || null;
    } else {
      // For browser requests, check storage
      const cookies = req.cookies;
      const tokenCookie = cookies.get('supabase_auth_token');
      if (tokenCookie) {
        token = tokenCookie.value;
      }
    }
    
    // Check project_members schema
    const { data: schemaData, error: schemaError } = await anonymousClient
      .from('project_members')
      .select('id')
      .limit(1);
      
    // Try to verify the relationship
    const { data: relData, error: relError } = await anonymousClient
      .from('project_members')
      .select(`
        id,
        profiles (
          id, 
          email
        )
      `)
      .limit(1);
    
    // If we have a token, do an authenticated test
    let authTest = null;
    if (token) {
      const authClient = getAuthenticatedClient(token);
      
      try {
        const { data: authData, error: authError } = await authClient
          .from('profiles')
          .select('id, email, display_name')
          .eq('id', userId)
          .single();
          
        authTest = {
          success: !authError && !!authData,
          data: authData ? { 
            id: authData.id,
            email: authData.email,
            displayName: authData.display_name
          } : null,
          error: authError ? authError.message : null
        };
      } catch (err) {
        authTest = {
          success: false,
          error: err instanceof Error ? err.message : String(err)
        };
      }
    }
    
    return NextResponse.json({
      status: 'ok',
      user: { id: userId },
      token: token ? { 
        exists: true,
        length: token.length,
        // Add the first and last 5 characters for debugging
        preview: `${token.substring(0, 5)}...${token.substring(token.length - 5)}`
      } : { exists: false },
      anonCheck: {
        success: !anonError,
        error: anonError ? anonError.message : null
      },
      schemaCheck: {
        success: !schemaError,
        error: schemaError ? schemaError.message : null
      },
      relationshipCheck: {
        success: !relError && (relData?.[0]?.profiles !== undefined),
        error: relError ? relError.message : null,
        data: relData
      },
      authTest
    });
  } catch (error) {
    console.error('Supabase check error:', error);
    return NextResponse.json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
