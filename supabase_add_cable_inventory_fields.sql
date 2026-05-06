-- ============================================
-- Миграция: добавление недостающих полей в cable_inventory
-- для поддержки экспорта/импорта оборудования
-- ============================================

-- Добавляем недостающие колонки в cable_inventory
ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS equipment_name TEXT,
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'шт',
ADD COLUMN IF NOT EXISTS watts INTEGER,
ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- Уникальный индекс на QR-код (если используется)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cable_inventory_qr_code 
ON cable_inventory(qr_code) 
WHERE qr_code IS NOT NULL;

-- Индекс для поиска по названию
CREATE INDEX IF NOT EXISTS idx_cable_inventory_name 
ON cable_inventory(name) 
WHERE name IS NOT NULL;

-- Обновляем существующие записи: копируем данные из movements если есть
UPDATE cable_inventory ci
SET equipment_name = cm.equipment_name
FROM cable_movements cm
WHERE ci.id = cm.inventory_id
  AND ci.equipment_name IS NULL
  AND cm.equipment_name IS NOT NULL;

SELECT 'Поля name, equipment_name, price, unit, watts, qr_code добавлены в cable_inventory' as status;
