-- Фикс RLS политик для goals (разрешаем UPDATE)
DROP POLICY IF EXISTS "Users can update own goals" ON goals;

CREATE POLICY "Users can update own goals"
    ON goals FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Проверяем структуру таблицы
COMMENT ON COLUMN goals.due_date IS 'Дата выполнения в формате YYYY-MM-DD';
