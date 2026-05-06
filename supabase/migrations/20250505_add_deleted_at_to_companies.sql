-- Add soft delete support to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Create index for filtering deleted companies
CREATE INDEX IF NOT EXISTS idx_companies_deleted_at ON companies(deleted_at) WHERE deleted_at IS NOT NULL;

-- Update RLS policies
-- Policy: users can see non-deleted companies they are members of
-- Owners can also see their deleted companies (for restore)
DROP POLICY IF EXISTS "companies_select" ON companies;
CREATE POLICY "companies_select" ON companies
  FOR SELECT USING (
    deleted_at IS NULL AND (
      id IN (
        SELECT company_id FROM company_members 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
    OR
    -- Owner can see deleted company too
    (
      deleted_at IS NOT NULL
      AND id IN (
        SELECT company_id FROM company_members 
        WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
      )
    )
  );

-- Policy: only owner can update (including soft delete)
DROP POLICY IF EXISTS "companies_update" ON companies;
CREATE POLICY "companies_update" ON companies
  FOR UPDATE USING (
    id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
  );
