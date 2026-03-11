-- ============================================
-- Проверка сотрудника по email 219964@mail.ru
-- ============================================

-- Найти сотрудника по email
SELECT 
    id,
    full_name,
    email,
    company_id,
    is_active
FROM staff
WHERE email = '219964@mail.ru';

-- Показать все компании
SELECT id, name FROM companies;
