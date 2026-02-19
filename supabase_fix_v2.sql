-- Полное пересоздание таблиц staff и goals с правильной структурой

-- Удаляем старые таблицы если они есть (с сохранением данных через временную таблицу)
DROP TABLE IF EXISTS checklist_rule_items CASCADE;
DROP TABLE IF EXISTS checklist_rules CASCADE;
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS checklists CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS staff CASCADE;

-- Создание таблицы staff
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  birth_date DATE,
  passport_series TEXT,
  passport_number TEXT,
  passport_issued_by TEXT,
  passport_issue_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание таблицы goals (задачи)
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'other',
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  due_date DATE,
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание таблицы checklist_rules
CREATE TABLE checklist_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('category', 'equipment')),
  condition_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание таблицы checklist_rule_items
CREATE TABLE checklist_rule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES checklist_rules(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'tool',
  is_required BOOLEAN DEFAULT true
);

-- Создание таблицы checklists
CREATE TABLE checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_name TEXT NOT NULL,
  event_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание таблицы checklist_items
CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'other',
  is_required BOOLEAN DEFAULT true,
  is_checked BOOLEAN DEFAULT false,
  source_rule_id UUID,
  notes TEXT
);

-- Включаем RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_rule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- Политики для staff
CREATE POLICY "Users can view their own staff" ON staff
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own staff" ON staff
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own staff" ON staff
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own staff" ON staff
  FOR DELETE USING (auth.uid() = user_id);

-- Политики для goals
CREATE POLICY "Users can view their own goals" ON goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own goals" ON goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own goals" ON goals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own goals" ON goals
  FOR DELETE USING (auth.uid() = user_id);

-- Политики для checklist_rules
CREATE POLICY "Users can view their own checklist rules" ON checklist_rules
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own checklist rules" ON checklist_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own checklist rules" ON checklist_rules
  FOR DELETE USING (auth.uid() = user_id);

-- Политики для checklist_rule_items
CREATE POLICY "Users can view their own checklist rule items" ON checklist_rule_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));
CREATE POLICY "Users can insert their own checklist rule items" ON checklist_rule_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));
CREATE POLICY "Users can delete their own checklist rule items" ON checklist_rule_items
  FOR DELETE USING (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));

-- Политики для checklists
CREATE POLICY "Users can view their own checklists" ON checklists
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own checklists" ON checklists
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own checklists" ON checklists
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own checklists" ON checklists
  FOR DELETE USING (auth.uid() = user_id);

-- Политики для checklist_items
CREATE POLICY "Users can view their own checklist items" ON checklist_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));
CREATE POLICY "Users can update their own checklist items" ON checklist_items
  FOR UPDATE USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));
CREATE POLICY "Users can insert their own checklist items" ON checklist_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));
CREATE POLICY "Users can delete their own checklist items" ON checklist_items
  FOR DELETE USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));

-- Индексы
CREATE INDEX idx_staff_user_id ON staff(user_id);
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_assigned_to ON goals(assigned_to);
CREATE INDEX idx_checklist_rules_user_id ON checklist_rules(user_id);
CREATE INDEX idx_checklist_rule_items_rule_id ON checklist_rule_items(rule_id);
CREATE INDEX idx_checklists_user_id ON checklists(user_id);
CREATE INDEX idx_checklists_estimate_id ON checklists(estimate_id);
CREATE INDEX idx_checklist_items_checklist_id ON checklist_items(checklist_id);
