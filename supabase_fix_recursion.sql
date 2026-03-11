-- Исправление infinite recursion в company_members RLS
-- Проблема: политика SELECT вызывает is_company_member, который делает SELECT из той же таблицы

-- 1. Включаем RLS
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- 2. Удаляем ВСЕ политики company_members
DROP POLICY IF EXISTS "company_members_select" ON company_members;
DROP POLICY IF EXISTS "company_members_select_own" ON company_members;
DROP POLICY IF EXISTS "company_members_insert" ON company_members;
DROP POLICY IF EXISTS "company_members_update" ON company_members;
DROP POLICY IF EXISTS "company_members_delete" ON company_members;

-- 3. SELECT: Видим свои записи ИЛИ записи компаний где мы активные члены
-- Важно: НЕ используем is_company_member здесь, чтобы избежать рекурсии
CREATE POLICY "company_members_select"
  ON company_members
  FOR SELECT
  TO authenticated
  USING (
    -- Свои записи
    user_id = auth.uid()
    OR
    -- Записи компаний где я активный член
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.status = 'active'
    )
  );

-- 4. INSERT: Владелец создаёт себя при регистрации компании
CREATE POLICY "company_members_insert"
  ON company_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Создание компании (себя как владельца)
    (user_id = auth.uid() AND role = 'owner')
    OR
    -- Приглашение других (если я admin/owner в этой компании)
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() 
      AND cm.role IN ('owner', 'admin')
      AND cm.status = 'active'
    )
  );

-- 5. UPDATE: Только admin/owner
CREATE POLICY "company_members_update"
  ON company_members
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() 
      AND cm.role IN ('owner', 'admin')
      AND cm.status = 'active'
    )
  );

-- 6. DELETE: Только owner
CREATE POLICY "company_members_delete"
  ON company_members
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() 
      AND cm.role = 'owner'
      AND cm.status = 'active'
    )
  );

COMMIT;
