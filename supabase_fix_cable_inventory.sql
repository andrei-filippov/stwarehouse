-- ============================================
-- Добавляем недостающие поля в cable_inventory
-- для поддержки оборудования
-- ============================================

-- Добавляем поле name (название оборудования)
ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Добавляем поле price (цена аренды)
ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2);

-- Добавляем поле unit (единица измерения)
ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'шт';

-- Добавляем поле qr_code (для сканирования)
ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE;

-- Добавляем поле watts (мощность)
ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS watts INTEGER;

-- Добавляем поле equipment_id (связь с таблицей equipment)
ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL;

-- Индекс для поиска по QR-коду
CREATE INDEX IF NOT EXISTS idx_cable_inventory_qr_code ON cable_inventory(qr_code);

-- Индекс для связи с equipment
CREATE INDEX IF NOT EXISTS idx_cable_inventory_equipment_id ON cable_inventory(equipment_id);

-- ============================================
-- Обновляем RLS политики (если нужно)
-- ============================================

-- Убедимся что политики INSERT разрешают все новые поля
-- (обычно RLS не проверяет отдельные поля, только строки)

SELECT 'Поля добавлены в cable_inventory' as status;
