-- Финальный фикс RLS политик

-- ============================================
-- 1. Полный сброс политик для company_members
-- ============================================

ALTER TABLE company_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own memberships" ON company_members;
DROP POLICY IF EXISTS "Users can insert own memberships" ON company_members;
DROP POLICY IF EXISTS "Users can update own memberships" ON company_members;
DROP POLICY IF EXISTS "Users can view company members" ON company_members;
DROP POLICY IF EXISTS "Owners and admins can manage members" ON company_members;

-- Главная политика: пользователь видит свои членства (простая, без подзапросов)
CREATE POLICY "Users can view own memberships" 
  ON company_members FOR SELECT 
  USING (user_id = auth.uid());

-- Пользователь может создавать свои членства
CREATE POLICY "Users can insert own memberships" 
  ON company_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Пользователь может обновлять свои членства
CREATE POLICY "Users can update own memberships" 
  ON company_members FOR UPDATE
  USING (user_id = auth.uid());

-- Пользователь может удалять свои членства
CREATE POLICY "Users can delete own memberships" 
  ON company_members FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- 2. Полный сброс политик для companies
-- ============================================

ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view companies by slug" ON companies;
DROP POLICY IF EXISTS "Authenticated users can create companies" ON companies;
DROP POLICY IF EXISTS "Company owners and admins can update" ON companies;

-- Любой может видеть компании (для логина по slug)
CREATE POLICY "Anyone can view companies"
  ON companies FOR SELECT
  USING (true);

-- Аутентифицированный может создавать
CREATE POLICY "Authenticated users can create companies"
  ON companies FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Владелец может обновлять
CREATE POLICY "Company owners can update"
  ON companies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = companies.id
      AND user_id = auth.uid()
      AND role = 'owner'
      AND status = 'active'
    )
  );

-- ============================================
-- 3. Проверка
-- ============================================

SELECT 'RLS политики обновлены успешно' as status;

-- Тестовый запрос
SELECT 
  cm.id as member_id,
  cm.role,
  cm.status,
  c.id as company_id,
  c.name as company_name,
  c.slug
FROM company_members cm
JOIN companies c ON c.id = cm.company_id
WHERE cm.user_id = auth.uid()
LIMIT 5;
