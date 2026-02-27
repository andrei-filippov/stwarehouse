-- Добавление отслеживания статуса редактирования сметы

-- Колонки для отслеживания кто и когда редактирует смету
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS is_editing BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS editing_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS editing_since TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS editing_session_id TEXT; -- для идентификации сессии/вкладки

-- Индекс для быстрого поиска редактируемых смет
CREATE INDEX IF NOT EXISTS idx_estimates_is_editing ON estimates(is_editing);
CREATE INDEX IF NOT EXISTS idx_estimates_editing_by ON estimates(editing_by);

-- Функция для автоматической очистки устаревших блокировок (старше 10 минут)
CREATE OR REPLACE FUNCTION cleanup_stale_editing_locks()
RETURNS void AS $$
BEGIN
    UPDATE estimates 
    SET is_editing = FALSE, 
        editing_by = NULL, 
        editing_since = NULL,
        editing_session_id = NULL
    WHERE is_editing = TRUE 
      AND editing_since < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- Запускаем очистку каждые 5 минут (если есть pg_cron)
-- SELECT cron.schedule('cleanup-editing-locks', '*/5 * * * *', 'SELECT cleanup_stale_editing_locks()');
