-- Добавляем колонку email в profiles (если ещё нет)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Создаём индекс для email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Функция для синхронизации email из auth.users
CREATE OR REPLACE FUNCTION sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles 
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер на обновление email в auth.users
DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
CREATE TRIGGER on_auth_user_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_email();

-- Заполняем email для существующих пользователей
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- Разрешаем чтение email (только для админов)
-- Это нужно добавить в существующую политику или создать новую

COMMENT ON COLUMN profiles.email IS 'Синхронизируется с auth.users.email';
