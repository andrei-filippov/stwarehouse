-- Диагностика проблемы

-- 1. Проверяем существование таблиц
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('companies', 'company_members')
ORDER BY table_name;

-- 2. Проверяем структуру companies
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY ordinal_position;

-- 3. Проверяем структуру company_members
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'company_members'
ORDER BY ordinal_position;

-- 4. Проверяем RLS статус
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('companies', 'company_members');

-- 5. Проверяем политики
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('companies', 'company_members')
ORDER BY tablename, policyname;

-- 6. Тестовый запрос (как делает фронтенд)
-- Этот запрос должен работать без ошибок
SELECT 
  cm.*,
  c.* as company,
  u.id as user_id, u.email as user_email
FROM company_members cm
LEFT JOIN companies c ON c.id = cm.company_id
LEFT JOIN auth.users u ON u.id = cm.user_id
WHERE cm.user_id = auth.uid()
AND cm.status = 'active'
LIMIT 1;
