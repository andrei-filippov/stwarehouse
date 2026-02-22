-- Очистка старых триггеров и функций
-- Выполните этот файл перед созданием новой системы разрешений

-- 1. Удаляем старый триггер на auth.users если есть
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;

-- 2. Удаляем старые функции
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS create_default_user_permissions();

-- 3. Проверяем остались ли ещё триггеры на auth.users
SELECT tgname AS trigger_name, 
       tgrelid::regclass AS table_name,
       proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'auth.users'::regclass
AND NOT tgisinternal;

-- Если что-то осталось - удалите вручную или сообщите
