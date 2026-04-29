-- ============================================================
-- Исправление audit_logs — добавление company_id
-- ============================================================

-- 1. Добавляем company_id в audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 2. Заполняем company_id известными значениями (по user_id)
UPDATE audit_logs al
SET company_id = (
  SELECT cm.company_id 
  FROM company_members cm 
  WHERE cm.user_id = al.user_id 
  AND cm.status = 'active'
  LIMIT 1
)
WHERE company_id IS NULL;

-- 3. Обновляем функцию create_audit_log чтобы записывать company_id
CREATE OR REPLACE FUNCTION create_audit_log(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
  v_company_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  SELECT name, email INTO v_user_name, v_user_email
  FROM profiles
  WHERE id = v_user_id;

  SELECT company_id INTO v_company_id
  FROM company_members
  WHERE user_id = v_user_id
  AND status = 'active'
  ORDER BY joined_at DESC
  LIMIT 1;

  INSERT INTO audit_logs (
    user_id, user_name, user_email, company_id,
    action, entity_type, entity_id, entity_name,
    old_data, new_data
  ) VALUES (
    v_user_id, v_user_name, v_user_email, v_company_id,
    p_action, p_entity_type, p_entity_id, p_entity_name,
    p_old_data, p_new_data
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- 4. Пересоздаём политики audit_logs
DROP POLICY IF EXISTS "audit_logs_select_admin" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_own" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;

-- Админы видят логи своей компании
CREATE POLICY "audit_logs_select_admin" ON audit_logs FOR SELECT
  USING (
    company_id IS NOT NULL
    AND is_company_member(company_id)
    AND EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = audit_logs.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
      AND cm.status = 'active'
    )
  );

-- Пользователи видят только свои логи
CREATE POLICY "audit_logs_select_own" ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- Вставка только через service_role
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 5. Индекс
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);

SELECT 'audit_logs исправлены' as status;
