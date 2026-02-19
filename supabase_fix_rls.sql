-- Исправление RLS политик для estimate_items

-- Удаляем старые политики
DROP POLICY IF EXISTS "Users can view their own estimate items" ON estimate_items;
DROP POLICY IF EXISTS "Users can insert their own estimate items" ON estimate_items;
DROP POLICY IF EXISTS "Users can delete their own estimate items" ON estimate_items;

-- Создаем новые корректные политики
-- Разрешаем все операции если смета принадлежит пользователю

CREATE POLICY "Users can view their own estimate items" ON estimate_items
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM estimates 
      WHERE estimates.id = estimate_items.estimate_id 
      AND estimates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own estimate items" ON estimate_items
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimates 
      WHERE estimates.id = estimate_items.estimate_id 
      AND estimates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own estimate items" ON estimate_items
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM estimates 
      WHERE estimates.id = estimate_items.estimate_id 
      AND estimates.user_id = auth.uid()
    )
  );

-- Если политики не работают, можно временно отключить RLS (не рекомендуется для продакшена)
-- ALTER TABLE estimate_items DISABLE ROW LEVEL SECURITY;

-- Или создать политику которая разрешает всё для аутентифицированных пользователей
-- DROP POLICY IF EXISTS "Allow all for authenticated" ON estimate_items;
-- CREATE POLICY "Allow all for authenticated" ON estimate_items
--   FOR ALL 
--   TO authenticated
--   USING (true)
--   WITH CHECK (true);
