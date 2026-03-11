-- Исправление RLS политик для company_members
-- Используем существующую функцию is_company_member(uuid)

-- 1. Включаем RLS
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- 2. Удаляем старые политики
DROP POLICY IF EXISTS "company_members_select" ON company_members;
DROP POLICY IF EXISTS "company_members_insert" ON company_members;
DROP POLICY IF EXISTS "company_members_update" ON company_members;
DROP POLICY IF EXISTS "company_members_delete" ON company_members;

-- 3. Политика SELECT - видят все члены компании
CREATE POLICY "company_members_select"
  ON company_members
  FOR SELECT
  TO authenticated
  USING (is_company_member(company_id));

-- 4. Политика INSERT - разрешаем вставку:
--    - При создании компании (user_id = текущий пользователь, role = owner)
--    - Или если пользователь уже активный член этой компании
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

-- 5. Политика UPDATE - только админы и владельцы
CREATE POLICY "company_members_update"
  ON company_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
      AND cm.status = 'active'
    )
  );

-- 6. Политика DELETE - только владельцы
CREATE POLICY "company_members_delete"
  ON company_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'owner'
      AND cm.status = 'active'
    )
  );

-- 7. Разрешаем видеть свои членства для создания компании
-- Это нужно чтобы пользователь мог создать первую компанию
CREATE POLICY "company_members_select_own"
  ON company_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMIT;
