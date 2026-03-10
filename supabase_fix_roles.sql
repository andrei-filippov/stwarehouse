-- Исправляем roles в политиках с public на authenticated

-- 1. Пересоздаём политики для company_members с правильными roles
DROP POLICY IF EXISTS "Users can view own memberships" ON company_members;
DROP POLICY IF EXISTS "Users can insert own memberships" ON company_members;
DROP POLICY IF EXISTS "Users can update own memberships" ON company_members;
DROP POLICY IF EXISTS "Users can delete own memberships" ON company_members;

CREATE POLICY "Users can view own memberships" 
  ON company_members FOR SELECT 
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own memberships" 
  ON company_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own memberships" 
  ON company_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own memberships" 
  ON company_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 2. Исправляем политики для companies
DROP POLICY IF EXISTS "Anyone can view companies" ON companies;
DROP POLICY IF EXISTS "Authenticated users can create companies" ON companies;
DROP POLICY IF EXISTS "Company owners can update" ON companies;

CREATE POLICY "Anyone can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Company owners can update"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = companies.id
      AND user_id = auth.uid()
      AND role = 'owner'
      AND status = 'active'
    )
  );

SELECT 'Политики обновлены' as status;
