-- Добавление поля type в таблицу companies
-- Тип компании: 'company' (ООО), 'ip' (ИП), 'individual' (физ. лицо)

-- 1. Добавляем колонку type
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'company';

-- 2. Создаем ограничение CHECK для валидации значений
DO $$
BEGIN
  -- Удаляем существующее ограничение если есть
  ALTER TABLE companies 
  DROP CONSTRAINT IF EXISTS companies_type_check;
  
  -- Добавляем новое ограничение
  ALTER TABLE companies 
  ADD CONSTRAINT companies_type_check 
  CHECK (type IN ('company', 'ip', 'individual'));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add constraint: %', SQLERRM;
END $$;

-- 3. Обновляем существующие записи: пытаемся определить тип по названию
-- Если в названии есть "ИП" или "индивидуальный предприниматель" -> тип 'ip'
UPDATE companies 
SET type = 'ip' 
WHERE type = 'company' 
  AND (
    name ~* '^ИП\s' 
    OR name ~* 'индивидуальный\s+предприниматель'
  );

-- 4. Комментарий к колонке
COMMENT ON COLUMN companies.type IS 'Тип компании: company (ООО), ip (ИП), individual (физ. лицо)';

-- 5. Проверяем результат
SELECT 
  type, 
  COUNT(*) as count 
FROM companies 
GROUP BY type;
