-- ============================================
-- Миграция: зарплаты + даты мероприятий + оклад
-- Выполните этот скрипт в SQL Editor Supabase Dashboard
-- ============================================

-- ============================================
-- 1. Таблица записей о зарплатах (если не существует)
-- ============================================
CREATE TABLE IF NOT EXISTS salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_id UUID NOT NULL,
  month TEXT NOT NULL, -- YYYY-MM
  projects JSONB DEFAULT '[]'::jsonb, -- [{name, amount, date}]
  payments JSONB DEFAULT '[]'::jsonb, -- [{id, amount, date, type, notes}]
  total_calculated DECIMAL(12, 2) NOT NULL DEFAULT 0,
  paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, staff_id, month)
);

-- ============================================
-- 2. RLS политики для зарплат
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
-- 3. Триггер для обновления updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_salary_records_updated_at ON salary_records;
CREATE TRIGGER update_salary_records_updated_at BEFORE UPDATE ON salary_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. Real-time публикация для salary_records
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

-- ============================================
-- 5. Добавление колонок дат мероприятия в estimates
-- ============================================
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS event_start_date DATE;

ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS event_end_date DATE;

-- ============================================
-- 6. Миграция существующих данных: копируем event_date в новые колонки
-- ============================================
UPDATE estimates 
SET event_start_date = event_date,
    event_end_date = event_date
WHERE event_start_date IS NULL;

-- ============================================
-- 7. Индексы для быстрого поиска по датам
-- ============================================
CREATE INDEX IF NOT EXISTS idx_estimates_event_start_date ON estimates(event_start_date);
CREATE INDEX IF NOT EXISTS idx_estimates_event_end_date ON estimates(event_end_date);

-- ============================================
-- 8. Добавление оклада в таблицу staff
-- ============================================
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS base_salary DECIMAL(12, 2);

-- ============================================
-- 9. Добавление car_info в staff (если отсутствует)
-- ============================================
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS car_info TEXT;

-- ============================================
-- 10. Добавление company_id в staff (если отсутствует)
-- ============================================
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- ============================================
-- 11. Добавление статуса сметы (если отсутствует)
-- ============================================
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' 
CHECK (status IN ('draft', 'pending', 'approved', 'completed', 'cancelled'));

-- ============================================
-- 12. Добавление цвета события (если отсутствует)
-- ============================================
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'blue';

-- ============================================
-- 13. Добавление порядка категорий (если отсутствует)
-- ============================================
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS category_order TEXT[] DEFAULT '{}'::TEXT[];

-- ============================================
-- 14. Добавление полей редактирования (если отсутствуют)
-- ============================================
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS is_editing BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS editing_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS editing_since TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS editing_session_id TEXT;

-- ============================================
-- 15. Проверка результата
-- ============================================
SELECT 'salary_records columns' as check_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'salary_records' 
ORDER BY ordinal_position;

SELECT 'estimates date columns' as check_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'estimates' AND column_name IN ('event_date', 'event_start_date', 'event_end_date')
ORDER BY ordinal_position;

SELECT 'staff salary column' as check_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'staff' AND column_name = 'base_salary';
