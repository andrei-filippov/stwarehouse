-- Настройка RLS для company_members без рекурсии
-- Важно: используем SECURITY DEFINER функции или прямые проверки

-- 1. Сначала включаем RLS
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- 2. Удаляем все старые политики
DROP POLICY IF EXISTS "company_members_all" ON company_members;
DROP POLICY IF EXISTS "company_members_select" ON company_members;
DROP POLICY IF EXISTS "company_members_insert" ON company_members;
DROP POLICY IF EXISTS "company_members_update" ON company_members;
DROP POLICY IF EXISTS "company_members_delete" ON company_members;

-- 3. Создаём функцию для проверки членства (SECURITY DEFINER - выполняется с правами владельца)
-- Это безопасно, так как функция не делает RLS-проверок
CREATE OR REPLACE FUNCTION check_company_access(p_company_id uuid, p_required_role text DEFAULT null)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_required_role IS NULL THEN
    -- Проверяем только что пользователь активный член
    RETURN EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND status = 'active'
    );
  ELSE
    -- Проверяем конкретную роль
    RETURN EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND role = p_required_role::company_role
      AND status = 'active'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION check_company_access(uuid, text) TO authenticated;

-- 4. SELECT: Видим свои записи ИЛИ записи компаний где мы члены
CREATE POLICY "company_members_select"
  ON company_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    check_company_access(company_id)
  );

-- 5. INSERT: Себя как владельца при создании компании ИЛИ если мы admin/owner
CREATE POLICY "company_members_insert"
  ON company_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role = 'owner')
    OR
    check_company_access(company_id, 'owner')
    OR
    check_company_access(company_id, 'admin')
  );

-- 6. UPDATE: Только admin/owner
CREATE POLICY "company_members_update"
  ON company_members
  FOR UPDATE
  TO authenticated
  USING (
    check_company_access(company_id, 'owner')
    OR
    check_company_access(company_id, 'admin')
  );

-- 7. DELETE: Только owner
CREATE POLICY "company_members_delete"
  ON company_members
  FOR DELETE
  TO authenticated
  USING (
    check_company_access(company_id, 'owner')
  );

COMMIT;
