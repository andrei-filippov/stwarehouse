-- ============================================
-- Таблица записей о зарплатах
-- ============================================
CREATE TABLE IF NOT EXISTS salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_id UUID NOT NULL,
  month TEXT NOT NULL, -- YYYY-MM
  projects JSONB DEFAULT '[]'::jsonb, -- [{name, amount, date}]
  total_calculated DECIMAL(12, 2) NOT NULL DEFAULT 0,
  paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, staff_id, month)
);

-- ============================================
-- RLS политики для зарплат
-- ============================================
ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salary_select_company" ON salary_records;
CREATE POLICY "salary_select_company" ON salary_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = salary_records.company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "salary_insert_company" ON salary_records;
CREATE POLICY "salary_insert_company" ON salary_records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = salary_records.company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "salary_update_company" ON salary_records;
CREATE POLICY "salary_update_company" ON salary_records
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = salary_records.company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "salary_delete_company" ON salary_records;
CREATE POLICY "salary_delete_company" ON salary_records
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = salary_records.company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

-- ============================================
-- Триггер для обновления updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_salary_records_updated_at ON salary_records;
CREATE TRIGGER update_salary_records_updated_at BEFORE UPDATE ON salary_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Real-time публикация
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'salary_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE salary_records;
  END IF;
END $$;
