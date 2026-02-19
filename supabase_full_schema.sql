-- ============================================
-- ПОЛНАЯ СХЕМА БАЗЫ ДАННЫХ ДЛЯ СКЛАДСКОГО ПРИЛОЖЕНИЯ
-- ============================================

-- ============================================
-- 1. ТАБЛИЦА КАТЕГОРИЙ
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. ТАБЛИЦА ОБОРУДОВАНИЯ
-- ============================================
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  unit TEXT DEFAULT 'шт',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. ТАБЛИЦА СМЕТ
-- ============================================
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_name TEXT NOT NULL,
  venue TEXT,
  event_date DATE,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. ТАБЛИЦА ПОЗИЦИЙ СМЕТЫ
-- ============================================
CREATE TABLE IF NOT EXISTS estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE NOT NULL,
  equipment_id UUID,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'шт',
  coefficient NUMERIC(5,2) DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. ТАБЛИЦА ШАБЛОНОВ
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. ТАБЛИЦА ПОЗИЦИЙ ШАБЛОНА
-- ============================================
CREATE TABLE IF NOT EXISTS template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES templates(id) ON DELETE CASCADE NOT NULL,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  equipment_name TEXT NOT NULL,
  default_quantity INTEGER NOT NULL DEFAULT 1
);

-- ============================================
-- 7. ТАБЛИЦА СОТРУДНИКОВ
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
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

-- ============================================
-- 8. ТАБЛИЦА ЗАДАЧ/ЦЕЛЕЙ
-- ============================================
CREATE TABLE IF NOT EXISTS goals (
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

-- ============================================
-- 9. ТАБЛИЦА ПРАВИЛ ЧЕК-ЛИСТОВ
-- ============================================
CREATE TABLE IF NOT EXISTS checklist_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('category', 'equipment')),
  condition_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 10. ТАБЛИЦА ЭЛЕМЕНТОВ ПРАВИЛ
-- ============================================
CREATE TABLE IF NOT EXISTS checklist_rule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES checklist_rules(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'tool',
  is_required BOOLEAN DEFAULT true
);

-- ============================================
-- 11. ТАБЛИЦА ЧЕК-ЛИСТОВ
-- ============================================
CREATE TABLE IF NOT EXISTS checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_name TEXT NOT NULL,
  event_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 12. ТАБЛИЦА ЭЛЕМЕНТОВ ЧЕК-ЛИСТА
-- ============================================
CREATE TABLE IF NOT EXISTS checklist_items (
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

-- ============================================
-- 13. ТАБЛИЦА ПРОФИЛЕЙ
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT DEFAULT 'warehouse',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ВКЛЮЧЕНИЕ RLS ДЛЯ ВСЕХ ТАБЛИЦ
-- ============================================
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_rule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS ПОЛИТИКИ ДЛЯ EQUIPMENT
-- ============================================
DROP POLICY IF EXISTS "equipment_select" ON equipment;
DROP POLICY IF EXISTS "equipment_insert" ON equipment;
DROP POLICY IF EXISTS "equipment_update" ON equipment;
DROP POLICY IF EXISTS "equipment_delete" ON equipment;

CREATE POLICY "equipment_select" ON equipment FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "equipment_insert" ON equipment FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "equipment_update" ON equipment FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "equipment_delete" ON equipment FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS ПОЛИТИКИ ДЛЯ ESTIMATES
-- ============================================
DROP POLICY IF EXISTS "estimates_select" ON estimates;
DROP POLICY IF EXISTS "estimates_insert" ON estimates;
DROP POLICY IF EXISTS "estimates_update" ON estimates;
DROP POLICY IF EXISTS "estimates_delete" ON estimates;

CREATE POLICY "estimates_select" ON estimates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "estimates_insert" ON estimates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "estimates_update" ON estimates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "estimates_delete" ON estimates FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS ПОЛИТИКИ ДЛЯ ESTIMATE_ITEMS
-- ============================================
DROP POLICY IF EXISTS "estimate_items_select" ON estimate_items;
DROP POLICY IF EXISTS "estimate_items_insert" ON estimate_items;
DROP POLICY IF EXISTS "estimate_items_delete" ON estimate_items;

CREATE POLICY "estimate_items_select" ON estimate_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid()));

CREATE POLICY "estimate_items_insert" ON estimate_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid()));

CREATE POLICY "estimate_items_delete" ON estimate_items
  FOR DELETE USING (EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid()));

-- ============================================
-- RLS ПОЛИТИКИ ДЛЯ TEMPLATES
-- ============================================
DROP POLICY IF EXISTS "templates_select" ON templates;
DROP POLICY IF EXISTS "templates_insert" ON templates;
DROP POLICY IF EXISTS "templates_update" ON templates;
DROP POLICY IF EXISTS "templates_delete" ON templates;

CREATE POLICY "templates_select" ON templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "templates_insert" ON templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "templates_update" ON templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "templates_delete" ON templates FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS ПОЛИТИКИ ДЛЯ TEMPLATE_ITEMS
-- ============================================
DROP POLICY IF EXISTS "template_items_select" ON template_items;
DROP POLICY IF EXISTS "template_items_insert" ON template_items;
DROP POLICY IF EXISTS "template_items_delete" ON template_items;

CREATE POLICY "template_items_select" ON template_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM templates WHERE templates.id = template_items.template_id AND templates.user_id = auth.uid()));

CREATE POLICY "template_items_insert" ON template_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM templates WHERE templates.id = template_items.template_id AND templates.user_id = auth.uid()));

CREATE POLICY "template_items_delete" ON template_items
  FOR DELETE USING (EXISTS (SELECT 1 FROM templates WHERE templates.id = template_items.template_id AND templates.user_id = auth.uid()));

-- ============================================
-- RLS ПОЛИТИКИ ДЛЯ STAFF
-- ============================================
DROP POLICY IF EXISTS "staff_select" ON staff;
DROP POLICY IF EXISTS "staff_insert" ON staff;
DROP POLICY IF EXISTS "staff_update" ON staff;
DROP POLICY IF EXISTS "staff_delete" ON staff;

CREATE POLICY "staff_select" ON staff FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "staff_insert" ON staff FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff_update" ON staff FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "staff_delete" ON staff FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS ПОЛИТИКИ ДЛЯ GOALS
-- ============================================
DROP POLICY IF EXISTS "goals_select" ON goals;
DROP POLICY IF EXISTS "goals_insert" ON goals;
DROP POLICY IF EXISTS "goals_update" ON goals;
DROP POLICY IF EXISTS "goals_delete" ON goals;

CREATE POLICY "goals_select" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "goals_insert" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_update" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "goals_delete" ON goals FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS ПОЛИТИКИ ДЛЯ CHECKLIST_RULES
-- ============================================
DROP POLICY IF EXISTS "checklist_rules_select" ON checklist_rules;
DROP POLICY IF EXISTS "checklist_rules_insert" ON checklist_rules;
DROP POLICY IF EXISTS "checklist_rules_delete" ON checklist_rules;

CREATE POLICY "checklist_rules_select" ON checklist_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "checklist_rules_insert" ON checklist_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "checklist_rules_delete" ON checklist_rules FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS ПОЛИТИКИ ДЛЯ CHECKLIST_RULE_ITEMS
-- ============================================
DROP POLICY IF EXISTS "checklist_rule_items_select" ON checklist_rule_items;
DROP POLICY IF EXISTS "checklist_rule_items_insert" ON checklist_rule_items;
DROP POLICY IF EXISTS "checklist_rule_items_delete" ON checklist_rule_items;

CREATE POLICY "checklist_rule_items_select" ON checklist_rule_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));

CREATE POLICY "checklist_rule_items_insert" ON checklist_rule_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));

CREATE POLICY "checklist_rule_items_delete" ON checklist_rule_items
  FOR DELETE USING (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));

-- ============================================
-- RLS ПОЛИТИКИ ДЛЯ CHECKLISTS
-- ============================================
DROP POLICY IF EXISTS "checklists_select" ON checklists;
DROP POLICY IF EXISTS "checklists_insert" ON checklists;
DROP POLICY IF EXISTS "checklists_update" ON checklists;
DROP POLICY IF EXISTS "checklists_delete" ON checklists;

CREATE POLICY "checklists_select" ON checklists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "checklists_insert" ON checklists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "checklists_update" ON checklists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "checklists_delete" ON checklists FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS ПОЛИТИКИ ДЛЯ CHECKLIST_ITEMS
-- ============================================
DROP POLICY IF EXISTS "checklist_items_select" ON checklist_items;
DROP POLICY IF EXISTS "checklist_items_insert" ON checklist_items;
DROP POLICY IF EXISTS "checklist_items_update" ON checklist_items;
DROP POLICY IF EXISTS "checklist_items_delete" ON checklist_items;

CREATE POLICY "checklist_items_select" ON checklist_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));

CREATE POLICY "checklist_items_insert" ON checklist_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));

CREATE POLICY "checklist_items_update" ON checklist_items
  FOR UPDATE USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));

CREATE POLICY "checklist_items_delete" ON checklist_items
  FOR DELETE USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));

-- ============================================
-- RLS ПОЛИТИКИ ДЛЯ PROFILES
-- ============================================
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ============================================
CREATE INDEX IF NOT EXISTS idx_equipment_user_id ON equipment(user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_template_items_template_id ON template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_assigned_to ON goals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_checklist_rules_user_id ON checklist_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_rule_items_rule_id ON checklist_rule_items(rule_id);
CREATE INDEX IF NOT EXISTS idx_checklists_user_id ON checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_checklists_estimate_id ON checklists(estimate_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);
