-- Включение Realtime для таблиц чек-листов

-- Проверяем и включаем realtime для таблицы checklists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'checklists'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE checklists;
    RAISE NOTICE 'Added checklists to realtime publication';
  ELSE
    RAISE NOTICE 'checklists already in realtime publication';
  END IF;
END $$;

-- Проверяем и включаем realtime для таблицы checklist_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'checklist_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE checklist_items;
    RAISE NOTICE 'Added checklist_items to realtime publication';
  ELSE
    RAISE NOTICE 'checklist_items already in realtime publication';
  END IF;
END $$;

-- Проверяем и включаем realtime для таблицы checklist_rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'checklist_rules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE checklist_rules;
    RAISE NOTICE 'Added checklist_rules to realtime publication';
  ELSE
    RAISE NOTICE 'checklist_rules already in realtime publication';
  END IF;
END $$;

-- Проверяем и включаем realtime для таблицы checklist_rule_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'checklist_rule_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE checklist_rule_items;
    RAISE NOTICE 'Added checklist_rule_items to realtime publication';
  ELSE
    RAISE NOTICE 'checklist_rule_items already in realtime publication';
  END IF;
END $$;

-- Проверяем результат
SELECT tablename, pubname 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('checklists', 'checklist_items', 'checklist_rules', 'checklist_rule_items');
