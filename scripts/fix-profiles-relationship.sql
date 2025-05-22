-- Fix for the relationship between project_members and profiles
-- This adds the missing foreign key and index between project_members.user_id and profiles.id

-- First, ensure the schema is consistent by checking data types
-- Check if user_id in project_members is TEXT and profiles.id is UUID
ALTER TABLE project_members ALTER COLUMN user_id TYPE TEXT;

-- Create explicit foreign key relationship if it doesn't exist
DO $$
BEGIN
    -- If the foreign key doesn't exist, add it
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'project_members_user_id_fkey'
    ) THEN
        -- Add an explicit reference
        ALTER TABLE project_members
        ADD CONSTRAINT project_members_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES profiles(id);
    END IF;
END
$$;

-- Create index to optimize join queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_project_members_user_id_profiles
ON project_members(user_id);

-- Update project_members query capabilities
COMMENT ON TABLE project_members IS 'Project team members with explicit relationship to profiles';
COMMENT ON COLUMN project_members.user_id IS 'References profiles(id)';

-- Update any views or functions that might use these tables
NOTIFY pgrst, 'reload schema';
