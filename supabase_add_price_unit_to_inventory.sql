-- Добавляем поля price и unit в cable_inventory для учёта оборудования

-- 1. Добавляем поле price (цена аренды)
ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0;

-- 2. Добавляем поле unit (единица измерения)
ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'шт';

-- 3. Комментарии
COMMENT ON COLUMN cable_inventory.price IS 'Цена аренды оборудования';
COMMENT ON COLUMN cable_inventory.unit IS 'Единица измерения (шт, комплект, услуга и т.д.)';

-- 4. Обновляем существующие записи
UPDATE cable_inventory 
SET price = 0, unit = 'шт' 
WHERE price IS NULL OR unit IS NULL;

SELECT 'Поля price и unit добавлены в cable_inventory' as status;
