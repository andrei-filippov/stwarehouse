-- Миграция: добавление полей для учета количества при сканировании QR в чек-листах
-- Дата: 2026-03-23

-- Добавляем поле loaded_quantity для отслеживания количества отсканированного при погрузке
ALTER TABLE checklist_items 
ADD COLUMN IF NOT EXISTS loaded_quantity INTEGER DEFAULT 0;

-- Добавляем поле unloaded_quantity для отслеживания количества отсканированного при разгрузке  
ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS unloaded_quantity INTEGER DEFAULT 0;

-- Обновляем существующие записи: если loaded=true, считаем что loaded_quantity = quantity
UPDATE checklist_items 
SET loaded_quantity = quantity 
WHERE loaded = true AND loaded_quantity = 0;

-- Обновляем существующие записи: если unloaded=true, считаем что unloaded_quantity = quantity
UPDATE checklist_items 
SET unloaded_quantity = quantity 
WHERE unloaded = true AND unloaded_quantity = 0;

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_checklist_items_loaded_qty ON checklist_items(loaded_quantity);
CREATE INDEX IF NOT EXISTS idx_checklist_items_unloaded_qty ON checklist_items(unloaded_quantity);

-- Комментарии к полям
COMMENT ON COLUMN checklist_items.loaded_quantity IS 'Фактическое количество отсканированное при погрузке';
COMMENT ON COLUMN checklist_items.unloaded_quantity IS 'Фактическое количество отсканированное при разгрузке';

-- Проверяем результат
SELECT 
    COUNT(*) as total_items,
    COUNT(loaded_quantity) as with_loaded_qty,
    COUNT(unloaded_quantity) as with_unloaded_qty
FROM checklist_items;