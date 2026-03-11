-- ============================================
-- Добавление колонки category_order в checklists
-- ============================================

-- Добавляем колонку category_order
ALTER TABLE checklists 
ADD COLUMN IF NOT EXISTS category_order JSONB;

-- Проверяем результат
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'checklists' 
  AND column_name = 'category_order';
