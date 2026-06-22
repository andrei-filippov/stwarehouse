-- Добавляем колонку description в template_items для хранения описания оборудования
-- Это позволяет различать позиции с одинаковым названием но разным описанием

ALTER TABLE IF EXISTS template_items
ADD COLUMN IF NOT EXISTS description TEXT;

-- Комментарий к колонке
COMMENT ON COLUMN template_items.description IS 'Описание оборудования для отображения в шаблоне и смете';
