-- Добавление колонки color в таблицу estimates
-- для хранения цвета события в календаре

-- Добавляем колонку color
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS color VARCHAR(50);

-- Комментарий к колонке
COMMENT ON COLUMN estimates.color IS 'Цвет события в календаре (hex или название цвета)';

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_estimates_color ON estimates(color);

-- Обновляем существующие записи - ставим дефолтный цвет blue
UPDATE estimates 
SET color = 'blue'
WHERE color IS NULL;

-- Добавляем ограничение на валидные цвета (опционально)
-- Можно раскомментировать если нужно строгое ограничение
/*
ALTER TABLE estimates 
ADD CONSTRAINT valid_colors 
CHECK (color IN ('blue', 'green', 'red', 'purple', 'orange', 'pink', 'cyan', 'amber', 'emerald', 'indigo', 'rose', 'teal'));
*/
