-- Добавление колонок для хранения периода мероприятия
-- Выполните этот скрипт в SQL Editor Supabase

-- Добавляем колонку event_start_date (дата начала мероприятия)
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS event_start_date DATE;

-- Добавляем колонку event_end_date (дата окончания мероприятия)
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS event_end_date DATE;

-- Обновляем существующие записи: копируем event_date в новые колонки
UPDATE estimates 
SET event_start_date = event_date,
    event_end_date = event_date
WHERE event_start_date IS NULL;

-- Создаем индексы для быстрого поиска по датам
CREATE INDEX IF NOT EXISTS idx_estimates_event_start_date ON estimates(event_start_date);
CREATE INDEX IF NOT EXISTS idx_estimates_event_end_date ON estimates(event_end_date);

-- Проверяем результат
SELECT 
    id, 
    event_name, 
    event_date, 
    event_start_date, 
    event_end_date 
FROM estimates 
LIMIT 5;
