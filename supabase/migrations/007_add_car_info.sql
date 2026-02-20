-- Добавление поля car_info в таблицу staff
ALTER TABLE staff ADD COLUMN IF NOT EXISTS car_info TEXT;
