-- ============================================
-- Таблицы для счетов и актов к договорам
-- ============================================

-- 1. Таблица счетов на оплату
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  
  -- Номер и дата
  number TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Суммы
  amount DECIMAL(12, 2) NOT NULL,
  vat_rate DECIMAL(5, 2) DEFAULT 0, -- Ставка НДС (0, 10, 20)
  vat_amount DECIMAL(12, 2) DEFAULT 0, -- Сумма НДС
  total_amount DECIMAL(12, 2) NOT NULL, -- Всего с НДС
  
  -- Статус
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  paid_date DATE, -- Дата оплаты
  
  -- Описание/назначение платежа
  description TEXT,
  
  -- Срок оплаты
  due_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_contract_id ON invoices (contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices (number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);

-- 2. Таблица актов выполненных работ
CREATE TABLE IF NOT EXISTS acts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  
  -- Связь со счетом (опционально)
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  
  -- Номер и дата
  number TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Период выполнения работ
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Суммы
  amount DECIMAL(12, 2) NOT NULL,
  vat_rate DECIMAL(5, 2) DEFAULT 0,
  vat_amount DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,
  
  -- Статус
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed', 'approved')),
  
  -- Примечания
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acts_contract_id ON acts (contract_id);
CREATE INDEX IF NOT EXISTS idx_acts_invoice_id ON acts (invoice_id);
CREATE INDEX IF NOT EXISTS idx_acts_number ON acts (number);
CREATE INDEX IF NOT EXISTS idx_acts_status ON acts (status);

-- 3. Таблица позиций акта (детализация работ)
CREATE TABLE IF NOT EXISTS act_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  act_id UUID NOT NULL REFERENCES acts(id) ON DELETE CASCADE,
  
  -- Описание работы/услуги
  name TEXT NOT NULL,
  description TEXT,
  
  -- Количество и цена
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'шт',
  price DECIMAL(12, 2) NOT NULL,
  total DECIMAL(12, 2) NOT NULL,
  
  order_index INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_act_items_act_id ON act_items (act_id);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE acts ENABLE ROW LEVEL SECURITY;
ALTER TABLE act_items ENABLE ROW LEVEL SECURITY;

-- Политики для invoices
DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
CREATE POLICY "Users can view own invoices" 
  ON invoices FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own invoices" ON invoices;
CREATE POLICY "Users can insert own invoices" 
  ON invoices FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own invoices" ON invoices;
CREATE POLICY "Users can update own invoices" 
  ON invoices FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own invoices" ON invoices;
CREATE POLICY "Users can delete own invoices" 
  ON invoices FOR DELETE USING (auth.uid() = user_id);

-- Политики для acts
DROP POLICY IF EXISTS "Users can view own acts" ON acts;
CREATE POLICY "Users can view own acts" 
  ON acts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own acts" ON acts;
CREATE POLICY "Users can insert own acts" 
  ON acts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own acts" ON acts;
CREATE POLICY "Users can update own acts" 
  ON acts FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own acts" ON acts;
CREATE POLICY "Users can delete own acts" 
  ON acts FOR DELETE USING (auth.uid() = user_id);

-- Политики для act_items
DROP POLICY IF EXISTS "Users can view own act items" ON act_items;
CREATE POLICY "Users can view own act items" 
  ON act_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM acts WHERE acts.id = act_items.act_id AND acts.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own act items" ON act_items;
CREATE POLICY "Users can insert own act items" 
  ON act_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM acts WHERE acts.id = act_items.act_id AND acts.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own act items" ON act_items;
CREATE POLICY "Users can update own act items" 
  ON act_items FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM acts WHERE acts.id = act_items.act_id AND acts.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own act items" ON act_items;
CREATE POLICY "Users can delete own act items" 
  ON act_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM acts WHERE acts.id = act_items.act_id AND acts.user_id = auth.uid()));

-- ============================================
-- Триггеры для обновления updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at 
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_acts_updated_at ON acts;
CREATE TRIGGER update_acts_updated_at 
  BEFORE UPDATE ON acts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Real-time подписки
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'invoices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'acts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE acts;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'act_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE act_items;
  END IF;
END $$;

-- ============================================
-- Функция для получения следующего номера счета
-- ============================================

CREATE OR REPLACE FUNCTION get_next_invoice_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(number, '^0*(\\d+)-.*', '\\1'), '')), '0')::INTEGER + 1
  INTO next_num
  FROM invoices
  WHERE EXTRACT(YEAR FROM date) = p_year;
  
  RETURN LPAD(next_num::TEXT, 3, '0') || '-' || p_year::TEXT;
END;
$$;

-- ============================================
-- Функция для получения следующего номера акта
-- ============================================

CREATE OR REPLACE FUNCTION get_next_act_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(number, '^0*(\\d+)-.*', '\\1'), '')), '0')::INTEGER + 1
  INTO next_num
  FROM acts
  WHERE EXTRACT(YEAR FROM date) = p_year;
  
  RETURN LPAD(next_num::TEXT, 3, '0') || '-' || p_year::TEXT || 'А';
END;
$$;

-- ============================================
-- Проверка создания таблиц
-- ============================================
SELECT 'Таблицы invoices, acts, act_items созданы успешно!' as status;
