-- ============================================
-- Проверка колонок таблицы staff
-- ============================================

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'staff'
ORDER BY ordinal_position;
