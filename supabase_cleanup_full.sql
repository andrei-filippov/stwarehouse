-- Полная очистка старой системы разрешений
-- Выполните весь блок целиком

-- 1. Удаляем триггеры на auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;

-- 2. Удаляем триггеры на profiles (если есть)
DROP TRIGGER IF EXISTS auto_create_permissions ON profiles;

-- 3. Удаляем функции с CASCADE (удаляет все зависимости)
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS create_default_user_permissions() CASCADE;

-- 4. Проверяем что всё удалено
SELECT 'Cleanup completed' as status;
