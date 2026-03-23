-- Включение realtime для таблиц правил чек-листов
-- Идемпотентный скрипт (можно запускать несколько раз)

-- Функция для безопасного добавления таблицы в публикацию
CREATE OR REPLACE FUNCTION add_table_to_realtime(table_name text)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = table_name
  ) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
    RAISE NOTICE 'Added table % to supabase_realtime', table_name;
  ELSE
    RAISE NOTICE 'Table % is already in supabase_realtime', table_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Добавляем таблицы (без ошибок если уже добавлены)
SELECT add_table_to_realtime('checklist_rules');
SELECT add_table_to_realtime('checklist_rule_items');

-- Удаляем функцию (не нужна больше)
DROP FUNCTION add_table_to_realtime(text);

-- Проверка: показать все таблицы в realtime publication
SELECT schemaname, tablename, pubname
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
