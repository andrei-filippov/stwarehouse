-- ============================================
-- Дополнительные триггеры аудита для недостающих таблиц
-- + IP-адрес и User-Agent в create_audit_log
-- ============================================

-- Обновляем функцию create_audit_log чтобы захватывать IP и User-Agent
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
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
  v_ip TEXT;
  v_ua TEXT;
BEGIN
  v_user_id := auth.uid();

  SELECT name, email INTO v_user_name, v_user_email
  FROM profiles WHERE id = v_user_id;

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
    ip_address, user_agent
  ) VALUES (
    v_user_id, v_user_name, v_user_email,
    p_action, p_entity_type, p_entity_id, p_entity_name,
    p_old_data, p_new_data,
    v_ip, v_ua
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ============================================
-- 1. Чек-листы (checklists)
-- ============================================
CREATE OR REPLACE FUNCTION log_checklist_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'checklist', NEW.id, NEW.event_name, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log('update', 'checklist', NEW.id, NEW.event_name, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'checklist', OLD.id, OLD.event_name, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS checklist_audit_trigger ON checklists;
CREATE TRIGGER checklist_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON checklists
  FOR EACH ROW EXECUTE FUNCTION log_checklist_changes();

-- ============================================
-- 2. Позиции чек-листов (checklist_items)
-- ============================================
CREATE OR REPLACE FUNCTION log_checklist_item_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_checklist_name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT event_name INTO v_checklist_name FROM checklists WHERE id = OLD.checklist_id;
  ELSE
    SELECT event_name INTO v_checklist_name FROM checklists WHERE id = NEW.checklist_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'checklist_item', NEW.id, COALESCE(NEW.name,'Позиция') || ' (чек-лист: ' || COALESCE(v_checklist_name,'—') || ')', NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log('update', 'checklist_item', NEW.id, COALESCE(NEW.name,'Позиция') || ' (чек-лист: ' || COALESCE(v_checklist_name,'—') || ')', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'checklist_item', OLD.id, COALESCE(OLD.name,'Позиция') || ' (чек-лист: ' || COALESCE(v_checklist_name,'—') || ')', to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS checklist_item_audit_trigger ON checklist_items;
CREATE TRIGGER checklist_item_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON checklist_items
  FOR EACH ROW EXECUTE FUNCTION log_checklist_item_changes();

-- ============================================
-- 3. Инвентарь (cable_inventory)
-- ============================================
CREATE OR REPLACE FUNCTION log_cable_inventory_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'inventory', NEW.id, COALESCE(NEW.name, 'Позиция инвентаря'), NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log('update', 'inventory', NEW.id, COALESCE(NEW.name, 'Позиция инвентаря'), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'inventory', OLD.id, COALESCE(OLD.name, 'Позиция инвентаря'), to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS cable_inventory_audit_trigger ON cable_inventory;
CREATE TRIGGER cable_inventory_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON cable_inventory
  FOR EACH ROW EXECUTE FUNCTION log_cable_inventory_changes();

-- ============================================
-- 4. Движения инвентаря (cable_movements)
-- ============================================
CREATE OR REPLACE FUNCTION log_cable_movement_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(name, equipment_name) INTO v_item_name FROM cable_inventory WHERE id = OLD.inventory_id;
  ELSE
    SELECT COALESCE(name, equipment_name) INTO v_item_name FROM cable_inventory WHERE id = NEW.inventory_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'movement', NEW.id, COALESCE(v_item_name,'Перемещение') || ' → ' || COALESCE(NEW.issued_to,'—'), NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log('update', 'movement', NEW.id, COALESCE(v_item_name,'Перемещение') || ' → ' || COALESCE(NEW.issued_to,'—'), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'movement', OLD.id, COALESCE(v_item_name,'Перемещение') || ' → ' || COALESCE(OLD.issued_to,'—'), to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS cable_movement_audit_trigger ON cable_movements;
CREATE TRIGGER cable_movement_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON cable_movements
  FOR EACH ROW EXECUTE FUNCTION log_cable_movement_changes();

-- ============================================
-- 5. Ремонты (equipment_repairs)
-- ============================================
CREATE OR REPLACE FUNCTION log_equipment_repair_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(name, equipment_name) INTO v_item_name FROM cable_inventory WHERE id = OLD.inventory_id;
  ELSE
    SELECT COALESCE(name, equipment_name) INTO v_item_name FROM cable_inventory WHERE id = NEW.inventory_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'repair', NEW.id, COALESCE(v_item_name,'Ремонт') || ' — ' || COALESCE(NEW.reason,'—'), NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log('update', 'repair', NEW.id, COALESCE(v_item_name,'Ремонт') || ' — ' || COALESCE(NEW.reason,'—'), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'repair', OLD.id, COALESCE(v_item_name,'Ремонт') || ' — ' || COALESCE(OLD.reason,'—'), to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS equipment_repair_audit_trigger ON equipment_repairs;
CREATE TRIGGER equipment_repair_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON equipment_repairs
  FOR EACH ROW EXECUTE FUNCTION log_equipment_repair_changes();

-- ============================================
-- 6. Комплекты / кофры (equipment_kits)
-- ============================================
CREATE OR REPLACE FUNCTION log_equipment_kit_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_audit_log('create', 'kit', NEW.id, NEW.name, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM create_audit_log('update', 'kit', NEW.id, NEW.name, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM create_audit_log('delete', 'kit', OLD.id, OLD.name, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS equipment_kit_audit_trigger ON equipment_kits;
CREATE TRIGGER equipment_kit_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON equipment_kits
  FOR EACH ROW EXECUTE FUNCTION log_equipment_kit_changes();

-- ============================================
-- Индекс для быстрого поиска по IP
-- ============================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON audit_logs(ip_address);

SELECT 'Дополнительные аудит-триггеры добавлены' as status;
