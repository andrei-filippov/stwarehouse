-- Добавляем индекс для realtime подписки на estimate_items
CREATE INDEX IF NOT EXISTS idx_estimate_items_company_id ON estimate_items(company_id);

-- Включаем realtime для estimate_items (если ещё не включен)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'estimate_items'
  ) THEN
    -- Таблица уже в публикации
    NULL;
  ELSE
    -- Добавляем таблицу в публикацию realtime
    ALTER PUBLICATION supabase_realtime ADD TABLE estimate_items;
  END IF;
END $$;
