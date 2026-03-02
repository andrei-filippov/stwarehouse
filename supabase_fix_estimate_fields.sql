-- Фикс полей для смет и оборудования
-- Выполнить в SQL Editor Supabase

-- ============================================
-- 1. Добавляем недостающие поля в estimates
-- ============================================
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS event_start_date DATE,
ADD COLUMN IF NOT EXISTS event_end_date DATE,
ADD COLUMN IF NOT EXISTS category_order TEXT[] DEFAULT '{}'::TEXT[];

-- ============================================
-- 2. Добавляем is_active в equipment (если нужно)
-- ============================================
ALTER TABLE equipment 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ============================================
-- 3. Обновляем RLS policies для equipment (разрешаем insert)
-- ============================================
DROP POLICY IF EXISTS "Users can insert their own equipment" ON equipment;
CREATE POLICY "Users can insert their own equipment" ON equipment
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 4. Проверяем структуру
-- ============================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'estimates' 
ORDER BY ordinal_position;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'equipment' 
ORDER BY ordinal_position;
