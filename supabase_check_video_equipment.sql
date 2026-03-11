-- ============================================
-- Проверка оборудования в категории "Видео оборудование"
-- ============================================

-- 1. Все категории
SELECT id, name, company_id FROM categories WHERE name = 'Видео оборудование';

-- 2. Оборудование в категории "Видео оборудование"
SELECT id, name, category, company_id 
FROM equipment 
WHERE category = 'Видео оборудование';

-- 3. Все категории с количеством оборудования
SELECT 
    c.name,
    COUNT(e.id) as equipment_count
FROM categories c
LEFT JOIN equipment e ON c.name = e.category AND e.company_id = c.company_id
WHERE c.company_id = '08f8164e-d861-467a-be88-6108ea3650fd'
GROUP BY c.name
ORDER BY equipment_count DESC;
