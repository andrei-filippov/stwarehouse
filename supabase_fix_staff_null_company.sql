-- ============================================
-- Привязка сотрудников без company_id к компании
-- ============================================

-- Привязываем сотрудников без company_id к общей компании
UPDATE staff 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IS NULL;

-- Проверяем результат
SELECT 
    id,
    full_name,
    company_id,
    is_active
FROM staff
ORDER BY full_name;
