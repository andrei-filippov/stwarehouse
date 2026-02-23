-- Добавление отсутствующих колонок в таблицу estimates

-- Добавляем customer_id (ссылка на заказчика)
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- Добавляем customer_name (кэш имени для отображения)
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Проверяем результат
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'estimates'
ORDER BY ordinal_position;
