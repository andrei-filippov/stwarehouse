-- Быстрый фикс RLS политик для company_members

-- Отключаем RLS временно для проверки
ALTER TABLE company_members DISABLE ROW LEVEL SECURITY;

-- Включаем обратно
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики
DROP POLICY IF EXISTS "Members can view company members" ON company_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON company_members;
DROP POLICY IF EXISTS "Users can insert own memberships" ON company_members;
DROP POLICY IF EXISTS "Owners and admins can manage members" ON company_members;

-- Создаём новые политики
-- 1. Пользователь видит свои членства
CREATE POLICY "Users can view own memberships" 
  ON company_members FOR SELECT 
  USING (user_id = auth.uid());

-- 2. Пользователь может создавать свои членства (при регистрации)
CREATE POLICY "Users can insert own memberships" 
  ON company_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 3. Пользователь может обновлять свои членства
CREATE POLICY "Users can update own memberships" 
  ON company_members FOR UPDATE
  USING (user_id = auth.uid());

-- 4. Проверка: пользователи могут видеть членов своих компаний
CREATE POLICY "Users can view company members" 
  ON company_members FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM company_members AS cm
      WHERE cm.company_id = company_members.company_id 
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

SELECT 'RLS политики обновлены' as status;
