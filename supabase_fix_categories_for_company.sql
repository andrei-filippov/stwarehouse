-- ============================================
-- Привязка существующих категорий к компании
-- ============================================

-- Находим все уникальные категории из оборудования
-- и создаем их для указанной компании (если они еще не существуют)

-- Вариант 1: Привязать существующие категории БЕЗ company_id к первой найденной компании
WITH categories_to_fix AS (
  SELECT DISTINCT e.category as name
  FROM equipment e
  WHERE e.category IS NOT NULL 
    AND e.category != ''
),
company_to_assign AS (
  SELECT id as company_id 
  FROM companies 
  LIMIT 1
)
INSERT INTO categories (name, company_id)
SELECT 
  ctf.name,
  cta.company_id
FROM categories_to_fix ctf
CROSS JOIN company_to_assign cta
ON CONFLICT (name) DO UPDATE 
SET company_id = EXCLUDED.company_id
WHERE categories.company_id IS NULL;

-- Вариант 2: Если нужно привязать к конкретной компании по ID
-- Раскомментируйте и замените 'YOUR_COMPANY_ID' на реальный UUID
/*
WITH categories_to_fix AS (
  SELECT DISTINCT e.category as name
  FROM equipment e
  WHERE e.category IS NOT NULL 
    AND e.category != ''
)
INSERT INTO categories (name, company_id)
SELECT 
  ctf.name,
  'YOUR_COMPANY_ID'::UUID
FROM categories_to_fix ctf
ON CONFLICT (name) DO UPDATE 
SET company_id = EXCLUDED.company_id
WHERE categories.company_id IS NULL;
*/

-- Проверяем результат
SELECT 
    c.id,
    c.name,
    c.company_id,
    comp.name as company_name
FROM categories c
LEFT JOIN companies comp ON c.company_id = comp.id
ORDER BY c.name;
