-- Исправление INSERT политики для company_members

-- Удаляем старую INSERT политику
DROP POLICY IF EXISTS "company_members_insert" ON company_members;
DROP POLICY IF EXISTS "company_members_insert_owner" ON company_members;

-- Разрешаем INSERT если:
-- 1. Пользователь добавляет себя как владельца (для создания компании)
-- 2. ИЛИ пользователь уже является членом этой компании
CREATE POLICY "company_members_insert"
  ON company_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Случай 1: Создание новой компании (владелец добавляет себя)
    (user_id = auth.uid() AND role = 'owner')
    OR
    -- Случай 2: Добавление других пользователей существующими членами
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

-- Также проверим политики для companies
DROP POLICY IF EXISTS "companies_insert" ON companies;
DROP POLICY IF EXISTS "companies_insert_any" ON companies;

-- Разрешаем создание компаний всем аутентифицированным
CREATE POLICY "companies_insert"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Обновляем политики для companies (разрешаем чтение членам)
DROP POLICY IF EXISTS "companies_select" ON companies;

CREATE POLICY "companies_select"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = companies.id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
    OR
    -- Или если это новая компания без членов (для создания)
    NOT EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = companies.id
    )
  );

COMMIT;
