-- Полное пересоздание таблицы разрешений
-- Выполните весь этот блок целиком

-- 1. Удаляем старые объекты (игнорируем ошибки если их нет)
DROP POLICY IF EXISTS "Admins can manage all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON user_permissions;
DROP FUNCTION IF EXISTS get_user_effective_permissions(UUID);
DROP FUNCTION IF EXISTS has_tab_access(UUID, TEXT);
DROP TABLE IF EXISTS user_permissions;

-- 2. Создаём таблицу заново
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tab_id TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tab_id)
);

-- 3. Индекс
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);

-- 4. Включаем RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- 5. Политики
CREATE POLICY "Admins can manage all permissions"
  ON user_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can view own permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. Функция для получения эффективных разрешений
CREATE OR REPLACE FUNCTION get_user_effective_permissions(p_user_id UUID)
RETURNS TABLE (
  tab_id TEXT,
  allowed BOOLEAN,
  source TEXT
) AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = p_user_id;
  
  RETURN QUERY
  WITH tabs AS (
    SELECT unnest(ARRAY[
      'equipment', 'estimates', 'templates', 'calendar', 
      'checklists', 'staff', 'goals', 'analytics', 
      'customers', 'settings', 'admin'
    ]) AS t
  )
  SELECT 
    tabs.t AS tab_id,
    COALESCE(up.allowed, 
      CASE user_role
        WHEN 'admin' THEN true
        WHEN 'manager' THEN tabs.t = ANY(ARRAY['equipment', 'estimates', 'templates', 'calendar', 'checklists', 'goals', 'analytics', 'customers'])
        WHEN 'warehouse' THEN tabs.t = ANY(ARRAY['equipment', 'checklists', 'calendar'])
        WHEN 'accountant' THEN tabs.t = ANY(ARRAY['estimates', 'analytics', 'customers', 'calendar'])
        ELSE false
      END
    ) AS allowed,
    CASE WHEN up.id IS NOT NULL THEN 'custom' ELSE 'role' END AS source
  FROM tabs
  LEFT JOIN user_permissions up ON up.user_id = p_user_id AND up.tab_id = tabs.t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Функция для проверки доступа
CREATE OR REPLACE FUNCTION has_tab_access(p_user_id UUID, p_tab_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  custom_allowed BOOLEAN;
  user_role TEXT;
BEGIN
  SELECT allowed INTO custom_allowed 
  FROM user_permissions 
  WHERE user_id = p_user_id AND tab_id = p_tab_id;
  
  IF custom_allowed IS NOT NULL THEN
    RETURN custom_allowed;
  END IF;
  
  SELECT role INTO user_role FROM profiles WHERE id = p_user_id;
  
  RETURN CASE user_role
    WHEN 'admin' THEN true
    WHEN 'manager' THEN p_tab_id = ANY(ARRAY['equipment', 'estimates', 'templates', 'calendar', 'checklists', 'goals', 'analytics', 'customers'])
    WHEN 'warehouse' THEN p_tab_id = ANY(ARRAY['equipment', 'checklists', 'calendar'])
    WHEN 'accountant' THEN p_tab_id = ANY(ARRAY['estimates', 'analytics', 'customers', 'calendar'])
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Триггер для updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
