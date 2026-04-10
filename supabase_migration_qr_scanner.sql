-- ============================================
-- МИГРАЦИЯ ДЛЯ QR СКАНЕРА И ИНТЕГРАЦИИ СМЕТ/СКЛАДА
-- ============================================

-- 1. Добавляем недостающие поля в cable_inventory (если не добавлены)
ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'шт',
ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL;

-- 2. Добавляем связь в equipment (если не добавлена)
ALTER TABLE equipment 
ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES cable_inventory(id) ON DELETE SET NULL;

-- 3. Создаём индексы
CREATE INDEX IF NOT EXISTS idx_cable_inventory_equipment_id ON cable_inventory(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_inventory_id ON equipment(inventory_id);
CREATE INDEX IF NOT EXISTS idx_cable_inventory_qr_code ON cable_inventory(qr_code);

-- 4. Связываем существующее оборудование по совпадению имени
-- Это позволит QR сканеру находить резервы для старого оборудования
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

-- 5. Проверяем результат миграции
SELECT 
  'Связано equipment ↔ cable_inventory' as description,
  COUNT(*) as count
FROM equipment 
WHERE inventory_id IS NOT NULL
UNION ALL
SELECT 
  'Всего записей в equipment' as description,
  COUNT(*) as count
FROM equipment;

-- ============================================
-- ГОТОВО!
-- ============================================
