-- Fix audit_logs RLS policies - admins should only see logs of THEIR companies
-- Also allow viewing login/logout logs (company_id IS NULL) for user's own actions

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "audit_logs_select_admin" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_own" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;

-- Policy 1: Admins see logs of their companies (including company_id = NULL for their own login/logout)
CREATE POLICY "audit_logs_select_admin" ON audit_logs FOR SELECT
  USING (
    -- User is admin/owner of the company this log belongs to
    (
      company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.user_id = auth.uid()
        AND cm.company_id = audit_logs.company_id
        AND cm.role IN ('owner', 'admin')
        AND cm.status = 'active'
      )
    )
    OR
    -- User sees their own login/logout logs (company_id IS NULL)
    (
      company_id IS NULL
      AND user_id = auth.uid()
    )
  );

-- Policy 2: Regular users see only their own logs
CREATE POLICY "audit_logs_select_own" ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- Policy 3: Insert via RPC (SECURITY DEFINER functions bypass RLS)
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  WITH CHECK (true);

-- Add comment
COMMENT ON POLICY "audit_logs_select_admin" ON audit_logs IS 
  'Admins see logs of their companies + their own login/logout events';
