-- Добавляем колонку slug в companies

-- 1. Добавляем колонку
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- 2. Генерируем slug для существующих компаний
UPDATE companies 
SET slug = LOWER(REGEXP_REPLACE(
  REGEXP_REPLACE(name, '[^a-zA-Z0-9а-яА-Я\\s]', '', 'g'),
  '\\s+', '-', 'g'
))
WHERE slug IS NULL;

-- 3. Проверяем
SELECT id, name, slug FROM companies LIMIT 5;
