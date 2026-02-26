-- Добавление поля notes (комментарий) к таблице cable_inventory

ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN cable_inventory.notes IS 'Комментарий к позиции (например: в коробке по 10 шт, IP65)';
