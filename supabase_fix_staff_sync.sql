-- Фикс для синхронизации персонала между пользователями
-- Все пользователи видят всех сотрудников

-- Удаляем старую политику
DROP POLICY IF EXISTS "Users can view own staff" ON staff;

-- Создаем новую политику - все видят всех сотрудников
CREATE POLICY "Users can view all staff"
    ON staff FOR SELECT
    USING (true);

-- Остальные политики оставляем как есть (изменять/удалять может только создатель)
-- INSERT, UPDATE, DELETE остают��я с проверкой user_id

-- Включаем Realtime для таблицы staff
ALTER TABLE staff REPLICA IDENTITY FULL;

-- Добавляем таблицу в публикацию supabase_realtime (если еще не добавлена)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'staff'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE staff;
    END IF;
END
$$;
