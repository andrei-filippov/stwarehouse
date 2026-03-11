-- Разрешаем приглашения (вставку с null user_id)
DROP POLICY IF EXISTS "company_members_insert" ON company_members;

CREATE POLICY "company_members_insert"
  ON company_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Создание компании (владелец)
    (user_id = auth.uid() AND role = 'owner')
    OR
    -- Приглашение других (только admin/owner)
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
      AND cm.status = 'active'
    )
  );

-- Разрешаем просмотр приглашений для компании
DROP POLICY IF EXISTS "company_members_select_own" ON company_members;

CREATE POLICY "company_members_select"
  ON company_members
  FOR SELECT
  TO authenticated
  USING (
    -- Свои членства
    user_id = auth.uid()
    OR
    -- Членства компании где я участник
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

COMMIT;
