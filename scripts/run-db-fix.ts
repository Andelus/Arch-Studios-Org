#!/usr/bin/env ts-node
/**
 * This script runs the SQL to fix the relationship between project_members and profiles
 * It reads the SQL file and executes it against the Supabase database
 * 
 * Usage:
 * npx ts-node ./scripts/run-db-fix.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function main() {
  // Check if we have the required environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables:');
    if (!supabaseUrl) console.error('- NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseServiceKey) console.error('- SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Create Supabase client with service role key for admin access
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Read the SQL file
  const sqlPath = path.join(__dirname, 'fix-profiles-relationship.sql');
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found at ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    console.log('Starting database fix...');
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Error executing SQL:', error);
      process.exit(1);
    }
    
    console.log('SQL executed successfully!');
    
    // Verify the relationship was fixed
    const { data: checkData, error: checkError } = await supabase
      .from('project_members')
      .select(`
        id,
        profiles: user_id (id, email)
      `)
      .limit(1);
      
    if (checkError) {
      console.error('Error checking relationship:', checkError);
      console.log('The SQL executed, but relationship verification failed.');
      process.exit(1);
    }
    
    if (checkData && checkData.length > 0 && checkData[0].profiles) {
      console.log('Relationship verification succeeded!');
      console.log('Sample data:', JSON.stringify(checkData[0], null, 2));
    } else {
      console.log('SQL executed but relationship appears to still have issues.');
      console.log('You may need manual database inspection.');
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

main()
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
