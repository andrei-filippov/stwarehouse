-- ============================================
-- Проверка членов компании
-- ============================================

-- 1. Все члены компаний
SELECT 
    cm.id,
    cm.user_id,
    cm.company_id,
    c.name as company_name,
    cm.role,
    cm.status
FROM company_members cm
JOIN companies c ON cm.company_id = c.id;

-- 2. Проверить есть ли пользователь в общей компании
-- (замените USER_ID на реальный UUID пользователя)
-- SELECT * FROM company_members 
-- WHERE company_id = '08f8164e-d861-467a-be88-6108ea3650fd'
-- AND user_id = 'USER_ID';
