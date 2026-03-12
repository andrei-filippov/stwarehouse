-- Fix role enum to include 'viewer'
-- Run this in Supabase SQL Editor

-- 1. Drop existing constraint if exists
ALTER TABLE company_members DROP CONSTRAINT IF EXISTS company_members_role_check;

-- 2. Add new constraint with all roles including 'viewer'
ALTER TABLE company_members ADD CONSTRAINT company_members_role_check 
  CHECK (role IN ('owner', 'admin', 'manager', 'accountant', 'viewer'));

-- 3. Verify the constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'company_members'::regclass
AND contype = 'c';
