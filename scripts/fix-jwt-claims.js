// Call this script to update the JWT template in Clerk
// Usage: node fix-jwt-claims.js

const { exec } = require('child_process');
require('dotenv').config();

// Function to execute shell commands with promises
function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return reject(error);
      }
      return resolve(stdout);
    });
  });
}

// Extract project reference from Supabase URL
function getProjectRef() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : '<your-project-ref>';
}

// Main function to update JWT template
async function updateJwtTemplate() {
  try {
    console.log('Updating Clerk JWT template for Supabase...');
    
    // Ensure clerk CLI is installed
    try {
      await execPromise('clerk --version');
      console.log('Clerk CLI is installed');
    } catch (error) {
      console.log('Installing Clerk CLI...');
      await execPromise('npm install -g @clerk/clerk-sdk-node');
    }
    
    // Get Clerk secret key from environment
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error('CLERK_SECRET_KEY is missing in environment variables');
    }
    
    // Get current templates
    console.log('Fetching current JWT templates...');
    const getTemplatesCmd = `curl -s -X GET "https://api.clerk.dev/v1/jwt-templates" -H "Authorization: Bearer ${clerkSecretKey}" -H "Content-Type: application/json"`;
    const templatesResponse = await execPromise(getTemplatesCmd);
    const templates = JSON.parse(templatesResponse);
    
    // Find Supabase template
    const supabaseTemplate = templates.find(t => t.name === 'supabase');
    if (!supabaseTemplate) {
      throw new Error('Supabase JWT template not found');
    }
    
    console.log('Found Supabase JWT template with ID:', supabaseTemplate.id);
    
    // Get project reference from Supabase URL
    const projectRef = getProjectRef();
    console.log('Using Supabase project reference:', projectRef);
    
    // Prepare updated claims
    const updatedClaims = {
      "aud": "authenticated",
      "email": "{{user.primary_email_address}}",
      "role": "authenticated",
      
      // Since we can't override the 'sub' claim in Clerk, we'll use our custom claim
      "supabase_user_id": "{{user.public_metadata.supabase_profile_id}}",
      
      // Include the Hasura claims with the project reference for Supabase RLS policies
      [`https://${projectRef}.supabase.co/jwt/claims`]: {
        "x-hasura-role": "authenticated",
        "x-hasura-user-id": "{{user.public_metadata.supabase_profile_id}}",
        "x-hasura-default-role": "authenticated"
      }
    };
    
    // Update the template
    console.log('Updating Supabase JWT template with corrected claims...');
    const updateTemplateCmd = `curl -s -X PATCH "https://api.clerk.dev/v1/jwt-templates/${supabaseTemplate.id}" \
      -H "Authorization: Bearer ${clerkSecretKey}" \
      -H "Content-Type: application/json" \
      -d '{"claims": ${JSON.stringify(JSON.stringify(updatedClaims))}, "lifetime": 604800}'`;
    
    const updateResponse = await execPromise(updateTemplateCmd);
    const updatedTemplate = JSON.parse(updateResponse);
    
    console.log('Successfully updated JWT template with the following claims:');
    console.log(JSON.stringify(updatedTemplate.claims, null, 2));
    console.log('\nTemplate lifetime (seconds):', updatedTemplate.lifetime);
    console.log('\nNow ensure all users have valid Supabase profile IDs by running:');
    console.log('npm run sync-uuids');
    
  } catch (error) {
    console.error('Error updating JWT template:', error);
    process.exit(1);
  }
}

// Execute the main function
updateJwtTemplate();
