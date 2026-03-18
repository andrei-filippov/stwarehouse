-- Таблица для учета оборудования в ремонте

CREATE TABLE IF NOT EXISTS equipment_repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES cable_categories(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES cable_inventory(id) ON DELETE SET NULL,
  equipment_name TEXT NOT NULL,
  length DECIMAL(10, 2),
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'in_repair' CHECK (status IN ('in_repair', 'repaired', 'written_off')),
  reason TEXT NOT NULL,
  repair_cost DECIMAL(10, 2),
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
  returned_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_equipment_repairs_company_id ON equipment_repairs(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_repairs_category_id ON equipment_repairs(category_id);
CREATE INDEX IF NOT EXISTS idx_equipment_repairs_status ON equipment_repairs(status);
CREATE INDEX IF NOT EXISTS idx_equipment_repairs_equipment_name ON equipment_repairs(equipment_name);

-- RLS
ALTER TABLE equipment_repairs ENABLE ROW LEVEL SECURITY;

-- Политики
CREATE POLICY "Company members can view repairs"
  ON equipment_repairs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = equipment_repairs.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can insert repairs"
  ON equipment_repairs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = equipment_repairs.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can update repairs"
  ON equipment_repairs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = equipment_repairs.company_id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Company members can delete repairs"
  ON equipment_repairs FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM company_members WHERE company_id = equipment_repairs.company_id AND user_id = auth.uid() AND status = 'active'
  ));

COMMENT ON TABLE equipment_repairs IS 'Учет оборудования в ремонте';
