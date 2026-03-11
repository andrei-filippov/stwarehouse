-- ============================================
-- Делаем user_id nullable в checklists
-- ============================================

-- Делаем колонку user_id nullable
ALTER TABLE checklists 
ALTER COLUMN user_id DROP NOT NULL;

-- Проверяем результат
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'checklists' 
  AND column_name = 'user_id';
