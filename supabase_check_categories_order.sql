-- ============================================
-- Проверка категорий и их company_id
-- ============================================

SELECT 
    id,
    name,
    company_id
FROM categories
ORDER BY name;
