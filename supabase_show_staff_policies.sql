-- ============================================
-- Показать все RLS политики для staff
-- ============================================

SELECT 
    policyname,
    permissive,
    roles::text,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'staff';
