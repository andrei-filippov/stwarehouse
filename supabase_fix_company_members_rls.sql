-- Исправление RLS политик для company_members

-- 1. Включаем RLS
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- 2. Удаляем старые политики
DROP POLICY IF EXISTS "company_members_select" ON company_members;
DROP POLICY IF EXISTS "company_members_insert" ON company_members;
DROP POLICY IF EXISTS "company_members_update" ON company_members;
DROP POLICY IF EXISTS "company_members_delete" ON company_members;

-- 3. Удаляем старую функцию и создаём новую
DROP FUNCTION IF EXISTS is_company_member(uuid);

CREATE OR REPLACE FUNCTION is_company_member(p_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id
    AND user_id = auth.uid()
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Политика SELECT - видят все члены компании
CREATE POLICY "company_members_select"
  ON company_members
  FOR SELECT
  TO authenticated
  USING (is_company_member(company_id));

-- 5. Политика INSERT - разрешаем вставку для:
--    - Активных членов компании
--    - При создании компании (проверяем через company_id)
CREATE POLICY "company_members_insert"
  ON company_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Пользователь может добавить себя как владельца при создании компании
    (user_id = auth.uid() AND role = 'owner' AND status = 'active')
    OR
    -- Или если он уже активный член этой компании
    is_company_member(company_id)
  );

-- 6. Политика UPDATE - только админы и владельцы
CREATE POLICY "company_members_update"
  ON company_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = company_members.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

-- 7. Политика DELETE - только владельцы
CREATE POLICY "company_members_delete"
  ON company_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = company_members.company_id
      AND user_id = auth.uid()
      AND role = 'owner'
      AND status = 'active'
    )
  );

-- 8. Разрешаем anon читать (если нужно для публичных страниц)
-- CREATE POLICY "company_members_select_anon"
--   ON company_members
--   FOR SELECT
--   TO anon
--   USING (false); -- или true если нужно

COMMIT;
