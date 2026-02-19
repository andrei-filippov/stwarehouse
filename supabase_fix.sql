-- Исправление структуры базы данных

-- Проверяем и исправляем таблицу staff
ALTER TABLE IF EXISTS staff 
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN full_name SET NOT NULL,
  ALTER COLUMN position SET NOT NULL;

-- Добавляем отсутствующие колонки в staff если их нет
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff' AND column_name = 'phone') THEN
    ALTER TABLE staff ADD COLUMN phone TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff' AND column_name = 'email') THEN
    ALTER TABLE staff ADD COLUMN email TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff' AND column_name = 'birth_date') THEN
    ALTER TABLE staff ADD COLUMN birth_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff' AND column_name = 'passport_series') THEN
    ALTER TABLE staff ADD COLUMN passport_series TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff' AND column_name = 'passport_number') THEN
    ALTER TABLE staff ADD COLUMN passport_number TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff' AND column_name = 'passport_issued_by') THEN
    ALTER TABLE staff ADD COLUMN passport_issued_by TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff' AND column_name = 'passport_issue_date') THEN
    ALTER TABLE staff ADD COLUMN passport_issue_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff' AND column_name = 'notes') THEN
    ALTER TABLE staff ADD COLUMN notes TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff' AND column_name = 'is_active') THEN
    ALTER TABLE staff ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Проверяем и исправляем таблицу goals
ALTER TABLE IF EXISTS goals 
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN title SET NOT NULL;

-- Добавляем отсутствующие колонки в goals если их нет
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'goals' AND column_name = 'description') THEN
    ALTER TABLE goals ADD COLUMN description TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'goals' AND column_name = 'category') THEN
    ALTER TABLE goals ADD COLUMN category TEXT DEFAULT 'other';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'goals' AND column_name = 'priority') THEN
    ALTER TABLE goals ADD COLUMN priority TEXT DEFAULT 'medium';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'goals' AND column_name = 'status') THEN
    ALTER TABLE goals ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'goals' AND column_name = 'due_date') THEN
    ALTER TABLE goals ADD COLUMN due_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'goals' AND column_name = 'assigned_to') THEN
    ALTER TABLE goals ADD COLUMN assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'goals' AND column_name = 'completed_at') THEN
    ALTER TABLE goals ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Пересоздаем RLS политики для staff
DROP POLICY IF EXISTS "Users can view their own staff" ON staff;
DROP POLICY IF EXISTS "Users can insert their own staff" ON staff;
DROP POLICY IF EXISTS "Users can update their own staff" ON staff;
DROP POLICY IF EXISTS "Users can delete their own staff" ON staff;

CREATE POLICY "Users can view their own staff" ON staff
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own staff" ON staff
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own staff" ON staff
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own staff" ON staff
  FOR DELETE USING (auth.uid() = user_id);

-- Пересоздаем RLS политики для goals
DROP POLICY IF EXISTS "Users can view their own goals" ON goals;
DROP POLICY IF EXISTS "Users can insert their own goals" ON goals;
DROP POLICY IF EXISTS "Users can update their own goals" ON goals;
DROP POLICY IF EXISTS "Users can delete their own goals" ON goals;

CREATE POLICY "Users can view their own goals" ON goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own goals" ON goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own goals" ON goals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own goals" ON goals
  FOR DELETE USING (auth.uid() = user_id);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_assigned_to ON goals(assigned_to);
