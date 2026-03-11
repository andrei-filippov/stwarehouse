-- ============================================
-- Исправление audit_logs - разрешаем null для user_id
-- ============================================

-- 1. Изменяем колонку user_id чтобы разрешить null
ALTER TABLE audit_logs 
ALTER COLUMN user_id DROP NOT NULL;

-- 2. Обновляем функцию create_audit_log чтобы обрабатывать null user_id
CREATE OR REPLACE FUNCTION create_audit_log(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
  v_log_id UUID;
BEGIN
  -- Получаем данные текущего пользователя
  v_user_id := auth.uid();
  
  -- Если пользователь не авторизован, используем системный ID или null
  IF v_user_id IS NULL THEN
    v_user_name := 'System';
    v_user_email := 'system@localhost';
  ELSE
    -- Получаем имя и email из профиля
    SELECT name, email 
    INTO v_user_name, v_user_email
    FROM profiles
    WHERE id = v_user_id;
  END IF;

  INSERT INTO audit_logs (
    user_id,
    user_name,
    user_email,
    action,
    entity_type,
    entity_id,
    entity_name,
    old_data,
    new_data
  ) VALUES (
    v_user_id,
    v_user_name,
    v_user_email,
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_old_data,
    p_new_data
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- 3. Проверяем результат
SELECT 
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns 
WHERE table_name = 'audit_logs' 
  AND column_name = 'user_id';
