#!/usr/bin/env ts-node
/**
 * Enhanced script to run SQL fix scripts against the Supabase database
 * Supports running different SQL files based on command-line arguments
 * 
 * Usage:
 * npx ts-node ./scripts/run-sql-script.ts <script-filename>
 * 
 * Examples:
 * npx ts-node ./scripts/run-sql-script.ts fix-profiles-relationship.sql
 * npx ts-node ./scripts/run-sql-script.ts fix-rls-policies-revised.sql
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

  // Get the SQL filename from command-line arguments
  const scriptFilename = process.argv[2] || 'fix-profiles-relationship.sql';
  
  // Create Supabase client with service role key for admin access
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Read the SQL file
  const sqlPath = path.join(__dirname, scriptFilename);
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found at ${sqlPath}`);
    console.error('Available SQL scripts:');
    
    // List available SQL scripts in scripts directory
    const scriptsDir = __dirname;
    const sqlFiles = fs.readdirSync(scriptsDir).filter(file => file.endsWith('.sql'));
    
    if (sqlFiles.length > 0) {
      sqlFiles.forEach(file => console.error(`- ${file}`));
    } else {
      console.error('No SQL scripts (.sql files) found in scripts directory');
    }
    
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  try {
    console.log(`Starting database fix using "${scriptFilename}"...`);
    
    // Execute the SQL in chunks if needed (some SQL files might be too large)
    const statements = sql
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* ... */ comments
      .replace(/--.*$/gm, '') // Remove -- comments
      .split(';')
      .filter(stmt => stmt.trim().length > 0); // Remove empty statements
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    let failedStatements = 0;
    
    // Execute each statement individually for better error reporting
    for(let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if(!stmt) continue;
      
      try {
        console.log(`Executing statement ${i+1}/${statements.length}...`);
        const { error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });
        
        if (error) {
          console.error(`Error executing statement ${i+1}:`, error);
          console.error('Statement:', stmt);
          failedStatements++;
          
          // For certain errors, we might want to continue
          if (error.message.includes('does not exist') || 
              error.message.includes('already exists')) {
            console.log('Continuing despite error (object might not exist or already exists)');
            continue;
          }
          
          // Ask user if they want to continue
          const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          const response = await new Promise<string>(resolve => {
            readline.question('Continue execution? (y/n): ', resolve);
          });
          
          readline.close();
          
          if (response.toLowerCase() !== 'y') {
            console.log('Execution aborted by user');
            process.exit(1);
          }
        } else {
          console.log(`Statement ${i+1} executed successfully`);
        }
      } catch (stmtError) {
        console.error(`Error executing statement ${i+1}:`, stmtError);
        failedStatements++;
      }
    }
    
    console.log('SQL execution complete!');
    console.log(`${statements.length - failedStatements}/${statements.length} statements executed successfully`);
    
    if (failedStatements > 0) {
      console.log(`${failedStatements} statements failed - check logs above for details`);
    }
    
    // Only verify relationship check if we're running the profile relationship fix
    if (scriptFilename === 'fix-profiles-relationship.sql') {
      console.log('Verifying the relationship was fixed...');
      
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
    } else if (scriptFilename === 'fix-rls-policies-revised.sql') {
      console.log('Verifying RLS policies...');
      
      // Try to verify policies were updated
      const { data: policiesData, error: policiesError } = await supabase.rpc('exec_sql', { 
        sql_query: "SELECT tablename, policyname, cmd, permissive, roles, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;" 
      });
      
      if (policiesError) {
        console.error('Error checking policies:', policiesError);
        console.log('Could not verify if policies were updated.');
      } else if (policiesData) {
        console.log('Policies have been updated!');
        console.log('Current policies:', policiesData.length);
      }
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
