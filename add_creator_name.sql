-- Добавляем поле creator_name в таблицу estimates
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS creator_name TEXT;
