-- RLS политики для новых таблиц (income_manual_entries, salary_records)
-- Выполните в Supabase SQL Editor

-- ============================================
-- income_manual_entries
-- ============================================

-- Включаем RLS
ALTER TABLE income_manual_entries ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "Users can view manual incomes for their company" ON income_manual_entries;
DROP POLICY IF EXISTS "Users can insert manual incomes for their company" ON income_manual_entries;
DROP POLICY IF EXISTS "Users can update manual incomes for their company" ON income_manual_entries;
DROP POLICY IF EXISTS "Users can delete manual incomes for their company" ON income_manual_entries;

-- Политика: просмотр (только своя компания)
CREATE POLICY "Users can view manual incomes for their company"
  ON income_manual_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = income_manual_entries.company_id
      AND cm.user_id = auth.uid()
    )
  );

-- Политика: вставка (только своя компания)
CREATE POLICY "Users can insert manual incomes for their company"
  ON income_manual_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = income_manual_entries.company_id
      AND cm.user_id = auth.uid()
    )
  );

-- Политика: обновление (только своя компания)
CREATE POLICY "Users can update manual incomes for their company"
  ON income_manual_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = income_manual_entries.company_id
      AND cm.user_id = auth.uid()
    )
  );

-- Политика: удаление (только своя компания)
CREATE POLICY "Users can delete manual incomes for their company"
  ON income_manual_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = income_manual_entries.company_id
      AND cm.user_id = auth.uid()
    )
  );

-- ============================================
-- salary_records
-- ============================================

-- Включаем RLS
ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "Users can view salary records for their company" ON salary_records;
DROP POLICY IF EXISTS "Users can insert salary records for their company" ON salary_records;
DROP POLICY IF EXISTS "Users can update salary records for their company" ON salary_records;
DROP POLICY IF EXISTS "Users can delete salary records for their company" ON salary_records;

-- Политика: просмотр (только своя компания)
CREATE POLICY "Users can view salary records for their company"
  ON salary_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = salary_records.company_id
      AND cm.user_id = auth.uid()
    )
  );

-- Политика: вставка (только своя компания)
CREATE POLICY "Users can insert salary records for their company"
  ON salary_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = salary_records.company_id
      AND cm.user_id = auth.uid()
    )
  );

-- Политика: обновление (только своя компания)
CREATE POLICY "Users can update salary records for their company"
  ON salary_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = salary_records.company_id
      AND cm.user_id = auth.uid()
    )
  );

-- Политика: удаление (только своя компания)
CREATE POLICY "Users can delete salary records for their company"
  ON salary_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = salary_records.company_id
      AND cm.user_id = auth.uid()
    )
  );

-- ============================================
-- Триггеры для updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Для income_manual_entries
DROP TRIGGER IF EXISTS update_income_manual_entries_updated_at ON income_manual_entries;
CREATE TRIGGER update_income_manual_entries_updated_at
  BEFORE UPDATE ON income_manual_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Для salary_records
DROP TRIGGER IF EXISTS update_salary_records_updated_at ON salary_records;
CREATE TRIGGER update_salary_records_updated_at
  BEFORE UPDATE ON salary_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Индексы для производительности
-- ============================================

CREATE INDEX IF NOT EXISTS idx_income_manual_entries_company_id ON income_manual_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_income_manual_entries_date ON income_manual_entries(date);
CREATE INDEX IF NOT EXISTS idx_salary_records_company_id ON salary_records(company_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_staff_id ON salary_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_month ON salary_records(month);
