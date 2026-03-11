-- ============================================
-- Привязка сотрудников к компании
-- ============================================

-- Показать сотрудников без company_id
SELECT id, full_name, company_id 
FROM staff 
WHERE company_id IS NULL;

-- Показать компании
SELECT id, name FROM companies;

-- Если нужно привязать ВСЕХ сотрудников без company_id к конкретной компании,
-- раскомментируйте и выполните (замените YOUR_COMPANY_ID на реальный UUID):

-- UPDATE staff 
-- SET company_id = 'YOUR_COMPANY_ID'::UUID
-- WHERE company_id IS NULL;
