-- Временное отключение RLS для company_members (экстренное решение)
ALTER TABLE company_members DISABLE ROW LEVEL SECURITY;

-- Или альтернатива - разрешить всё для authenticated
DROP POLICY IF EXISTS "company_members_all" ON company_members;

CREATE POLICY "company_members_all"
  ON company_members
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;
