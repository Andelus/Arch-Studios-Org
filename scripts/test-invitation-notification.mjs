#!/usr/bin/env node

/**
 * Test script for the in-app notification invitation system
 * 
 * This script tests the creation of notifications and direct project assignment
 * for the team invitation system.
 * 
 * Usage:
 * node scripts/test-invitation-notification.mjs [email] [projectId]
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { resolve } from 'path';
import readline from 'readline';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse command line arguments
const recipientEmail = process.argv[2];
const projectId = process.argv[3];

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function promptForInput(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function createTestNotification(email, projectId) {
  try {
    console.log('🔍 Checking if user exists...');
    
    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('email', email)
      .maybeSingle();
      
    if (userError) {
      console.error('❌ Error checking user:', userError);
      return;
    }
    
    // Get or generate project name
    let projectName = projectId || 'Test Project';
    if (projectId) {
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();
        
      if (project) {
        projectName = project.name;
      }
    } else {
      // Generate test project ID
      projectId = uuidv4();
    }
    
    if (user) {
      console.log(`✅ User found: ${user.display_name || email} (${user.id})`);
      console.log('🚀 Adding user directly to project...');
      
      // Add user directly to project
      const { error: memberError } = await supabase
        .from('project_members')
        .insert({
          project_id: projectId,
          user_id: user.id,
          role: 'Architect',
          permission: 'editor',
          created_at: new Date().toISOString(),
          invited_by: 'system'
        });
        
      if (memberError) {
        console.error('❌ Error adding user to project:', memberError);
      } else {
        console.log('✅ User added to project successfully');
      }
      
      // Create notification for the user
      console.log('📬 Creating in-app notification...');
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type: 'team_invitation',
          title: `You've been added to ${projectName}`,
          message: `You've been added to ${projectName} as an Architect with editor permissions.`,
          link: `/workspace/project/${projectId}`,
          metadata: {
            project_id: projectId,
            project_name: projectName,
            role: 'Architect',
            permission: 'editor'
          }
        });
        
      if (notificationError) {
        console.error('❌ Error creating notification:', notificationError);
      } else {
        console.log('✅ Notification created successfully');
      }
    } else {
      console.log('⚠️ User not found. Creating invitation for future processing...');
      
      // Create invitation record
      const invitationId = uuidv4();
      const { error: invitationError } = await supabase
        .from('team_invitations')
        .insert({
          id: invitationId,
          project_id: projectId,
          email: email,
          role: 'Architect',
          permission: 'editor',
          inviter_id: 'system',
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        
      if (invitationError) {
        console.error('❌ Error creating invitation:', invitationError);
      } else {
        console.log('✅ Invitation created successfully');
      }
      
      // Create notification (will be shown when user registers)
      console.log('📬 Creating notification for future processing...');
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          email: email,
          type: 'team_invitation',
          title: `You've been invited to ${projectName}`,
          message: `You've been invited to join ${projectName} as an Architect.`,
          link: `/invitation/accept?token=${invitationId}`,
          metadata: {
            project_id: projectId,
            project_name: projectName,
            invitation_id: invitationId,
            role: 'Architect',
            permission: 'editor'
          }
        });
        
      if (notificationError) {
        console.error('❌ Error creating notification:', notificationError);
      } else {
        console.log('✅ Notification created successfully');
      }
    }
    
    console.log('\n🎉 Test completed!');
    console.log('\nWhen the user logs in next time, they will:');
    console.log('1. See the notification about the project');
    console.log('2. Be automatically added to the project if not already');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function main() {
  try {
    console.log('🚀 Testing in-app notification invitation system');
    
    // Get email if not provided
    let email = recipientEmail;
    if (!email) {
      email = await promptForInput('Enter recipient email address: ');
    }
    
    if (!email || !email.includes('@')) {
      console.error('❌ Invalid email address');
      process.exit(1);
    }
    
    // Get project ID if not provided
    let projectIdToUse = projectId;
    if (!projectIdToUse) {
      const useRealProject = await promptForInput('Do you want to use an existing project? (y/n): ');
      
      if (useRealProject.toLowerCase() === 'y') {
        projectIdToUse = await promptForInput('Enter project ID: ');
      }
    }
    
    await createTestNotification(email, projectIdToUse);
    
  } catch (error) {
    console.error('❌ Unhandled error:', error);
  } finally {
    rl.close();
  }
}

// Run the test
main().catch(console.error);
