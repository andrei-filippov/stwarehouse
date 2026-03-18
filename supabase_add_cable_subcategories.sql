-- Добавление поддержки подкатегорий для кабельного учета

-- Добавляем поле parent_id в cable_categories
ALTER TABLE cable_categories 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES cable_categories(id) ON DELETE CASCADE;

-- Индекс для быстрого поиска подкатегорий
CREATE INDEX IF NOT EXISTS idx_cable_categories_parent_id ON cable_categories(parent_id);

-- Обновляем RLS политики (они уже есть, но на всякий случай проверим)
-- Политики наследуются от родительской таблицы

-- Комментарий
COMMENT ON COLUMN cable_categories.parent_id IS 'ID родительской категории (для подкатегорий)';
