-- Migration: add is_private to goals table
-- Created: 2026-05-13

-- Add is_private column
ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- Update existing rows to FALSE (they were all public before)
UPDATE goals SET is_private = FALSE WHERE is_private IS NULL;

-- Add RLS policy for private goals (users can only see their own private goals)
-- First check if the policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'goals' 
    AND policyname = 'Users can view own private goals'
  ) THEN
    CREATE POLICY "Users can view own private goals" ON goals
      FOR SELECT USING (
        is_private = FALSE 
        OR user_id = auth.uid()
      );
  END IF;
END
$$;
