-- ============================================
-- Исправление RLS политик для staff (мультиарендность)
-- ============================================

-- Удаляем старые политики
DROP POLICY IF EXISTS "Users can delete own staff" ON staff;
DROP POLICY IF EXISTS "Users can delete their own staff" ON staff;
DROP POLICY IF EXISTS "Users can insert own staff" ON staff;
DROP POLICY IF EXISTS "Users can insert their own staff" ON staff;
DROP POLICY IF EXISTS "Users can update own staff" ON staff;
DROP POLICY IF EXISTS "Users can update their own staff" ON staff;
DROP POLICY IF EXISTS "Users can view all staff" ON staff;
DROP POLICY IF EXISTS "Users can view own staff" ON staff;
DROP POLICY IF EXISTS "Users can view their own staff" ON staff;
DROP POLICY IF EXISTS "staff_delete" ON staff;
DROP POLICY IF EXISTS "staff_insert" ON staff;
DROP POLICY IF EXISTS "staff_select" ON staff;
DROP POLICY IF EXISTS "staff_update" ON staff;

-- Создаем новые политики на основе company_id

-- SELECT: пользователь может видеть сотрудников своей компании
CREATE POLICY "staff_select_company" ON staff
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = staff.company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

-- INSERT: пользователь может добавлять сотрудников в свою компанию
CREATE POLICY "staff_insert_company" ON staff
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = staff.company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

-- UPDATE: пользователь может обновлять сотрудников своей компании
CREATE POLICY "staff_update_company" ON staff
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = staff.company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

-- DELETE: пользователь может удалять сотрудников своей компании
CREATE POLICY "staff_delete_company" ON staff
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = staff.company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

-- Проверяем результат
SELECT policyname, cmd, qual::text
FROM pg_policies
WHERE tablename = 'staff';
