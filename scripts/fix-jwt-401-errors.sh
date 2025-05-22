#!/bin/bash

# This script specifically checks and fixes JWT claims to resolve 401 errors

# Print colored text
print_green() {
  echo -e "\033[0;32m$1\033[0m"
}

print_yellow() {
  echo -e "\033[0;33m$1\033[0m"
}

print_red() {
  echo -e "\033[0;31m$1\033[0m"
}

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
elif [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

print_green "===== JWT Claims Fix for 401 Unauthorized Errors ====="
print_yellow "This script will fix JWT claims to resolve authentication issues"

# Check if required environment variables are set
missing_vars=0
if [ -z "$CLERK_SECRET_KEY" ]; then
  print_red "Error: CLERK_SECRET_KEY is not set"
  missing_vars=1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  print_red "Error: NEXT_PUBLIC_SUPABASE_URL is not set"
  missing_vars=1
fi

if [ $missing_vars -eq 1 ]; then
  print_red "Please set all required environment variables and try again"
  exit 1
fi

# Extract project reference from URL
PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | grep -o 'https://[^.]*' | sed 's/https:\/\///')
print_yellow "Supabase Project Reference: $PROJECT_REF"

# Step 1: Check existing JWT template
print_green "\n===== Step 1: Checking existing JWT template ====="

JWT_TEMPLATES=$(curl -s -X GET "https://api.clerk.dev/v1/jwt-templates" \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  -H "Content-Type: application/json")

if [ $? -ne 0 ]; then
  print_red "Error: Failed to fetch JWT templates from Clerk"
  exit 1
fi

print_yellow "Parsing JWT templates..."
SUPABASE_TEMPLATE=$(echo $JWT_TEMPLATES | jq -r '.[] | select(.name == "supabase")')

if [ -z "$SUPABASE_TEMPLATE" ] || [ "$SUPABASE_TEMPLATE" = "null" ]; then
  print_red "Error: No Supabase JWT template found in Clerk"
  print_yellow "Creating a new template named 'supabase'..."
  
  NEW_TEMPLATE=$(curl -s -X POST "https://api.clerk.dev/v1/jwt-templates" \
    -H "Authorization: Bearer $CLERK_SECRET_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"supabase\"}")
    
  if [ $? -ne 0 ]; then
    print_red "Error: Failed to create Supabase JWT template"
    exit 1
  fi
  
  TEMPLATE_ID=$(echo $NEW_TEMPLATE | jq -r '.id')
else
  TEMPLATE_ID=$(echo $SUPABASE_TEMPLATE | jq -r '.id')
  print_yellow "Found existing Supabase template with ID: $TEMPLATE_ID"
  
  # Check if the template has the correct claims
  CURRENT_CLAIMS=$(echo $SUPABASE_TEMPLATE | jq -r '.claims')
  print_yellow "Current claims:"
  echo $CURRENT_CLAIMS | jq .
  
  SUB_CLAIM=$(echo $CURRENT_CLAIMS | jq -r '.sub')
  HASURA_PATH="https://$PROJECT_REF.supabase.co/jwt/claims"
  HASURA_USER_ID=$(echo $CURRENT_CLAIMS | jq -r ".[\"$HASURA_PATH\"][\"x-hasura-user-id\"]")
  
  if [[ $SUB_CLAIM == *"supabase_profile_id"* ]] && [[ $HASURA_USER_ID == *"supabase_profile_id"* ]]; then
    print_green "Template already has correct claim structure"
    print_yellow "However, we'll update it to ensure all values are correct"
  else
    print_red "Template has incorrect claim structure, updating..."
  fi
fi

# Step 2: Update the JWT template
print_green "\n===== Step 2: Updating JWT template ====="
print_yellow "Creating updated claims structure..."

# Create claims JSON with proper escaping
CLAIMS=$(cat <<EOF
{
  "aud": "authenticated",
  "exp": "{{exp}}",
  "sub": "{{user.public_metadata.supabase_profile_id}}",
  "email": "{{user.primary_email_address}}",
  "role": "authenticated",
  "https://$PROJECT_REF.supabase.co/jwt/claims": {
    "x-hasura-role": "authenticated",
    "x-hasura-user-id": "{{user.public_metadata.supabase_profile_id}}",
    "x-hasura-default-role": "authenticated"
  }
}
EOF
)

# Escape the JSON for curl command
ESCAPED_CLAIMS=$(echo $CLAIMS | jq -c . | sed 's/"/\\"/g')
print_yellow "Updating template with ID: $TEMPLATE_ID"

UPDATED_TEMPLATE=$(curl -s -X PATCH "https://api.clerk.dev/v1/jwt-templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"claims\": \"$ESCAPED_CLAIMS\", \"lifetime\": 604800}")

if [ $? -ne 0 ]; then
  print_red "Error: Failed to update JWT template"
  exit 1
fi

print_green "JWT template updated successfully!"
print_yellow "New claims:"
echo $UPDATED_TEMPLATE | jq -r '.claims' | jq .

# Step 3: Test the JWT generation
print_green "\n===== Step 3: Testing JWT generation ====="

# Get a user to test with
USERS=$(curl -s -X GET "https://api.clerk.dev/v1/users?limit=1" \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  -H "Content-Type: application/json")

if [ $? -ne 0 ]; then
  print_red "Error: Failed to fetch users from Clerk"
  exit 1
fi

USER_ID=$(echo $USERS | jq -r '.[0].id')

if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  print_red "Error: No users found in Clerk"
  print_yellow "Please create at least one user before running this script"
  exit 1
fi

print_yellow "Testing JWT generation for user: $USER_ID"

# Check if user has Supabase UUID in metadata
USER_DATA=$(curl -s -X GET "https://api.clerk.dev/v1/users/$USER_ID" \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  -H "Content-Type: application/json")

SUPABASE_ID=$(echo $USER_DATA | jq -r '.public_metadata.supabase_profile_id')

if [ -z "$SUPABASE_ID" ] || [ "$SUPABASE_ID" = "null" ]; then
  print_yellow "User does not have a Supabase UUID in metadata, generating one..."
  
  # Generate a UUID v4
  UUID=$(python -c 'import uuid; print(str(uuid.uuid4()))')
  
  # Update user metadata
  METADATA_UPDATE=$(curl -s -X PATCH "https://api.clerk.dev/v1/users/$USER_ID/metadata" \
    -H "Authorization: Bearer $CLERK_SECRET_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"public_metadata\": {\"supabase_profile_id\": \"$UUID\"}}")
    
  if [ $? -ne 0 ]; then
    print_red "Error: Failed to update user metadata"
    exit 1
  fi
  
  print_green "Added Supabase UUID to user metadata: $UUID"
  SUPABASE_ID=$UUID
else
  print_green "User already has Supabase UUID in metadata: $SUPABASE_ID"
fi

# Issue a token
TOKEN_RESPONSE=$(curl -s -X POST "https://api.clerk.dev/v1/users/$USER_ID/issue-token" \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"template\": \"supabase\"}")

if [ $? -ne 0 ]; then
  print_red "Error: Failed to issue token"
  exit 1
fi

JWT=$(echo $TOKEN_RESPONSE | jq -r '.jwt')
print_green "Successfully generated JWT token"

# Step 4: Verify token claims
print_green "\n===== Step 4: Verifying token claims ====="

# Extract header and payload
HEADER=$(echo $JWT | cut -d '.' -f1)
PAYLOAD=$(echo $JWT | cut -d '.' -f2)

# Function to decode base64
decode_base64() {
  local b64="$1"
  # Add padding if needed
  local pad=$(( 4 - ${#b64} % 4 ))
  if [ $pad -eq 4 ]; then pad=0; fi
  local padded="$b64$(printf '%*s' $pad | tr ' ' '=')"
  
  # Try different decoding methods (macOS vs Linux compatibility)
  echo "$padded" | base64 -d 2>/dev/null || echo "$padded" | base64 -D
}

# Decode and parse JSON
HEADER_DECODED=$(decode_base64 "$HEADER" | jq .)
PAYLOAD_DECODED=$(decode_base64 "$PAYLOAD" | jq .)

print_yellow "JWT Header:"
echo "$HEADER_DECODED"

print_yellow "JWT Payload:"
echo "$PAYLOAD_DECODED"

# Check claims
DECODED_SUB=$(echo "$PAYLOAD_DECODED" | jq -r '.sub')
DECODED_AUD=$(echo "$PAYLOAD_DECODED" | jq -r '.aud')
DECODED_ROLE=$(echo "$PAYLOAD_DECODED" | jq -r '.role')
HASURA_PATH="https://$PROJECT_REF.supabase.co/jwt/claims"
DECODED_HASURA_USER_ID=$(echo "$PAYLOAD_DECODED" | jq -r ".[\"$HASURA_PATH\"][\"x-hasura-user-id\"]")

print_yellow "\nVerifying critical claims:"
if [ "$DECODED_SUB" != "$SUPABASE_ID" ]; then
  print_red "× 'sub' claim ($DECODED_SUB) does not match expected Supabase UUID ($SUPABASE_ID)"
else
  print_green "✓ 'sub' claim matches Supabase UUID"
fi

if [ "$DECODED_AUD" != "authenticated" ]; then
  print_red "× 'aud' claim is not 'authenticated' (found: $DECODED_AUD)"
else
  print_green "✓ 'aud' claim is correctly set to 'authenticated'"
fi

if [ "$DECODED_ROLE" != "authenticated" ]; then
  print_red "× 'role' claim is not 'authenticated' (found: $DECODED_ROLE)"
else
  print_green "✓ 'role' claim is correctly set to 'authenticated'"
fi

if [ "$DECODED_HASURA_USER_ID" != "$SUPABASE_ID" ]; then
  print_red "× 'x-hasura-user-id' claim ($DECODED_HASURA_USER_ID) does not match Supabase UUID ($SUPABASE_ID)"
else
  print_green "✓ 'x-hasura-user-id' claim matches Supabase UUID"
fi

# Step 5: Test against Supabase
print_green "\n===== Step 5: Testing authentication with Supabase ====="
print_yellow "Testing access to notifications endpoint..."

NOTIFICATIONS_RESULT=$(curl -s -X GET "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/notifications?select=id,title&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $JWT")

if [[ $NOTIFICATIONS_RESULT == *"error"* ]]; then
  print_red "× Failed to access notifications"
  print_yellow "Error details:"
  echo "$NOTIFICATIONS_RESULT" | jq .
  
  # Check if it's a 401 error
  ERROR_CODE=$(echo "$NOTIFICATIONS_RESULT" | jq -r '.code')
  if [[ $ERROR_CODE == "401" ]]; then
    print_red "Authentication failed with 401 Unauthorized"
    print_yellow "This indicates a problem with JWT verification. Make sure SUPABASE_JWT_SECRET matches Clerk's JWT secret."
  fi
else
  print_green "✓ Successfully accessed notifications endpoint!"
  print_yellow "Response:"
  echo "$NOTIFICATIONS_RESULT" | jq .
fi

print_green "\n===== JWT Claims Fix Complete ====="
print_yellow "If you're still experiencing 401 errors:"
print_yellow "1. Run 'scripts/sync-auth-uuids.js' to ensure all users have UUID mappings"
print_yellow "2. Run 'scripts/fix-all-rls-policies.sql' to update database policies"
print_yellow "3. Restart your application"
