-- ============================================
-- ИСПРАВЛЕНИЕ СИНХРОНИЗАЦИИ ЗАКАЗЧИКОВ МЕЖДУ ПОЛЬЗОВАТЕЛЯМИ
-- Выполните этот SQL в Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Удаляем старые политики customers (ограниченные по user_id)
DROP POLICY IF EXISTS "Users can view own customers" ON customers;
DROP POLICY IF EXISTS "Users can insert own customers" ON customers;
DROP POLICY IF EXISTS "Users can update own customers" ON customers;
DROP POLICY IF EXISTS "Users can delete own customers" ON customers;

-- 2. Создаём новые политики для совместного доступа
-- Все авторизованные пользователи могут видеть всех заказчиков
CREATE POLICY "Authenticated users can view all customers" 
  ON customers 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Все авторизованные пользователи могут добавлять заказчиков
CREATE POLICY "Authenticated users can insert customers" 
  ON customers 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Все авторизованные пользователи могут обновлять заказчиков
CREATE POLICY "Authenticated users can update customers" 
  ON customers 
  FOR UPDATE 
  TO authenticated 
  USING (true);

-- Только администраторы могут удалять заказчиков (опционально)
-- Или используйте: USING (true) чтобы разрешить всем
CREATE POLICY "Authenticated users can delete customers" 
  ON customers 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- 3. Включаем real-time для таблицы customers (если ещё не включено)
-- Проверяем, есть ли таблица в публикации realtime
DO $$
BEGIN
  -- Удаляем из публикации, если уже есть (чтобы избежать дубликатов)
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'customers'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE customers;
  END IF;
  
  -- Добавляем таблицу в публикацию realtime
  ALTER PUBLICATION supabase_realtime ADD TABLE customers;
END $$;

-- 4. Проверка настроек
SELECT 
  tablename,
  pubname
FROM pg_publication_tables
WHERE tablename = 'customers';
