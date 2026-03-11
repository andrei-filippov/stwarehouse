-- ============================================
-- Добавление колонки items в checklists
-- ============================================

-- Проверяем текущую структуру
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'checklists'
ORDER BY ordinal_position;

-- Добавляем колонку items если её нет
ALTER TABLE checklists 
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- Добавляем колонку notes если её нет
ALTER TABLE checklists 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Проверяем результат
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'checklists'
ORDER BY ordinal_position;
