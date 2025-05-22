#!/bin/bash

# Script to apply JWT authentication fixes from temp directory to source

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

# Check if temp_fix directory exists
if [ ! -d "./temp_fix" ]; then
  print_red "Error: temp_fix directory not found"
  exit 1
fi

print_green "===== Applying JWT authentication fixes ====="

# Create backup directory if it doesn't exist
if [ ! -d "./backups" ]; then
  mkdir ./backups
  print_yellow "Created backups directory"
fi

# Get current timestamp for backup naming
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
print_yellow "Creating backups with timestamp: $TIMESTAMP"

# 1. Apply middleware fix
if [ -f "./temp_fix/middleware.ts" ]; then
  print_yellow "Applying middleware.ts fix..."
  
  # Create backup
  cp ./src/middleware.ts ./backups/middleware.ts.$TIMESTAMP.bak
  
  # Apply fix
  cp ./temp_fix/middleware.ts ./src/middleware.ts
  
  print_green "✓ Applied middleware.ts fix"
else
  print_red "× middleware.ts fix not found in temp_fix directory"
fi

# 2. Apply auth-sync fix
if [ -f "./temp_fix/auth-sync.tsx" ]; then
  print_yellow "Applying auth-sync.tsx fix..."
  
  # Create backup
  cp ./src/lib/auth-sync.tsx ./backups/auth-sync.tsx.$TIMESTAMP.bak
  
  # Apply fix
  cp ./temp_fix/auth-sync.tsx ./src/lib/auth-sync.tsx
  
  print_green "✓ Applied auth-sync.tsx fix"
else
  print_red "× auth-sync.tsx fix not found in temp_fix directory"
fi

# 3. Apply useNotifications fix
if [ -f "./temp_fix/useNotifications.ts" ]; then
  print_yellow "Applying useNotifications.ts fix..."
  
  # Create backup
  cp ./src/hooks/useNotifications.ts ./backups/useNotifications.ts.$TIMESTAMP.bak
  
  # Apply fix
  cp ./temp_fix/useNotifications.ts ./src/hooks/useNotifications.ts
  
  print_green "✓ Applied useNotifications.ts fix"
else
  print_red "× useNotifications.ts fix not found in temp_fix directory"
fi

# 4. Run the JWT claim update script if it exists
if [ -f "./scripts/fix-jwt-claims.js" ]; then
  print_yellow "Running fix-jwt-claims.js script..."
  
  # Make executable
  chmod +x ./scripts/fix-jwt-claims.js
  
  # Run script
  node ./scripts/fix-jwt-claims.js
  
  if [ $? -eq 0 ]; then
    print_green "✓ Successfully ran fix-jwt-claims.js"
  else
    print_red "× Error running fix-jwt-claims.js"
  fi
else
  print_red "× fix-jwt-claims.js script not found"
fi

# 5. Run the SQL fixes if they exist
if [ -f "./scripts/fix-all-rls-policies.sql" ]; then
  print_yellow "✓ fix-all-rls-policies.sql is available"
  print_yellow "To apply database fixes, please run:"
  print_yellow "  ./scripts/fix-auth.sh"
else
  print_red "× fix-all-rls-policies.sql script not found"
fi

print_green "===== JWT authentication fixes applied ====="
print_yellow "Please restart your application to apply all changes."
print_yellow "To test the authentication, run:"
print_yellow "  ./scripts/test-auth.sh"
