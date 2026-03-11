-- ============================================
-- Проверка таблицы staff
-- ============================================

-- 1. Показать структуру таблицы staff
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'staff'
ORDER BY ordinal_position;

-- 2. Показать всех сотрудников с company_id
SELECT 
    id,
    full_name,
    company_id,
    is_active
FROM staff
ORDER BY full_name;

-- 3. Показать компании
SELECT 
    id,
    name,
    slug
FROM companies
ORDER BY name;

-- 4. Проверить есть ли сотрудники без company_id
SELECT 
    id,
    full_name,
    company_id
FROM staff
WHERE company_id IS NULL;
