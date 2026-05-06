-- ============================================
-- Миграция: добавление company_id в audit_logs
-- для мультитенантности
-- ============================================

-- 1. Добавляем колонку company_id в audit_logs
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- 2. Индекс для быстрого поиска по компании
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);

-- 3. Обновляем функцию create_audit_log для поддержки company_id
CREATE OR REPLACE FUNCTION create_audit_log(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_company_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
  v_ip TEXT;
  v_ua TEXT;
  v_company_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Получаем информацию о пользователе
  SELECT p.name, p.email
  INTO v_user_name, v_user_email
  FROM profiles p 
  WHERE p.id = v_user_id;

  -- Если company_id не передан явно, берём из company_members
  IF p_company_id IS NULL THEN
    SELECT company_id INTO v_company_id
    FROM company_members
    WHERE user_id = v_user_id
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    v_company_id := p_company_id;
  END IF;

  -- Пытаемся получить IP и User-Agent из заголовков запроса
  BEGIN
    v_ip := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
    IF v_ip IS NULL OR v_ip = '' THEN
      v_ip := current_setting('request.headers', true)::jsonb->>'x-real-ip';
    END IF;
    v_ua := current_setting('request.headers', true)::jsonb->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
    v_ua := NULL;
  END;

  INSERT INTO audit_logs (
    user_id, user_name, user_email,
    action, entity_type, entity_id, entity_name,
    old_data, new_data,
    ip_address, user_agent,
    company_id
  ) VALUES (
    v_user_id, v_user_name, v_user_email,
    p_action, p_entity_type, p_entity_id, p_entity_name,
    p_old_data, p_new_data,
    v_ip, v_ua,
    v_company_id
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- 4. Обновляем триггер для смет - передаём company_id из estimates
CREATE OR REPLACE FUNCTION log_estimate_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(
      'create', 'estimate', NEW.id, NEW.event_name,
      NULL, to_jsonb(NEW), NEW.company_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(
      'update', 'estimate', NEW.id, NEW.event_name,
      to_jsonb(OLD), to_jsonb(NEW), NEW.company_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(
      'delete', 'estimate', OLD.id, OLD.event_name,
      to_jsonb(OLD), NULL, OLD.company_id
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 5. Обновляем триггер для оборудования
CREATE OR REPLACE FUNCTION log_equipment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(
      'create', 'equipment', NEW.id, NEW.name,
      NULL, to_jsonb(NEW), NEW.company_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(
      'update', 'equipment', NEW.id, NEW.name,
      to_jsonb(OLD), to_jsonb(NEW), NEW.company_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(
      'delete', 'equipment', OLD.id, OLD.name,
      to_jsonb(OLD), NULL, OLD.company_id
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 6. Обновляем триггер для заказчиков
CREATE OR REPLACE FUNCTION log_customer_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(
      'create', 'customer', NEW.id, NEW.name,
      NULL, to_jsonb(NEW), NEW.company_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(
      'update', 'customer', NEW.id, NEW.name,
      to_jsonb(OLD), to_jsonb(NEW), NEW.company_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(
      'delete', 'customer', OLD.id, OLD.name,
      to_jsonb(OLD), NULL, OLD.company_id
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 7. Обновляем триггер для сотрудников
CREATE OR REPLACE FUNCTION log_staff_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(
      'create', 'staff', NEW.id, NEW.full_name,
      NULL, to_jsonb(NEW), NEW.company_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(
      'update', 'staff', NEW.id, NEW.full_name,
      to_jsonb(OLD), to_jsonb(NEW), NEW.company_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(
      'delete', 'staff', OLD.id, OLD.full_name,
      to_jsonb(OLD), NULL, OLD.company_id
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 8. Обновляем триггер для договоров
CREATE OR REPLACE FUNCTION log_contract_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(
      'create', 'contract', NEW.id, NEW.number || ' - ' || COALESCE(NEW.event_name, 'Без названия'),
      NULL, to_jsonb(NEW), NEW.company_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(
      'update', 'contract', NEW.id, NEW.number || ' - ' || COALESCE(NEW.event_name, 'Без названия'),
      to_jsonb(OLD), to_jsonb(NEW), NEW.company_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(
      'delete', 'contract', OLD.id, OLD.number || ' - ' || COALESCE(OLD.event_name, 'Без названия'),
      to_jsonb(OLD), NULL, OLD.company_id
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 9. Обновляем триггер для шаблонов договоров
CREATE OR REPLACE FUNCTION log_contract_template_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(
      'create', 'template', NEW.id, NEW.name,
      NULL, to_jsonb(NEW), NEW.company_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(
      'update', 'template', NEW.id, NEW.name,
      to_jsonb(OLD), to_jsonb(NEW), NEW.company_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(
      'delete', 'template', OLD.id, OLD.name,
      to_jsonb(OLD), NULL, OLD.company_id
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 10. Обновляем триггер для позиций смет
CREATE OR REPLACE FUNCTION log_estimate_item_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_estimate_name TEXT;
  v_company_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT event_name, company_id INTO v_estimate_name, v_company_id 
    FROM estimates WHERE id = OLD.estimate_id;
  ELSE
    SELECT event_name, company_id INTO v_estimate_name, v_company_id 
    FROM estimates WHERE id = NEW.estimate_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log(
      'create', 'estimate_item', NEW.id,
      COALESCE(NEW.name, 'Позиция') || ' (смета: ' || COALESCE(v_estimate_name, 'Unknown') || ')',
      NULL, to_jsonb(NEW), v_company_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log(
      'update', 'estimate_item', NEW.id,
      COALESCE(NEW.name, 'Позиция') || ' (смета: ' || COALESCE(v_estimate_name, 'Unknown') || ')',
      to_jsonb(OLD), to_jsonb(NEW), v_company_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log(
      'delete', 'estimate_item', OLD.id,
      COALESCE(OLD.name, 'Позиция') || ' (смета: ' || COALESCE(v_estimate_name, 'Unknown') || ')',
      to_jsonb(OLD), NULL, v_company_id
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 11. Обновляем триггер для чек-листов
CREATE OR REPLACE FUNCTION log_checklist_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'checklist', NEW.id, NEW.event_name, NULL, to_jsonb(NEW), NEW.company_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log('update', 'checklist', NEW.id, NEW.event_name, to_jsonb(OLD), to_jsonb(NEW), NEW.company_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'checklist', OLD.id, OLD.event_name, to_jsonb(OLD), NULL, OLD.company_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 12. Обновляем триггер для позиций чек-листов
CREATE OR REPLACE FUNCTION log_checklist_item_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_checklist_name TEXT;
  v_company_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT event_name, company_id INTO v_checklist_name, v_company_id FROM checklists WHERE id = OLD.checklist_id;
  ELSE
    SELECT event_name, company_id INTO v_checklist_name, v_company_id FROM checklists WHERE id = NEW.checklist_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'checklist_item', NEW.id, COALESCE(NEW.name,'Позиция') || ' (чек-лист: ' || COALESCE(v_checklist_name,'—') || ')', NULL, to_jsonb(NEW), v_company_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log('update', 'checklist_item', NEW.id, COALESCE(NEW.name,'Позиция') || ' (чек-лист: ' || COALESCE(v_checklist_name,'—') || ')', to_jsonb(OLD), to_jsonb(NEW), v_company_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'checklist_item', OLD.id, COALESCE(OLD.name,'Позиция') || ' (чек-лист: ' || COALESCE(v_checklist_name,'—') || ')', to_jsonb(OLD), NULL, v_company_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 13. Обновляем триггер для инвентаря
CREATE OR REPLACE FUNCTION log_cable_inventory_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'inventory', NEW.id, COALESCE(NEW.name, 'Позиция инвентаря'), NULL, to_jsonb(NEW), NEW.company_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log('update', 'inventory', NEW.id, COALESCE(NEW.name, 'Позиция инвентаря'), to_jsonb(OLD), to_jsonb(NEW), NEW.company_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'inventory', OLD.id, COALESCE(OLD.name, 'Позиция инвентаря'), to_jsonb(OLD), NULL, OLD.company_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 14. Обновляем триггер для движений инвентаря
CREATE OR REPLACE FUNCTION log_cable_movement_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_name TEXT;
  v_company_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(name, equipment_name), company_id INTO v_item_name, v_company_id FROM cable_inventory WHERE id = OLD.inventory_id;
  ELSE
    SELECT COALESCE(name, equipment_name), company_id INTO v_item_name, v_company_id FROM cable_inventory WHERE id = NEW.inventory_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'movement', NEW.id, COALESCE(v_item_name,'Перемещение') || ' → ' || COALESCE(NEW.issued_to,'—'), NULL, to_jsonb(NEW), v_company_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log('update', 'movement', NEW.id, COALESCE(v_item_name,'Перемещение') || ' → ' || COALESCE(NEW.issued_to,'—'), to_jsonb(OLD), to_jsonb(NEW), v_company_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'movement', OLD.id, COALESCE(v_item_name,'Перемещение') || ' → ' || COALESCE(OLD.issued_to,'—'), to_jsonb(OLD), NULL, v_company_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 15. Обновляем триггер для ремонтов
CREATE OR REPLACE FUNCTION log_equipment_repair_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_name TEXT;
  v_company_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(name, equipment_name), company_id INTO v_item_name, v_company_id FROM cable_inventory WHERE id = OLD.inventory_id;
  ELSE
    SELECT COALESCE(name, equipment_name), company_id INTO v_item_name, v_company_id FROM cable_inventory WHERE id = NEW.inventory_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'repair', NEW.id, COALESCE(v_item_name,'Ремонт') || ' — ' || COALESCE(NEW.reason,'—'), NULL, to_jsonb(NEW), v_company_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log('update', 'repair', NEW.id, COALESCE(v_item_name,'Ремонт') || ' — ' || COALESCE(NEW.reason,'—'), to_jsonb(OLD), to_jsonb(NEW), v_company_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'repair', OLD.id, COALESCE(v_item_name,'Ремонт') || ' — ' || COALESCE(OLD.reason,'—'), to_jsonb(OLD), NULL, v_company_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 16. Обновляем триггер для комплектов
CREATE OR REPLACE FUNCTION log_equipment_kit_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'kit', NEW.id, NEW.name, NULL, to_jsonb(NEW), NEW.company_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log('update', 'kit', NEW.id, NEW.name, to_jsonb(OLD), to_jsonb(NEW), NEW.company_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'kit', OLD.id, OLD.name, to_jsonb(OLD), NULL, OLD.company_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================
-- Обновляем RLS политики для мультитенантности
-- ============================================

-- Удаляем старые политики
DROP POLICY IF EXISTS "Только админы видят логи" ON audit_logs;
DROP POLICY IF EXISTS "Пользователи видят свои логи" ON audit_logs;
DROP POLICY IF EXISTS "Вставка логов для авторизованных" ON audit_logs;

-- Новая политика: пользователи видят логи своей компании
CREATE POLICY "Пользователи видят логи своей компании"
  ON audit_logs
  FOR SELECT
  USING (
    company_id IS NOT NULL 
    AND company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() 
      AND status = 'active'
    )
  );

-- Админы видят логи всех компаний, где они состоят
CREATE POLICY "Админы видят логи своих компаний"
  ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.user_id = auth.uid()
      AND cm.company_id = audit_logs.company_id
      AND cm.status = 'active'
    )
  );

-- Вставка логов разрешена всем аутентифицированным
CREATE POLICY "Вставка логов для авторизованных"
  ON audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- Обновляем существующие записи - проставляем company_id из company_members
-- ============================================
UPDATE audit_logs al
SET company_id = cm.company_id
FROM company_members cm
WHERE al.user_id = cm.user_id
  AND al.company_id IS NULL
  AND cm.status = 'active'
  AND cm.company_id IS NOT NULL;

SELECT 'Миграция company_id для audit_logs завершена' as status;
