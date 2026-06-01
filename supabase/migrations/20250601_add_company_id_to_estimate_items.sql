-- Добавление company_id в estimate_items для RLS политик
-- Проблема: RLS политика estimate_items_select_company требует company_id,
-- но колонки не существует, поэтому items не загружаются

-- 1. Добавляем колонку company_id
ALTER TABLE estimate_items 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 2. Создаём индекс
CREATE INDEX IF NOT EXISTS idx_estimate_items_company_id 
ON estimate_items(company_id);

-- 3. Заполняем company_id из связанных estimates
UPDATE estimate_items 
SET company_id = estimates.company_id
FROM estimates 
WHERE estimate_items.estimate_id = estimates.id 
  AND estimate_items.company_id IS NULL;

-- 4. Проверяем что все заполнены
-- SELECT COUNT(*) FROM estimate_items WHERE company_id IS NULL;

-- 5. Делаем колонку NOT NULL (опционально, после проверки)
-- ALTER TABLE estimate_items ALTER COLUMN company_id SET NOT NULL;

-- 6. Обновляем RLS политики (если нужно)
-- Политика estimate_items_select_company уже использует is_company_member(company_id)
