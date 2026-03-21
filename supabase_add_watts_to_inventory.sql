-- Добавляем поле мощности (watts) в cable_inventory для расчёта нагрузки

ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS watts INTEGER;

COMMENT ON COLUMN cable_inventory.watts IS 'Мощность оборудования в ваттах (для расчёта нагрузки)';

SELECT 'Поле watts добавлено в cable_inventory' as status;
