-- ============================================
-- Перенос категорий из компании Андрей в общую компанию
-- ============================================

-- Компания-источник: Андрей (8ed7be07-4954-4d11-a829-0becf3d2a8ba)
-- Компания-получатель: Общая (08f8164e-d861-467a-be88-6108ea3650fd)

-- Обновляем категории из компании Андрей в общую компанию
UPDATE categories 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id = '8ed7be07-4954-4d11-a829-0becf3d2a8ba'::UUID;

-- Также обновляем категории без company_id (если есть)
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
ORDER BY comp.name, c.name;
