-- ============================================
-- Привязка ВСЕХ существующих категорий к компании
-- ============================================

-- Обновляем все категории без company_id
UPDATE categories 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IS NULL;

-- Проверяем результат
SELECT 
    c.id,
    c.name,
    c.company_id,
    comp.name as company_name
FROM categories c
LEFT JOIN companies comp ON c.company_id = comp.id
ORDER BY c.name;
