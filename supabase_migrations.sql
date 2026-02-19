-- Миграция базы данных для складской системы

-- Таблица категорий
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица оборудования
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  unit TEXT DEFAULT 'шт',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица смет
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  venue TEXT,
  event_date DATE,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица позиций сметы
CREATE TABLE IF NOT EXISTS estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  equipment_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'шт',
  coefficient DECIMAL(5, 2) DEFAULT 1
);

-- Таблица шаблонов
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица позиций шаблона
CREATE TABLE IF NOT EXISTS template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  equipment_name TEXT NOT NULL,
  default_quantity INTEGER NOT NULL DEFAULT 1
);

-- Таблица правил чек-листов
CREATE TABLE IF NOT EXISTS checklist_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('category', 'equipment')),
  condition_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица элементов правил чек-листов
CREATE TABLE IF NOT EXISTS checklist_rule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES checklist_rules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'tool',
  is_required BOOLEAN DEFAULT true
);

-- Таблица чек-листов
CREATE TABLE IF NOT EXISTS checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица элементов чек-листа
CREATE TABLE IF NOT EXISTS checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'other',
  is_required BOOLEAN DEFAULT true,
  is_checked BOOLEAN DEFAULT false,
  source_rule_id UUID,
  notes TEXT
);

-- Таблица сотрудников
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Таблица задач/целей
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'other',
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  status TEXT DEFAULT 'pending',
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица профилей пользователей
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT DEFAULT 'warehouse',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Включаем RLS (Row Level Security)
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_rule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Политики доступа
CREATE POLICY "Users can view their own equipment" ON equipment
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own equipment" ON equipment
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own equipment" ON equipment
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own equipment" ON equipment
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own estimates" ON estimates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own estimates" ON estimates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own estimates" ON estimates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own estimates" ON estimates
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own estimate items" ON estimate_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid()));
CREATE POLICY "Users can insert their own estimate items" ON estimate_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid()));
CREATE POLICY "Users can delete their own estimate items" ON estimate_items
  FOR DELETE USING (EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid()));

CREATE POLICY "Users can view their own templates" ON templates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own templates" ON templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own templates" ON templates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own templates" ON templates
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own template items" ON template_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM templates WHERE templates.id = template_items.template_id AND templates.user_id = auth.uid()));
CREATE POLICY "Users can insert their own template items" ON template_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM templates WHERE templates.id = template_items.template_id AND templates.user_id = auth.uid()));
CREATE POLICY "Users can delete their own template items" ON template_items
  FOR DELETE USING (EXISTS (SELECT 1 FROM templates WHERE templates.id = template_items.template_id AND templates.user_id = auth.uid()));

CREATE POLICY "Users can view their own checklist rules" ON checklist_rules
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own checklist rules" ON checklist_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own checklist rules" ON checklist_rules
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own checklist rule items" ON checklist_rule_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));
CREATE POLICY "Users can insert their own checklist rule items" ON checklist_rule_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));
CREATE POLICY "Users can delete their own checklist rule items" ON checklist_rule_items
  FOR DELETE USING (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));

CREATE POLICY "Users can view their own checklists" ON checklists
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own checklists" ON checklists
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own checklists" ON checklists
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own checklists" ON checklists
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own checklist items" ON checklist_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));
CREATE POLICY "Users can update their own checklist items" ON checklist_items
  FOR UPDATE USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));
CREATE POLICY "Users can insert their own checklist items" ON checklist_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));
CREATE POLICY "Users can delete their own checklist items" ON checklist_items
  FOR DELETE USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));

CREATE POLICY "Users can view their own staff" ON staff
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own staff" ON staff
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own staff" ON staff
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own staff" ON staff
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own goals" ON goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own goals" ON goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own goals" ON goals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own goals" ON goals
  FOR DELETE USING (auth.uid() = user_id);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_equipment_user_id ON equipment(user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_template_items_template_id ON template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_rules_user_id ON checklist_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_rule_items_rule_id ON checklist_rule_items(rule_id);
CREATE INDEX IF NOT EXISTS idx_checklists_user_id ON checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_checklists_estimate_id ON checklists(estimate_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
