-- Добавляем company_id в таблицы кабельного учёта

-- 1. Добавляем колонки
ALTER TABLE cable_categories ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE cable_inventory ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE cable_movements ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- 2. Создаём компанию по умолчанию для orphaned записей
DO $$
DECLARE
  default_company_id UUID;
BEGIN
  -- Находим или создаём компанию по умолчанию
  SELECT id INTO default_company_id FROM companies WHERE email = 'default@example.com' LIMIT 1;
  
  IF default_company_id IS NULL THEN
    INSERT INTO companies (name, email, plan, slug)
    VALUES ('Общая компания', 'default@example.com', 'free', 'default')
    RETURNING id INTO default_company_id;
  END IF;
  
  -- Обновляем cable_categories
  UPDATE cable_categories 
  SET company_id = default_company_id 
  WHERE company_id IS NULL;
  
  -- Обновляем cable_inventory через категории
  UPDATE cable_inventory ci
  SET company_id = cc.company_id
  FROM cable_categories cc
  WHERE ci.category_id = cc.id AND ci.company_id IS NULL;
  
  -- Обновляем cable_movements через категории
  UPDATE cable_movements cm
  SET company_id = cc.company_id
  FROM cable_categories cc
  WHERE cm.category_id = cc.id AND cm.company_id IS NULL;
  
END $$;

-- 3. Проверяем результат
SELECT 
  'cable_categories' as table_name, 
  COUNT(*) as total,
  COUNT(company_id) as with_company
FROM cable_categories
UNION ALL
SELECT 
  'cable_inventory' as table_name, 
  COUNT(*) as total,
  COUNT(company_id) as with_company
FROM cable_inventory
UNION ALL
SELECT 
  'cable_movements' as table_name, 
  COUNT(*) as total,
  COUNT(company_id) as with_company
FROM cable_movements;
