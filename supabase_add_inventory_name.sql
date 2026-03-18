-- Добавляем поле name в cable_inventory для названия позиций (не кабелей)

ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Делаем length опциональным (NULL для оборудования без длины)
-- Уже есть DEFAULT 0, но можно установить NULL
ALTER TABLE cable_inventory 
ALTER COLUMN length DROP NOT NULL;

COMMENT ON COLUMN cable_inventory.name IS 'Название позиции (для оборудования, не кабелей)';
COMMENT ON COLUMN cable_inventory.length IS 'Длина для кабелей, NULL для оборудования без длины';
