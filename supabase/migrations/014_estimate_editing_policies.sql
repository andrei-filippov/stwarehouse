-- Политики RLS для полей редактирования смет

-- Разрешаем всем авторизованным пользователям обновлять статус редактирования
-- Это нужно для realtime блокировок

DROP POLICY IF EXISTS "Users can update editing status" ON estimates;
CREATE POLICY "Users can update editing status"
    ON estimates FOR UPDATE
    USING (auth.uid() = user_id OR is_editing = false OR editing_by = auth.uid())
    WITH CHECK (true);

-- Альтернативно, если нужно разрешить всем:
-- CREATE POLICY "Users can manage editing status"
--     ON estimates FOR ALL
--     USING (true)
--     WITH CHECK (true);

-- Добавляем таблицу в realtime публикацию если еще не добавлена
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'estimates'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE estimates;
    END IF;
END
$$;

-- Устанавливаем replica identity для полного отслеживания изменений
ALTER TABLE estimates REPLICA IDENTITY FULL;
