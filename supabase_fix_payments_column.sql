-- ============================================
-- Фикс: добавление колонки payments в salary_records
-- и сброс кэша схемы PostgREST
-- ============================================

-- 1. Добавляем колонку payments (если ещё не добавлена)
ALTER TABLE salary_records 
ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '[]'::jsonb;

-- 2. Проверяем, что колонка создана
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'salary_records' AND column_name = 'payments'
  ) THEN
    RAISE EXCEPTION 'Колонка payments не создана!';
  END IF;
END $$;

-- 3. Сбрасываем кэш схемы PostgREST (необходимо для применения изменений)
-- Способ 1: через NOTIFY (если доступно)
NOTIFY pgrst, 'reload schema';

-- Способ 2: пересоздание представления (альтернативный метод)
-- Это принудительно обновляет метаданные схемы
ANALYZE salary_records;

-- 4. Проверяем структуру таблицы
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'salary_records' 
ORDER BY ordinal_position;

-- 5. Тестовый запрос для проверки
SELECT id, staff_id, month, payments, total_calculated, paid
FROM salary_records
LIMIT 1;
