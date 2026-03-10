-- Диагностика и исправление миграции данных

-- 1. Проверяем сколько записей без company_id в каждой таблице
SELECT 
  'equipment' as table_name, 
  COUNT(*) as total,
  COUNT(company_id) as with_company,
  COUNT(*) - COUNT(company_id) as without_company
FROM equipment
UNION ALL
SELECT 
  'estimates' as table_name, 
  COUNT(*) as total,
  COUNT(company_id) as with_company,
  COUNT(*) - COUNT(company_id) as without_company
FROM estimates
UNION ALL
SELECT 
  'cable_categories' as table_name, 
  COUNT(*) as total,
  COUNT(company_id) as with_company,
  COUNT(*) - COUNT(company_id) as without_company
FROM cable_categories
UNION ALL
SELECT 
  'cable_inventory' as table_name, 
  COUNT(*) as total,
  COUNT(company_id) as with_company,
  COUNT(*) - COUNT(company_id) as without_company
FROM cable_inventory
UNION ALL
SELECT 
  'cable_movements' as table_name, 
  COUNT(*) as total,
  COUNT(company_id) as with_company,
  COUNT(*) - COUNT(company_id) as without_company
FROM cable_movements;

-- 2. Проверяем какие user_id есть в equipment но не создали компаний
SELECT DISTINCT e.user_id, e.company_id
FROM equipment e
LEFT JOIN companies c ON c.id = e.company_id
WHERE e.user_id IS NOT NULL
LIMIT 10;

-- 3. Исправляем orphaned записи для equipment
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
  
  -- Обновляем equipment без company_id
  UPDATE equipment 
  SET company_id = default_company_id 
  WHERE company_id IS NULL;
  
  -- Обновляем estimates без company_id
  UPDATE estimates 
  SET company_id = default_company_id 
  WHERE company_id IS NULL;
  
  -- Обновляем cable_categories без company_id
  UPDATE cable_categories 
  SET company_id = default_company_id 
  WHERE company_id IS NULL;
  
  -- Обновляем cable_inventory без company_id
  UPDATE cable_inventory 
  SET company_id = default_company_id 
  WHERE company_id IS NULL;
  
  -- Обновляем cable_movements без company_id
  UPDATE cable_movements 
  SET company_id = default_company_id 
  WHERE company_id IS NULL;
  
END $$;

-- 4. Проверяем результат
SELECT 
  'equipment' as table_name, 
  COUNT(*) as total,
  COUNT(company_id) as with_company
FROM equipment
UNION ALL
SELECT 
  'estimates' as table_name, 
  COUNT(*) as total,
  COUNT(company_id) as with_company
FROM estimates
UNION ALL
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
