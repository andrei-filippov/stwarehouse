-- ============================================
-- СВЯЗЬ equipment ↔ cable_inventory
-- ============================================

-- 1. Добавляем поле inventory_id в equipment
ALTER TABLE equipment 
ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES cable_inventory(id) ON DELETE SET NULL;

-- 2. Добавляем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_equipment_inventory_id ON equipment(inventory_id);

-- 3. Добавляем поле equipment_id в cable_inventory (обратная связь)
ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL;

-- 4. Индекс для cable_inventory
CREATE INDEX IF NOT EXISTS idx_cable_inventory_equipment_id ON cable_inventory(equipment_id);

-- 5. Комментарии для ясности
COMMENT ON COLUMN equipment.inventory_id IS 'Ссылка на актуальный склад cable_inventory';
COMMENT ON COLUMN cable_inventory.equipment_id IS 'Ссылка на оборудование для смет (обратная совместимость)';

-- ============================================
-- МИГРАЦИЯ СУЩЕСТВУЮЩИХ ДАННЫХ
-- ============================================

-- Создаём связи по совпадению имени и категории (для начала)
-- Это одноразовая операция для существующих данных

-- Связываем equipment с cable_inventory по имени (если совпадает)
UPDATE equipment e
SET inventory_id = ci.id
FROM cable_inventory ci
WHERE e.inventory_id IS NULL
  AND e.name = ci.name
  AND e.company_id = ci.company_id;

-- Обратная связь: заполняем equipment_id в cable_inventory
UPDATE cable_inventory ci
SET equipment_id = e.id
FROM equipment e
WHERE ci.equipment_id IS NULL
  AND ci.id = e.inventory_id;

-- ============================================
-- ТРИГГЕР ДЛЯ АВТОМАТИЧЕСКОЙ СИНХРОНИЗАЦИИ
-- ============================================

-- Функция для автоматического обновления количества
CREATE OR REPLACE FUNCTION sync_equipment_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- Если обновили cable_inventory и есть связь с equipment
  IF TG_OP = 'UPDATE' AND NEW.equipment_id IS NOT NULL THEN
    UPDATE equipment
    SET quantity = NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.equipment_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер на обновление cable_inventory
DROP TRIGGER IF EXISTS trg_sync_equipment_quantity ON cable_inventory;
CREATE TRIGGER trg_sync_equipment_quantity
  AFTER UPDATE OF quantity ON cable_inventory
  FOR EACH ROW
  EXECUTE FUNCTION sync_equipment_quantity();

-- ============================================
-- ФУНКЦИЯ ДЛЯ СОЗДАНИЯ ОБОРУДОВАНИЯ В ОБЕИХ ТАБЛИЦАХ
-- ============================================

CREATE OR REPLACE FUNCTION create_equipment_linked(
  p_company_id UUID,
  p_name TEXT,
  p_category TEXT,
  p_quantity INTEGER DEFAULT 0,
  p_price DECIMAL DEFAULT 0,
  p_description TEXT DEFAULT '',
  p_unit TEXT DEFAULT 'шт',
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(equipment_id UUID, inventory_id UUID) AS $$
DECLARE
  v_equipment_id UUID;
  v_inventory_id UUID;
BEGIN
  -- 1. Создаём запись в equipment (для смет)
  INSERT INTO equipment (
    user_id, name, category, quantity, price, description, unit, company_id
  ) VALUES (
    p_user_id, p_name, p_category, p_quantity, p_price, p_description, p_unit, p_company_id
  )
  RETURNING id INTO v_equipment_id;
  
  -- 2. Создаём запись в cable_inventory (для склада)
  INSERT INTO cable_inventory (
    company_id, category_id, name, quantity, price, unit, equipment_id
  ) VALUES (
    p_company_id, 
    (SELECT id FROM categories WHERE name = p_category AND company_id = p_company_id LIMIT 1),
    p_name,
    p_quantity,
    p_price,
    p_unit,
    v_equipment_id
  )
  RETURNING id INTO v_inventory_id;
  
  -- 3. Обновляем связь в equipment
  UPDATE equipment SET inventory_id = v_inventory_id WHERE id = v_equipment_id;
  
  RETURN QUERY SELECT v_equipment_id, v_inventory_id;
END;
$$ LANGUAGE plpgsql;
