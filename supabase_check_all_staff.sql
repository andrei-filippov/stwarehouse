-- ============================================
-- Все сотрудники и их company_id
-- ============================================

SELECT 
    id,
    full_name,
    email,
    company_id,
    is_active
FROM staff
ORDER BY full_name;
