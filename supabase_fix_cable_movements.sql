-- Добавляем поле equipment_name и делаем length опциональным в cable_movements

-- 1. Добавляем поле equipment_name
ALTER TABLE cable_movements 
ADD COLUMN IF NOT EXISTS equipment_name TEXT;

-- 2. Делаем length опциональным (если есть данные, нужно установить значение по умолчанию)
ALTER TABLE cable_movements 
ALTER COLUMN length DROP NOT NULL;

-- 3. Проверяем результат
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'cable_movements' 
ORDER BY ordinal_position;
