-- ============================================
-- Миграция: Поштучный учёт оборудования (Inventory Items)
-- Дата: 2025-05-07
-- Описание: Добавляет таблицы для учёта отдельных экземпляров оборудования
-- ============================================

-- 1. Добавляем поля в cable_inventory для группового QR и флага поштучного учёта
ALTER TABLE cable_inventory
ADD COLUMN IF NOT EXISTS track_items BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- Уникальный индекс на QR-код группы (только если заполнен)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cable_inventory_qr_code_unique
ON cable_inventory(qr_code)
WHERE qr_code IS NOT NULL;

COMMENT ON COLUMN cable_inventory.track_items IS 'Включён ли поштучный учёт экземпляров';
COMMENT ON COLUMN cable_inventory.qr_code IS 'QR-код группы оборудования (для сканирования группы)';

-- 2. Создаём таблицу экземпляров оборудования
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES cable_inventory(id) ON DELETE CASCADE,
  serial_number TEXT, -- Ручной ввод серийного номера
  qr_code TEXT NOT NULL, -- Уникальный QR-код экземпляра: EQ-{groupQR}-{NN}
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'issued', 'repair', 'written_off')),
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'poor')),
  notes TEXT, -- Комментарий к экземпляру
  purchase_date DATE,
  purchase_price DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для inventory_items
CREATE INDEX IF NOT EXISTS idx_inventory_items_company_id ON inventory_items(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_inventory_id ON inventory_items(inventory_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_qr_code ON inventory_items(qr_code);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_serial_number ON inventory_items(serial_number) WHERE serial_number IS NOT NULL;

COMMENT ON TABLE inventory_items IS 'Экземпляры оборудования (поштучный учёт)';
COMMENT ON COLUMN inventory_items.qr_code IS 'Уникальный QR-код экземпляра, формат: EQ-{groupQR}-{NN}';
COMMENT ON COLUMN inventory_items.status IS 'available=на складе, issued=выдано, repair=в ремонте, written_off=списано';
COMMENT ON COLUMN inventory_items.condition IS 'excellent=отличное, good=хорошее, fair=удовлетворительное, poor=плохое';

-- 3. Создаём таблицу комментариев к экземплярам
CREATE TABLE IF NOT EXISTS item_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_comments_item_id ON item_comments(item_id);
CREATE INDEX IF NOT EXISTS idx_item_comments_created_at ON item_comments(created_at);

COMMENT ON TABLE item_comments IS 'Комментарии к экземплярам оборудования';

-- 4. Добавляем item_id в cable_movements для поштучной выдачи
ALTER TABLE cable_movements
ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cable_movements_item_id ON cable_movements(item_id);

COMMENT ON COLUMN cable_movements.item_id IS 'Ссылка на конкретный экземпляр (для поштучного учёта)';

-- 5. Добавляем item_id в equipment_repairs для поштучного ремонта
ALTER TABLE equipment_repairs
ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_repairs_item_id ON equipment_repairs(item_id);

COMMENT ON COLUMN equipment_repairs.item_id IS 'Ссылка на конкретный экземпляр (для поштучного учёта)';

-- 6. RLS для inventory_items
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view inventory items"
  ON inventory_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = inventory_items.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can insert inventory items"
  ON inventory_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = inventory_items.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can update inventory items"
  ON inventory_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = inventory_items.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can delete inventory items"
  ON inventory_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = inventory_items.company_id AND user_id = auth.uid() AND status = 'active'
  ));

-- 7. RLS для item_comments
ALTER TABLE item_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view item comments"
  ON item_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM company_members cm
    JOIN inventory_items ii ON ii.company_id = cm.company_id
    WHERE ii.id = item_comments.item_id AND cm.user_id = auth.uid() AND cm.status = 'active'
  ));

CREATE POLICY "Company members can insert item comments"
  ON item_comments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_members cm
    JOIN inventory_items ii ON ii.company_id = cm.company_id
    WHERE ii.id = item_comments.item_id AND cm.user_id = auth.uid() AND cm.status = 'active'
  ));

CREATE POLICY "Company members can delete their own comments"
  ON item_comments FOR DELETE
  USING (author_id = auth.uid());

-- 8. Функция для авто-обновления quantity в cable_inventory
-- При изменении статуса экземпляров пересчитываем доступное количество
CREATE OR REPLACE FUNCTION update_inventory_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- Обновляем quantity в cable_inventory = количество экземпляров со статусом available
  UPDATE cable_inventory
  SET quantity = (
    SELECT COUNT(*) FROM inventory_items
    WHERE inventory_id = COALESCE(NEW.inventory_id, OLD.inventory_id)
      AND status = 'available'
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.inventory_id, OLD.inventory_id)
    AND track_items = true;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Триггер на изменение inventory_items
DROP TRIGGER IF EXISTS trg_update_inventory_quantity ON inventory_items;
CREATE TRIGGER trg_update_inventory_quantity
  AFTER INSERT OR UPDATE OR DELETE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_quantity();

-- 9. Функция для генерации QR-кода экземпляра
CREATE OR REPLACE FUNCTION generate_item_qr_code(p_inventory_id UUID, p_index INTEGER)
RETURNS TEXT AS $$
DECLARE
  v_group_qr TEXT;
BEGIN
  -- Получаем QR-код группы
  SELECT qr_code INTO v_group_qr
  FROM cable_inventory
  WHERE id = p_inventory_id;

  -- Если у группы нет QR — генерируем из ID
  IF v_group_qr IS NULL THEN
    v_group_qr := 'EQ-' || UPPER(SUBSTRING(p_inventory_id::TEXT, 1, 6));
  END IF;

  -- Формат: EQ-GROUP-NN
  RETURN v_group_qr || '-' || LPAD(p_index::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql;

-- 10. Функция для массового создания экземпляров
CREATE OR REPLACE FUNCTION create_inventory_items(
  p_company_id UUID,
  p_inventory_id UUID,
  p_count INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
  v_existing_count INTEGER;
  v_created INTEGER := 0;
  v_i INTEGER;
BEGIN
  -- Считаем сколько экземпляров уже есть
  SELECT COUNT(*) INTO v_existing_count
  FROM inventory_items
  WHERE inventory_id = p_inventory_id;

  -- Создаём новые экземпляры
  FOR v_i IN 1..p_count LOOP
    INSERT INTO inventory_items (
      company_id,
      inventory_id,
      qr_code,
      status,
      condition
    ) VALUES (
      p_company_id,
      p_inventory_id,
      generate_item_qr_code(p_inventory_id, v_existing_count + v_i),
      'available',
      'good'
    );
    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$ LANGUAGE plpgsql;

SELECT 'Миграция поштучного учёта оборудования выполнена' as status;
