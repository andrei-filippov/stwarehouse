-- ============================================
-- Проверка таблицы checklists
-- ============================================

-- Структура таблицы
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'checklists'
ORDER BY ordinal_position;

-- RLS политики
SELECT policyname, cmd, qual::text
FROM pg_policies
WHERE tablename = 'checklists';
