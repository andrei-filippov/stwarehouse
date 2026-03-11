-- ============================================
-- Проверка RLS политик для staff
-- ============================================

-- 1. Показать RLS политики для staff
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'staff';

-- 2. Проверить включен ли RLS
SELECT 
    relname,
    relrowsecurity,
    relforcerowsecurity
FROM pg_class
WHERE relname = 'staff';
