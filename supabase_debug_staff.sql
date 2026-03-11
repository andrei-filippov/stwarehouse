-- ============================================
-- Проверка сотрудников и компаний
-- ============================================

-- 1. Все сотрудники
SELECT id, full_name, email, company_id, is_active 
FROM staff 
ORDER BY full_name;

-- 2. Все компании
SELECT id, name, slug FROM companies;

-- 3. Сотрудники без company_id
SELECT id, full_name, email FROM staff WHERE company_id IS NULL;

-- 4. Привязать сотрудников без company_id к общей компании
UPDATE staff 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IS NULL;

-- 5. Проверить результат
SELECT id, full_name, company_id FROM staff ORDER BY full_name;
