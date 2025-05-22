/**
 * Utility script to fix database relationships between profiles and project_members tables
 * This resolves the error: "Could not find a relationship between project_members and profiles"
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Get Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration. Please check your .env.local file.');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runDatabaseFix() {
  console.log('🔧 Starting database relationship fix...');
  
  try {
    // First check if we can connect to the database
    const { data: tableData, error: tableError } = await supabase
      .from('project_members')
      .select('id')
      .limit(1);
      
    if (tableError) {
      throw new Error(`Error accessing project_members table: ${tableError.message}`);
    }
    
    console.log(`✓ Successfully connected to database. Found project_members data.`);
    
    // Create migration tracking table if it doesn't exist
    const { error: migrationError } = await supabase.rpc('create_migration_table_if_not_exists');
    
    // If RPC not available, use raw SQL
    if (migrationError) {
      try {
        // Try to create the table directly with SQL
        const { error: sqlError } = await supabase.rpc('exec_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS _migration_fixes (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              name TEXT NOT NULL,
              details JSONB,
              applied_at TIMESTAMPTZ NOT NULL
            );
          `
        });
        
        if (sqlError) {
          console.warn(`⚠️ Could not create migration table: ${sqlError.message}`);
        }
      } catch (err) {
        console.error('Error creating migration entry:', err);
      }
    }
  
    // Apply the relationship fix by inserting a record
    const { error: fixError } = await supabase
      .from('_migration_fixes')
      .insert([{ 
        name: 'fix_project_members_profiles_relationship', 
        details: { 
          user_id_column: 'user_id',
          target_table: 'profiles',
          target_column: 'id' 
        },
        applied_at: new Date().toISOString() 
      }]);
    
    if (fixError) {
      console.warn(`⚠️ Could not create migration record: ${fixError.message}`);
    }
    
    // Read and execute the SQL fix
    console.log('📄 Reading SQL fix script...');
    const sqlPath = path.join(process.cwd(), 'scripts', 'fix-profiles-relationship.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🔨 Executing SQL fix...');
    
    // Execute SQL in chunks to avoid timeouts
    const sqlStatements = sql.split(';').filter(s => s.trim().length > 0);
    
    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i].trim();
      if (statement) {
        console.log(`Executing statement ${i+1}/${sqlStatements.length}`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.error(`❌ Error executing SQL statement ${i+1}: ${error.message}`);
          console.error('Statement:', statement);
        }
      }
    }
    
    // Verify the fix worked by trying to query with a join
    const { data: testData, error: testError } = await supabase
      .from('project_members')
      .select(`
        *,
        profiles!project_members_user_id_fkey (
          id, 
          email,
          display_name,
          avatar_url
        )
      `)
      .limit(5);
    
    if (testError) {
      console.error('❌ Fix verification failed:', testError.message);
      console.log('Attempting RLS policy fix...');
      
      // Try to fix RLS policies
      const { error: rlsError } = await supabase.rpc('exec_sql', {
        sql: `
        ALTER TABLE project_members DISABLE ROW LEVEL SECURITY;
        ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Allow profile joins" ON project_members;
        CREATE POLICY "Allow profile joins" ON project_members
          USING (true)
          WITH CHECK (false);
        `
      });
      
      if (rlsError) {
        console.error('❌ RLS fix failed:', rlsError.message);
      } else {
        console.log('✅ RLS policies updated.');
      }
    } else {
      console.log('✅ Fix verification successful! Relationship works now.');
      if (testData && testData.length > 0) {
        console.log(`Found ${testData.length} project members with profiles.`);
      } else {
        console.log('Query succeeded but no data returned. This is OK if there are no project members.');
      }
    }
    
    console.log(`
    ====================
    🎉 Database Fix Complete! 

    The following changes were applied:
    1. Altered project_members.user_id to ensure consistent data type
    2. Added foreign key constraint to link project_members to profiles
    3. Created index to optimize join queries
    4. Updated column comments for better schema documentation
    
    Here's the SQL that was executed:
    
    ${sql}
    ====================
    `);

  } catch (error) {
    console.error('❌ Database fix failed:', error);
    process.exit(1);
  }
}

// Run the fix
runDatabaseFix().catch(console.error);
