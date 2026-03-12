-- Check allowed roles in company_members table
-- Check if 'viewer' is in the enum/check constraint

-- 1. Check the column type and constraints
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'company_members' 
AND column_name = 'role';

-- 2. Check for check constraints on role column
SELECT 
  conname,
  pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'company_members'::regclass
AND contype = 'c';

-- 3. Fix: If 'viewer' is not allowed, add it
-- ALTER TABLE company_members DROP CONSTRAINT IF EXISTS company_members_role_check;
-- ALTER TABLE company_members ADD CONSTRAINT company_members_role_check 
--   CHECK (role IN ('owner', 'admin', 'manager', 'accountant', 'viewer'));
