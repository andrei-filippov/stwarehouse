-- Создание таблиц для кабельного учёта (если не существуют)

-- Таблица категорий кабелей
CREATE TABLE IF NOT EXISTS cable_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица инвентаря кабелей
CREATE TABLE IF NOT EXISTS cable_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES cable_categories(id) ON DELETE CASCADE,
  length DECIMAL(10, 2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица движений кабелей
CREATE TABLE IF NOT EXISTS cable_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES cable_categories(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES cable_inventory(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('issue', 'return', 'write_off')),
  length DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  issued_to TEXT NOT NULL,
  contact TEXT,
  issued_by UUID REFERENCES auth.users(id),
  returned_at TIMESTAMP WITH TIME ZONE,
  returned_quantity INTEGER DEFAULT 0,
  notes TEXT,
  is_returned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_cable_categories_company_id ON cable_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_cable_inventory_company_id ON cable_inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_cable_inventory_category_id ON cable_inventory(category_id);
CREATE INDEX IF NOT EXISTS idx_cable_movements_company_id ON cable_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_cable_movements_category_id ON cable_movements(category_id);

-- RLS
ALTER TABLE cable_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cable_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE cable_movements ENABLE ROW LEVEL SECURITY;

-- Политики для cable_categories
CREATE POLICY "Company members can view cable categories"
  ON cable_categories FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = cable_categories.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can insert cable categories"
  ON cable_categories FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = cable_categories.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can update cable categories"
  ON cable_categories FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = cable_categories.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can delete cable categories"
  ON cable_categories FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = cable_categories.company_id AND user_id = auth.uid() AND status = 'active'
  ));

-- Политики для cable_inventory
CREATE POLICY "Company members can view cable inventory"
  ON cable_inventory FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = cable_inventory.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can insert cable inventory"
  ON cable_inventory FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = cable_inventory.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can update cable inventory"
  ON cable_inventory FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = cable_inventory.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can delete cable inventory"
  ON cable_inventory FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = cable_inventory.company_id AND user_id = auth.uid() AND status = 'active'
  ));

-- Политики для cable_movements
CREATE POLICY "Company members can view cable movements"
  ON cable_movements FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = cable_movements.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can insert cable movements"
  ON cable_movements FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = cable_movements.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can update cable movements"
  ON cable_movements FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = cable_movements.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can delete cable movements"
  ON cable_movements FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = cable_movements.company_id AND user_id = auth.uid() AND status = 'active'
  ));

SELECT 'Таблицы для кабельного учёта созданы' as status;
