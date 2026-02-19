-- Проверка структуры таблицы estimate_items
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'estimate_items'
ORDER BY ordinal_position;

-- Если нужно, исправляем структуру
DO $$
BEGIN
  -- coefficient должен быть numeric/decimal
  IF EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimate_items' AND column_name = 'coefficient' AND data_type = 'integer') THEN
    ALTER TABLE estimate_items ALTER COLUMN coefficient TYPE NUMERIC(5,2);
  END IF;
  
  -- Добавляем coefficient если отсутствует
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimate_items' AND column_name = 'coefficient') THEN
    ALTER TABLE estimate_items ADD COLUMN coefficient NUMERIC(5,2) DEFAULT 1;
  END IF;
  
  -- Добавляем unit если отсутствует
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'estimate_items' AND column_name = 'unit') THEN
    ALTER TABLE estimate_items ADD COLUMN unit TEXT DEFAULT 'шт';
  END IF;
END $$;
