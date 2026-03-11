-- ============================================
-- Проверка категорий и оборудования
-- ============================================

-- 1. Показать все существующие категории в таблице categories
SELECT 'Категории в таблице categories:' as info;
SELECT 
    id,
    name,
    company_id,
    created_at
FROM categories
ORDER BY name;

-- 2. Показать все уникальные категории из оборудования
SELECT 'Уникальные категории из оборудования:' as info;
SELECT DISTINCT 
    category as name,
    COUNT(*) as equipment_count
FROM equipment
WHERE category IS NOT NULL AND category != ''
GROUP BY category
ORDER BY category;

-- 3. Показать категории из оборудования, которых нет в таблице categories
SELECT 'Категории без записи в таблице categories:' as info;
SELECT DISTINCT 
    e.category as name
FROM equipment e
LEFT JOIN categories c ON e.category = c.name
WHERE e.category IS NOT NULL 
  AND e.category != ''
  AND c.id IS NULL
ORDER BY e.category;

-- 4. Показать компании
SELECT 'Существующие компании:' as info;
SELECT 
    id,
    name,
    slug,
    created_at
FROM companies
ORDER BY created_at;
