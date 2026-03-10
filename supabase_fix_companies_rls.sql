-- Фикс RLS для companies

-- Удаляем старые политики
DROP POLICY IF EXISTS "Company members can view their company" ON companies;
DROP POLICY IF EXISTS "Company owners and admins can update" ON companies;
DROP POLICY IF EXISTS "Anyone can view companies by slug" ON companies;

-- Создаём новые политики

-- 1. Любой может видеть компанию по slug (для логина)
CREATE POLICY "Anyone can view companies by slug"
  ON companies FOR SELECT
  USING (true);  -- Открытый доступ для чтения (slug публичен)

-- 2. Владелец/админ может обновлять свою компанию
CREATE POLICY "Company owners and admins can update"
  ON companies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = companies.id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

-- 3. Аутентифицированный пользователь может создавать компанию
CREATE POLICY "Authenticated users can create companies"
  ON companies FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

SELECT 'RLS для companies обновлены' as status;
