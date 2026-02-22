-- SQL для системы кастомных разрешений пользователей
-- Админ может назначать роли и индивидуально настраивать доступ к вкладкам

-- Таблица для хранения кастомных разрешений пользователей
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tab_id TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tab_id)
);

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);

-- RLS для user_permissions
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "Admins can manage all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;

-- Только админы могут управлять разрешениями
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

-- Пользователи могут видеть только свои разрешения
CREATE POLICY "Users can view own permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Функция для получения эффективных разрешений пользователя
CREATE OR REPLACE FUNCTION get_user_effective_permissions(p_user_id UUID)
RETURNS TABLE (
  tab_id TEXT,
  allowed BOOLEAN,
  source TEXT -- 'role' или 'custom'
) AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Получаем роль пользователя
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
  
  -- Возвращаем все вкладки с их статусом доступа
  RETURN QUERY
  WITH all_tabs AS (
    SELECT unnest(ARRAY[
      'equipment', 'estimates', 'templates', 'calendar', 
      'checklists', 'staff', 'goals', 'analytics', 
      'customers', 'settings', 'admin'
    ]) AS tab
  ),
  role_permissions AS (
    SELECT 
      t.tab,
      CASE v_role
        WHEN 'admin' THEN true
        WHEN 'manager' THEN t.tab = ANY(ARRAY[
          'equipment', 'estimates', 'templates', 'calendar', 
          'checklists', 'goals', 'analytics', 'customers'
        ])
        WHEN 'warehouse' THEN t.tab = ANY(ARRAY[
          'equipment', 'checklists', 'calendar'
        ])
        WHEN 'accountant' THEN t.tab = ANY(ARRAY[
          'estimates', 'analytics', 'customers', 'calendar'
        ])
        ELSE false
      END AS allowed
    FROM all_tabs t
  )
  SELECT 
    COALESCE(up.tab_id, rp.tab) AS tab_id,
    COALESCE(up.allowed, rp.allowed) AS allowed,
    CASE WHEN up.tab_id IS NOT NULL THEN 'custom' ELSE 'role' END AS source
  FROM role_permissions rp
  LEFT JOIN user_permissions up ON up.user_id = p_user_id AND up.tab_id = rp.tab
  UNION
  SELECT 
    up.tab_id,
    up.allowed,
    'custom' AS source
  FROM user_permissions up
  WHERE up.user_id = p_user_id 
    AND up.tab_id NOT IN (SELECT tab FROM all_tabs);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для проверки доступа
CREATE OR REPLACE FUNCTION has_tab_access(p_user_id UUID, p_tab_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_allowed BOOLEAN;
  v_role TEXT;
BEGIN
  -- Проверяем кастомное разрешение
  SELECT allowed INTO v_allowed 
  FROM user_permissions 
  WHERE user_id = p_user_id AND tab_id = p_tab_id;
  
  -- Если есть кастомное разрешение - используем его
  IF v_allowed IS NOT NULL THEN
    RETURN v_allowed;
  END IF;
  
  -- Иначе используем ролевую модель
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
  
  RETURN CASE v_role
    WHEN 'admin' THEN true
    WHEN 'manager' THEN p_tab_id = ANY(ARRAY[
      'equipment', 'estimates', 'templates', 'calendar', 
      'checklists', 'goals', 'analytics', 'customers'
    ])
    WHEN 'warehouse' THEN p_tab_id = ANY(ARRAY[
      'equipment', 'checklists', 'calendar'
    ])
    WHEN 'accountant' THEN p_tab_id = ANY(ARRAY[
      'estimates', 'analytics', 'customers', 'calendar'
    ])
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON user_permissions;
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Комментарии
COMMENT ON TABLE user_permissions IS 'Индивидуальные разрешения пользователей на доступ к вкладкам';
COMMENT ON FUNCTION get_user_effective_permissions IS 'Получить эффективные разрешения пользователя (роль + кастомные)';
COMMENT ON FUNCTION has_tab_access IS 'Проверить доступ пользователя к конкретной вкладке';
