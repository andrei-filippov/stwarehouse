-- Добавляем колонку category в estimate_items
ALTER TABLE estimate_items ADD COLUMN IF NOT EXISTS category TEXT;
