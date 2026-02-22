-- ПОЛНАЯ НАСТРОЙКА: Удаление старого + создание нового
-- Выполните весь этот файл целиком в Supabase SQL Editor

-- ============================================
-- ЧАСТЬ 1: УДАЛЕНИЕ СТАРЫХ ОБЪЕКТОВ
-- ============================================

-- Удаляем триггеры
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP TRIGGER IF EXISTS auto_create_permissions ON profiles;
DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON user_permissions;

-- Удаляем функции с CASCADE
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS create_default_user_permissions() CASCADE;
DROP FUNCTION IF EXISTS get_user_effective_permissions(UUID) CASCADE;
DROP FUNCTION IF EXISTS has_tab_access(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Удаляем политики
DROP POLICY IF EXISTS "Admins can manage all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;

-- Удаляем таблицу разрешений
DROP TABLE IF EXISTS user_permissions;

-- ============================================
-- ЧАСТЬ 2: ДОБАВЛЕНИЕ EMAIL В PROFILES
-- ============================================

-- Добавляем колонку email если нет
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Заполняем email для существующих пользователей
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- ============================================
-- ЧАСТЬ 3: СОЗДАНИЕ ТАБЛИЦЫ РАЗРЕШЕНИЙ
-- ============================================

CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tab_id TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tab_id)
);

CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ЧАСТЬ 4: ПОЛИТИКИ RLS
-- ============================================

CREATE POLICY "Admins can manage all permissions"
  ON user_permissions FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view own permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- ЧАСТЬ 5: ФУНКЦИИ
-- ============================================

-- Функция для получения эффективных разрешений
CREATE OR REPLACE FUNCTION get_user_effective_permissions(p_user_id UUID)
RETURNS TABLE (tab_id TEXT, allowed BOOLEAN, source TEXT) AS $$
DECLARE user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = p_user_id;
  RETURN QUERY
  WITH tabs AS (
    SELECT unnest(ARRAY['equipment', 'estimates', 'templates', 'calendar', 
      'checklists', 'staff', 'goals', 'analytics', 'customers', 'settings', 'admin']) AS t
  )
  SELECT tabs.t, COALESCE(up.allowed, CASE user_role
      WHEN 'admin' THEN true
      WHEN 'manager' THEN tabs.t = ANY(ARRAY['equipment', 'estimates', 'templates', 
        'calendar', 'checklists', 'goals', 'analytics', 'customers'])
      WHEN 'warehouse' THEN tabs.t = ANY(ARRAY['equipment', 'checklists', 'calendar'])
      WHEN 'accountant' THEN tabs.t = ANY(ARRAY['estimates', 'analytics', 'customers', 'calendar'])
      ELSE false
    END),
    CASE WHEN up.id IS NOT NULL THEN 'custom' ELSE 'role' END
  FROM tabs
  LEFT JOIN user_permissions up ON up.user_id = p_user_id AND up.tab_id = tabs.t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для проверки доступа
CREATE OR REPLACE FUNCTION has_tab_access(p_user_id UUID, p_tab_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE custom_allowed BOOLEAN; user_role TEXT;
BEGIN
  SELECT allowed INTO custom_allowed FROM user_permissions 
  WHERE user_id = p_user_id AND tab_id = p_tab_id;
  IF custom_allowed IS NOT NULL THEN RETURN custom_allowed; END IF;
  SELECT role INTO user_role FROM profiles WHERE id = p_user_id;
  RETURN CASE user_role
    WHEN 'admin' THEN true
    WHEN 'manager' THEN p_tab_id = ANY(ARRAY['equipment', 'estimates', 'templates', 
      'calendar', 'checklists', 'goals', 'analytics', 'customers'])
    WHEN 'warehouse' THEN p_tab_id = ANY(ARRAY['equipment', 'checklists', 'calendar'])
    WHEN 'accountant' THEN p_tab_id = ANY(ARRAY['estimates', 'analytics', 'customers', 'calendar'])
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column() 
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ЧАСТЬ 6: ТРИГГЕР ДЛЯ НОВЫХ ПОЛЬЗОВАТЕЛЕЙ
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'manager'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ЧАСТЬ 7: УСТАНОВКА АДМИНА (замените email)
-- ============================================

-- UPDATE profiles SET role = 'admin' WHERE email = 'ваш-email@example.com';

SELECT 'Setup completed successfully!' as status;
