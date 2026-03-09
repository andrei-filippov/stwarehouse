-- ============================================
-- Таблица аудита (логов) действий пользователей
-- ============================================

-- Таблица логов аудита
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT, -- Имя пользователя (кэш для удобства)
  user_email TEXT, -- Email пользователя (кэш для удобства)
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'view', 'login', 'logout'
  entity_type TEXT NOT NULL, -- 'estimate', 'equipment', 'customer', 'staff', 'contract', 'user'
  entity_id UUID, -- ID сущности (может быть null для действий без сущности)
  entity_name TEXT, -- Название сущности (кэш)
  old_data JSONB, -- Старые данные (для update/delete)
  new_data JSONB, -- Новые данные (для create/update)
  ip_address TEXT, -- IP адрес (если доступен)
  user_agent TEXT, -- User agent браузера
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Политики безопасности (RLS)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Только админы могут видеть все логи
CREATE POLICY "Только админы видят логи"
  ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Пользователи могут видеть только свои логи
CREATE POLICY "Пользователи видят свои логи"
  ON audit_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Вставка логов разрешена всем аутентифицированным
CREATE POLICY "Вставка логов для авторизованных"
  ON audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- Функция для автоматической записи логов
-- ============================================

-- Функция для создания лога
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
  v_log_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Получаем информацию о пользователе
  SELECT name, email INTO v_user_name, v_user_email
  FROM profiles
  WHERE id = auth.uid();

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
    auth.uid(),
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

-- ============================================
-- Триггеры для автоматического логирования
-- ============================================

-- Логирование изменений смет
CREATE OR REPLACE FUNCTION log_estimate_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(
      'create',
      'estimate',
      NEW.id,
      NEW.event_name,
      NULL,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(
      'update',
      'estimate',
      NEW.id,
      NEW.event_name,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(
      'delete',
      'estimate',
      OLD.id,
      OLD.event_name,
      to_jsonb(OLD),
      NULL
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Удаляем старый триггер если есть
DROP TRIGGER IF EXISTS estimate_audit_trigger ON estimates;

-- Создаём триггер
CREATE TRIGGER estimate_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION log_estimate_changes();

-- Логирование изменений оборудования
CREATE OR REPLACE FUNCTION log_equipment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(
      'create',
      'equipment',
      NEW.id,
      NEW.name,
      NULL,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(
      'update',
      'equipment',
      NEW.id,
      NEW.name,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(
      'delete',
      'equipment',
      OLD.id,
      OLD.name,
      to_jsonb(OLD),
      NULL
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS equipment_audit_trigger ON equipment;

CREATE TRIGGER equipment_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON equipment
  FOR EACH ROW
  EXECUTE FUNCTION log_equipment_changes();

-- Логирование изменений заказчиков
CREATE OR REPLACE FUNCTION log_customer_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(
      'create',
      'customer',
      NEW.id,
      NEW.name,
      NULL,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(
      'update',
      'customer',
      NEW.id,
      NEW.name,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(
      'delete',
      'customer',
      OLD.id,
      OLD.name,
      to_jsonb(OLD),
      NULL
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS customer_audit_trigger ON customers;

CREATE TRIGGER customer_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION log_customer_changes();
