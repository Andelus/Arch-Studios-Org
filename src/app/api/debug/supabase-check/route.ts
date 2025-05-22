import { NextRequest, NextResponse } from 'next/server';
import { supabase, getAuthenticatedClient } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

/**
 * This API route allows checking the Supabase connection and schema
 * Use it to diagnose authentication and schema issues
 */
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
    
    // Check the notifications table schema
    const { data: notificationsInfo, error: notificationsError } = await supabase
      .from('notifications')
      .select('*')
      .limit(1);
      
    // Check project_members schema
    const { data: membersInfo, error: membersError } = await supabase
      .from('project_members')
      .select('*')
      .limit(1);
    
    // Try fetching profiles for debugging
    const { data: profilesInfo, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', userId)
      .single();
      
    // Try a relationship query
    const { data: relationshipData, error: relationshipError } = await supabase
      .from('project_members')
      .select(`
        id,
        project_id,
        user_id,
        profiles:user_id (
          id,
          email,
          display_name
        )
      `)
      .limit(1);
      
    return NextResponse.json({
      status: 'success',
      userId,
      schema: {
        notifications: {
          success: !notificationsError,
          error: notificationsError ? notificationsError.message : null,
          sampleSchema: notificationsInfo ? Object.keys(notificationsInfo[0] || {}) : []
        },
        members: {
          success: !membersError,
          error: membersError ? membersError.message : null,
          sampleSchema: membersInfo ? Object.keys(membersInfo[0] || {}) : []
        },
        profiles: {
          success: !profilesError,
          error: profilesError ? profilesError.message : null,
          found: !!profilesInfo
        },
        relationship: {
          success: !relationshipError,
          error: relationshipError ? relationshipError.message : null,
          data: relationshipData
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json({ 
      status: 'error',
      message: error.message
    }, { status: 500 });
  }
}
