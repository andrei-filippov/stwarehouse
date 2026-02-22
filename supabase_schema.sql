-- Полная схема базы данных Supabase для СкладОборуд
-- Выполните этот SQL в SQL Editor Supabase Dashboard

-- ============================================
-- 1. Таблица профилей пользователей
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('admin', 'manager', 'warehouse', 'accountant')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. Таблица категорий оборудования
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. Таблица оборудования
-- ============================================
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'шт',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. Таблица заказчиков
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'company' CHECK (type IN ('company', 'ip', 'individual')),
  inn TEXT,
  kpp TEXT,
  ogrn TEXT,
  legal_address TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  bank_name TEXT,
  bank_bik TEXT,
  bank_account TEXT,
  bank_corr_account TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. Таблица смет
-- ============================================
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  venue TEXT,
  event_date DATE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  creator_name TEXT,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. Таблица позиций смет
-- ============================================
CREATE TABLE IF NOT EXISTS estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'шт',
  coefficient DECIMAL(5, 2) NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. Таблица шаблонов
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. Таблица позиций шаблонов
-- ============================================
CREATE TABLE IF NOT EXISTS template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  equipment_name TEXT NOT NULL,
  default_quantity INTEGER NOT NULL DEFAULT 1
);

-- ============================================
-- 9. Таблица персонала
-- ============================================
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
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 10. Таблица задач (goals)
-- ============================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'other',
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date DATE,
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 11. Таблица правил чек-листов
-- ============================================
CREATE TABLE IF NOT EXISTS checklist_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  condition_type TEXT NOT NULL DEFAULT 'category' CHECK (condition_type IN ('category', 'equipment')),
  condition_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 12. Таблица позиций правил чек-листов
-- ============================================
CREATE TABLE IF NOT EXISTS checklist_rule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES checklist_rules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'other',
  is_required BOOLEAN NOT NULL DEFAULT true
);

-- ============================================
-- 13. Таблица чек-листов
-- ============================================
CREATE TABLE IF NOT EXISTS checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 14. Таблица позиций чек-листов
-- ============================================
CREATE TABLE IF NOT EXISTS checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'other',
  is_required BOOLEAN NOT NULL DEFAULT true,
  is_checked BOOLEAN NOT NULL DEFAULT false,
  source_rule_id UUID REFERENCES checklist_rules(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- RLS (Row Level Security) политики
-- ============================================

-- Включить RLS для всех таблиц
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
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

-- Политики для profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Политики для categories (доступно всем авторизованным)
CREATE POLICY "Authenticated users can view categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert categories" ON categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete categories" ON categories FOR DELETE TO authenticated USING (true);

-- Политики для equipment
CREATE POLICY "Users can view own equipment" ON equipment FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own equipment" ON equipment FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own equipment" ON equipment FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own equipment" ON equipment FOR DELETE USING (auth.uid() = user_id);

-- Политики для customers
CREATE POLICY "Users can view own customers" ON customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customers" ON customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own customers" ON customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own customers" ON customers FOR DELETE USING (auth.uid() = user_id);

-- Политики для estimates
CREATE POLICY "Users can view own estimates" ON estimates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own estimates" ON estimates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own estimates" ON estimates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own estimates" ON estimates FOR DELETE USING (auth.uid() = user_id);

-- Политики для estimate_items
CREATE POLICY "Users can view own estimate items" ON estimate_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid()));
CREATE POLICY "Users can insert own estimate items" ON estimate_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid()));
CREATE POLICY "Users can delete own estimate items" ON estimate_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid()));

-- Политики для templates
CREATE POLICY "Users can view own templates" ON templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own templates" ON templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON templates FOR DELETE USING (auth.uid() = user_id);

-- Политики для template_items
CREATE POLICY "Users can view own template items" ON template_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM templates WHERE templates.id = template_items.template_id AND templates.user_id = auth.uid()));
CREATE POLICY "Users can insert own template items" ON template_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM templates WHERE templates.id = template_items.template_id AND templates.user_id = auth.uid()));
CREATE POLICY "Users can delete own template items" ON template_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM templates WHERE templates.id = template_items.template_id AND templates.user_id = auth.uid()));

-- Политики для staff
CREATE POLICY "Users can view own staff" ON staff FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own staff" ON staff FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own staff" ON staff FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own staff" ON staff FOR DELETE USING (auth.uid() = user_id);

-- Политики для goals
CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id);

-- Политики для checklist_rules
CREATE POLICY "Users can view own checklist rules" ON checklist_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checklist rules" ON checklist_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checklist rules" ON checklist_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own checklist rules" ON checklist_rules FOR DELETE USING (auth.uid() = user_id);

-- Политики для checklist_rule_items
CREATE POLICY "Users can view own checklist rule items" ON checklist_rule_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));
CREATE POLICY "Users can insert own checklist rule items" ON checklist_rule_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));
CREATE POLICY "Users can delete own checklist rule items" ON checklist_rule_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM checklist_rules WHERE checklist_rules.id = checklist_rule_items.rule_id AND checklist_rules.user_id = auth.uid()));

-- Политики для checklists
CREATE POLICY "Users can view own checklists" ON checklists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checklists" ON checklists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checklists" ON checklists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own checklists" ON checklists FOR DELETE USING (auth.uid() = user_id);

-- Политики для checklist_items
CREATE POLICY "Users can view own checklist items" ON checklist_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));
CREATE POLICY "Users can insert own checklist items" ON checklist_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));
CREATE POLICY "Users can update own checklist items" ON checklist_items FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));
CREATE POLICY "Users can delete own checklist items" ON checklist_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM checklists WHERE checklists.id = checklist_items.checklist_id AND checklists.user_id = auth.uid()));

-- ============================================
-- Функция для автоматического обновления updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для обновления updated_at
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_checklists_updated_at BEFORE UPDATE ON checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Начальные данные
-- ============================================
INSERT INTO categories (name) VALUES
  ('Звук'),
  ('Свет'),
  ('Видео'),
  ('Сцена'),
  ('Кабели'),
  ('Аксессуары')
ON CONFLICT (name) DO NOTHING;
