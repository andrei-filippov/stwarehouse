-- Миграция: добавление поля category_order в таблицу estimates
-- для сохранения порядка категорий после drag-and-drop

-- Добавляем поле category_order (JSONB массив)
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS category_order JSONB DEFAULT '[]'::jsonb;

-- Комментарий к полю
COMMENT ON COLUMN estimates.category_order IS 'Порядок категорий в смете (массив названий категорий)';
