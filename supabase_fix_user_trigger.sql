-- Исправление триггера для новых пользователей
-- Только создаёт профиль, без записей в user_permissions (права теперь по роли)

-- 1. Удаляем старые триггеры и функции
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS create_default_user_permissions();

-- 2. Создаём новую функцию (только создание профиля)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'manager'  -- роль по умолчанию
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Создаём триггер
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Обновляем существующие профили без email
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id 
AND (p.email IS NULL OR p.email = '');

-- 5. Комментарий
COMMENT ON FUNCTION handle_new_user() IS 'Создаёт профиль при регистрации нового пользователя';
