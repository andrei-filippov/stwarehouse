-- Таблица для индивидуальных прав пользователей
-- Позволяет админу назначать конкретные вкладки каждому пользователю

CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allowed_tabs TEXT[] NOT NULL DEFAULT '{}',
  can_edit BOOLEAN NOT NULL DEFAULT true,
  can_delete BOOLEAN NOT NULL DEFAULT true,
  can_export BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS для user_permissions
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Админ видит все права
CREATE POLICY "Admin can view all permissions" ON user_permissions 
  FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Пользователь видит свои права
CREATE POLICY "Users can view own permissions" ON user_permissions 
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

-- Только админ может менять права
CREATE POLICY "Admin can insert permissions" ON user_permissions 
  FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admin can update permissions" ON user_permissions 
  FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admin can delete permissions" ON user_permissions 
  FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Триггер для updated_at
DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON user_permissions;
CREATE TRIGGER update_user_permissions_updated_at 
  BEFORE UPDATE ON user_permissions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Функция для автоматического создания прав при регистрации
CREATE OR REPLACE FUNCTION create_default_user_permissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Создаём права по умолчанию на основе роли
  INSERT INTO user_permissions (user_id, allowed_tabs, can_edit, can_delete, can_export)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.role = 'admin' THEN ARRAY['equipment', 'estimates', 'templates', 'calendar', 'checklists', 'staff', 'goals', 'analytics', 'customers', 'settings', 'admin']
      WHEN NEW.role = 'manager' THEN ARRAY['equipment', 'estimates', 'templates', 'calendar', 'checklists', 'goals', 'analytics', 'customers']
      WHEN NEW.role = 'warehouse' THEN ARRAY['equipment', 'checklists', 'calendar']
      WHEN NEW.role = 'accountant' THEN ARRAY['estimates', 'analytics', 'customers', 'calendar']
      ELSE ARRAY['equipment', 'calendar']
    END,
    NEW.role IN ('admin', 'manager', 'warehouse'),
    NEW.role IN ('admin', 'manager'),
    NEW.role IN ('admin', 'manager', 'accountant')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    allowed_tabs = EXCLUDED.allowed_tabs,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_export = EXCLUDED.can_export,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автосоздания прав при создании профиля
DROP TRIGGER IF EXISTS auto_create_permissions ON profiles;
CREATE TRIGGER auto_create_permissions
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_user_permissions();

-- Создаём права для существующих пользователей
INSERT INTO user_permissions (user_id, allowed_tabs, can_edit, can_delete, can_export)
SELECT 
  p.id,
  CASE 
    WHEN p.role = 'admin' THEN ARRAY['equipment', 'estimates', 'templates', 'calendar', 'checklists', 'staff', 'goals', 'analytics', 'customers', 'settings', 'admin']
    WHEN p.role = 'manager' THEN ARRAY['equipment', 'estimates', 'templates', 'calendar', 'checklists', 'goals', 'analytics', 'customers']
    WHEN p.role = 'warehouse' THEN ARRAY['equipment', 'checklists', 'calendar']
    WHEN p.role = 'accountant' THEN ARRAY['estimates', 'analytics', 'customers', 'calendar']
    ELSE ARRAY['equipment', 'calendar']
  END,
  p.role IN ('admin', 'manager', 'warehouse'),
  p.role IN ('admin', 'manager'),
  p.role IN ('admin', 'manager', 'accountant')
FROM profiles p
LEFT JOIN user_permissions up ON p.id = up.user_id
WHERE up.id IS NULL
ON CONFLICT (user_id) DO NOTHING;
