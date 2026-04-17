-- Добавляем тип категории (sound / light / other) для группировки оборудования по мощности
ALTER TABLE cable_categories
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'other' CHECK (type IN ('sound', 'light', 'other'));

COMMENT ON COLUMN cable_categories.type IS 'Тип категории оборудования: sound (звук), light (свет), other (прочее)';

-- Добавляем поля мощности и типа категории в чек-листы для расчета нагрузки
ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS watts INTEGER;

ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS category_type TEXT DEFAULT 'other' CHECK (category_type IN ('sound', 'light', 'other'));

COMMENT ON COLUMN checklist_items.watts IS 'Мощность одной единицы оборудования в ваттах';
COMMENT ON COLUMN checklist_items.category_type IS 'Тип категории оборудования для группировки мощности';

SELECT 'Миграция завершена' as status;
