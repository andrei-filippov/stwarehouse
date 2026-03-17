-- ============================================
-- Таблица кастомных разрешений пользователей
-- ============================================

-- Таблица разрешений (переопределение ролевых)
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tab_id TEXT NOT NULL, -- 'dashboard', 'equipment', 'estimates', 'templates', 'calendar', 'checklists', 'staff', 'goals', 'cables', 'finance', 'customers', 'contracts', 'settings', 'admin'
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Один пользователь - одно разрешение на вкладку
  UNIQUE(user_id, tab_id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_tab_id ON user_permissions(tab_id);

-- Политики безопасности (RLS)
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Пользователи могут видеть только свои разрешения
DROP POLICY IF EXISTS "Пользователи видят свои разрешения" ON user_permissions;
CREATE POLICY "Пользователи видят свои разрешения"
  ON user_permissions
  FOR SELECT
  USING (user_id = auth.uid());

-- Админы и владельцы могут видеть все разрешения
DROP POLICY IF EXISTS "Админы видят все разрешения" ON user_permissions;
CREATE POLICY "Админы видят все разрешения"
  ON user_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      JOIN companies c ON cm.company_id = c.id
      WHERE cm.user_id = auth.uid()
      AND (cm.role = 'owner' OR cm.role = 'admin')
    )
  );

-- Админы и владельцы могут управлять разрешениями
DROP POLICY IF EXISTS "Админы управляют разрешениями" ON user_permissions;
CREATE POLICY "Админы управляют разрешениями"
  ON user_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      JOIN companies c ON cm.company_id = c.id
      WHERE cm.user_id = auth.uid()
      AND (cm.role = 'owner' OR cm.role = 'admin')
    )
  );

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_user_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON user_permissions;
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_permissions_updated_at();

-- ============================================
-- Функция для установки разрешения (RPC)
-- ============================================
CREATE OR REPLACE FUNCTION set_user_permission(
  p_user_id UUID,
  p_tab_id TEXT,
  p_allowed BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_is_admin BOOLEAN;
  v_result JSONB;
BEGIN
  v_admin_id := auth.uid();
  
  -- Проверяем что текущий пользователь - админ или владелец
  SELECT EXISTS (
    SELECT 1 FROM company_members cm
    JOIN companies c ON cm.company_id = c.id
    WHERE cm.user_id = v_admin_id
    AND (cm.role = 'owner' OR cm.role = 'admin')
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'Только админ или владелец может управлять разрешениями');
  END IF;
  
  -- Проверяем что целевой пользователь в той же компании
  IF NOT EXISTS (
    SELECT 1 FROM company_members cm1
    JOIN company_members cm2 ON cm1.company_id = cm2.company_id
    WHERE cm1.user_id = v_admin_id
    AND cm2.user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'Пользователь не найден в вашей компании');
  END IF;
  
  -- Вставляем или обновляем разрешение
  INSERT INTO user_permissions (user_id, tab_id, allowed)
  VALUES (p_user_id, p_tab_id, p_allowed)
  ON CONFLICT (user_id, tab_id)
  DO UPDATE SET allowed = p_allowed, updated_at = NOW();
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- Функция для удаления разрешения (RPC)
-- ============================================
CREATE OR REPLACE FUNCTION remove_user_permission(
  p_user_id UUID,
  p_tab_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  v_admin_id := auth.uid();
  
  -- Проверяем что текущий пользователь - админ или владелец
  SELECT EXISTS (
    SELECT 1 FROM company_members cm
    JOIN companies c ON cm.company_id = c.id
    WHERE cm.user_id = v_admin_id
    AND (cm.role = 'owner' OR cm.role = 'admin')
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'Только админ или владелец может управлять разрешениями');
  END IF;
  
  -- Удаляем кастомное разрешение
  DELETE FROM user_permissions
  WHERE user_id = p_user_id AND tab_id = p_tab_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- Функция для получения эффективных разрешений
-- ============================================
CREATE OR REPLACE FUNCTION get_user_effective_permissions(p_user_id UUID)
RETURNS TABLE (
  tab_id TEXT,
  allowed BOOLEAN,
  source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_tab_ids TEXT[] := ARRAY['dashboard', 'equipment', 'estimates', 'templates', 'calendar', 'checklists', 'staff', 'goals', 'cables', 'finance', 'customers', 'contracts', 'settings', 'admin'];
  v_tab_id TEXT;
  v_custom_allowed BOOLEAN;
  v_role_allowed BOOLEAN;
BEGIN
  -- Получаем роль пользователя из company_members
  SELECT cm.role INTO v_user_role
  FROM company_members cm
  WHERE cm.user_id = p_user_id
  LIMIT 1;
  
  -- Если роль не найдена, используем 'viewer' как дефолт
  IF v_user_role IS NULL THEN
    v_user_role := 'viewer';
  END IF;
  
  -- Для каждой вкладки определяем эффективное разрешение
  FOREACH v_tab_id IN ARRAY v_tab_ids
  LOOP
    -- Проверяем кастомное разрешение
    SELECT up.allowed INTO v_custom_allowed
    FROM user_permissions up
    WHERE up.user_id = p_user_id AND up.tab_id = v_tab_id;
    
    -- Если есть кастомное разрешение - используем его
    IF v_custom_allowed IS NOT NULL THEN
      RETURN QUERY SELECT v_tab_id, v_custom_allowed, 'custom'::TEXT;
    ELSE
      -- Иначе используем ролевое
      v_role_allowed := CASE
        WHEN v_user_role = 'owner' OR v_user_role = 'admin' THEN true
        WHEN v_user_role = 'manager' AND v_tab_id IN ('dashboard', 'equipment', 'estimates', 'templates', 'calendar', 'checklists', 'goals', 'cables', 'finance', 'customers') THEN true
        WHEN v_user_role = 'warehouse' AND v_tab_id IN ('dashboard', 'equipment', 'checklists', 'calendar', 'cables') THEN true
        WHEN v_user_role = 'accountant' AND v_tab_id IN ('dashboard', 'estimates', 'finance', 'customers', 'calendar') THEN true
        WHEN v_user_role = 'viewer' THEN false
        ELSE false
      END;
      
      RETURN QUERY SELECT v_tab_id, v_role_allowed, 'role'::TEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- ============================================
-- Функция проверки доступа к вкладке
-- ============================================
CREATE OR REPLACE FUNCTION has_tab_access(
  p_user_id UUID,
  p_tab_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_custom_allowed BOOLEAN;
  v_user_role TEXT;
BEGIN
  -- Проверяем кастомное разрешение
  SELECT up.allowed INTO v_custom_allowed
  FROM user_permissions up
  WHERE up.user_id = p_user_id AND up.tab_id = p_tab_id;
  
  -- Если есть кастомное разрешение - используем его
  IF v_custom_allowed IS NOT NULL THEN
    RETURN v_custom_allowed;
  END IF;
  
  -- Иначе проверяем ролевое
  SELECT cm.role INTO v_user_role
  FROM company_members cm
  WHERE cm.user_id = p_user_id
  LIMIT 1;
  
  RETURN CASE
    WHEN v_user_role IN ('owner', 'admin') THEN true
    WHEN v_user_role = 'manager' AND p_tab_id IN ('dashboard', 'equipment', 'estimates', 'templates', 'calendar', 'checklists', 'goals', 'cables', 'finance', 'customers') THEN true
    WHEN v_user_role = 'warehouse' AND p_tab_id IN ('dashboard', 'equipment', 'checklists', 'calendar', 'cables') THEN true
    WHEN v_user_role = 'accountant' AND p_tab_id IN ('dashboard', 'estimates', 'finance', 'customers', 'calendar') THEN true
    ELSE false
  END;
END;
$$;

-- ============================================
-- Комментарии
-- ============================================
COMMENT ON TABLE user_permissions IS 'Кастомные разрешения пользователей (переопределение ролевых)';
COMMENT ON COLUMN user_permissions.tab_id IS 'ID вкладки: dashboard, equipment, estimates, templates, calendar, checklists, staff, goals, cables, finance, customers, contracts, settings, admin';
