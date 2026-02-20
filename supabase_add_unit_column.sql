-- Добавление колонки unit в таблицу equipment
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'шт';

-- Обновление существующих записей
UPDATE equipment SET unit = 'шт' WHERE unit IS NULL;
