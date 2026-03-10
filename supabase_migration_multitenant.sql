-- ============================================
-- Миграция на мультитенантность (multi-tenant)
-- ============================================
-- Выполнить в Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Создаём таблицу компаний
-- ============================================

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  inn TEXT,
  kpp TEXT,
  ogrn TEXT,
  legal_address TEXT,
  actual_address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  
  -- Банковские реквизиты
  bank_name TEXT,
  bank_bik TEXT,
  bank_account TEXT,
  bank_corr_account TEXT,
  
  -- Настройки
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  
  -- Тариф и биллинг
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro', 'enterprise')),
  plan_expires_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. Таблица членов компании (сотрудники)
-- ============================================

CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Роль в компании
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('owner', 'admin', 'manager', 'accountant', 'viewer')),
  
  -- Должность
  position TEXT,
  
  -- Приглашение
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Статус
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'removed')),
  
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(company_id, user_id)
);

-- ============================================
-- 3. Добавляем company_id во все существующие таблицы
-- ============================================

-- Оборудование
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Категории
ALTER TABLE categories ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Сметы
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE estimate_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Шаблоны
ALTER TABLE templates ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE template_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Клиенты
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Сотрудники
ALTER TABLE staff ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Договоры
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE contract_estimates ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Счета и акты
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE acts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE act_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Чек-листы (если существуют)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'checklist_rules') THEN
    ALTER TABLE checklist_rules ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'checklists') THEN
    ALTER TABLE checklists ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
  END IF;
END $$;

-- Кабели (если существуют)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cable_categories') THEN
    ALTER TABLE cable_categories ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cable_inventory') THEN
    ALTER TABLE cable_inventory ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
  END IF;
END $$;

-- Расходы
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Цели/задачи
ALTER TABLE goals ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- ============================================
-- 4. Отключаем триггеры аудита на время миграции
-- ============================================

-- Отключаем триггеры аудита (если существуют)
DO $$
BEGIN
  -- Проверяем и отключаем триггеры
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'equipment_audit_trigger') THEN
    ALTER TABLE equipment DISABLE TRIGGER equipment_audit_trigger;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'estimate_audit_trigger') THEN
    ALTER TABLE estimates DISABLE TRIGGER estimate_audit_trigger;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'customer_audit_trigger') THEN
    ALTER TABLE customers DISABLE TRIGGER customer_audit_trigger;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'staff_audit_trigger') THEN
    ALTER TABLE staff DISABLE TRIGGER staff_audit_trigger;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'contract_audit_trigger') THEN
    ALTER TABLE contracts DISABLE TRIGGER contract_audit_trigger;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'contract_template_audit_trigger') THEN
    ALTER TABLE contract_templates DISABLE TRIGGER contract_template_audit_trigger;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'estimate_item_audit_trigger') THEN
    ALTER TABLE estimate_items DISABLE TRIGGER estimate_item_audit_trigger;
  END IF;
END $$;

-- ============================================
-- 5. Миграция существующих данных
-- ============================================

DO $$
DECLARE
  user_record RECORD;
  new_company_id UUID;
  user_email TEXT;
  user_name TEXT;
BEGIN
  -- Для каждого уникального user_id создаём компанию
  FOR user_record IN 
    SELECT DISTINCT user_id 
    FROM estimates 
    WHERE user_id IS NOT NULL
    UNION
    SELECT DISTINCT user_id 
    FROM contracts 
    WHERE user_id IS NOT NULL
    UNION
    SELECT DISTINCT user_id 
    FROM equipment 
    WHERE user_id IS NOT NULL
  LOOP
    -- Получаем данные пользователя
    SELECT email, raw_user_meta_data->>'name' 
    INTO user_email, user_name
    FROM auth.users 
    WHERE id = user_record.user_id;
    
    -- Пропускаем если пользователь не найден
    IF user_email IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Создаём компанию
    INSERT INTO companies (
      name, 
      email,
      plan
    ) VALUES (
      COALESCE(user_name, 'Компания ' || split_part(user_email, '@', 1)),
      user_email,
      'free'
    )
    RETURNING id INTO new_company_id;
    
    -- Добавляем пользователя как владельца
    INSERT INTO company_members (
      company_id, 
      user_id, 
      role,
      status
    ) VALUES (
      new_company_id, 
      user_record.user_id, 
      'owner',
      'active'
    );
    
    -- Обновляем все таблицы - привязываем к компании
    UPDATE equipment SET company_id = new_company_id WHERE user_id = user_record.user_id;
    -- categories не имеет user_id, обновляем по связи с equipment
    -- (находим категории, которые используются в оборудовании компании)
    UPDATE categories SET company_id = new_company_id 
    WHERE name IN (
      SELECT DISTINCT e.category FROM equipment e
      WHERE e.company_id = new_company_id AND e.category IS NOT NULL
    );
    UPDATE estimates SET company_id = new_company_id WHERE user_id = user_record.user_id;
    UPDATE estimate_items SET company_id = new_company_id WHERE estimate_id IN (
      SELECT id FROM estimates WHERE user_id = user_record.user_id
    );
    UPDATE templates SET company_id = new_company_id WHERE user_id = user_record.user_id;
    UPDATE template_items SET company_id = new_company_id WHERE template_id IN (
      SELECT id FROM templates WHERE user_id = user_record.user_id
    );
    UPDATE customers SET company_id = new_company_id WHERE user_id = user_record.user_id;
    UPDATE staff SET company_id = new_company_id WHERE user_id = user_record.user_id;
    UPDATE contracts SET company_id = new_company_id WHERE user_id = user_record.user_id;
    UPDATE contract_estimates SET company_id = new_company_id WHERE contract_id IN (
      SELECT id FROM contracts WHERE user_id = user_record.user_id
    );
    UPDATE contract_templates SET company_id = new_company_id WHERE user_id = user_record.user_id;
    UPDATE invoices SET company_id = new_company_id WHERE user_id = user_record.user_id;
    UPDATE acts SET company_id = new_company_id WHERE user_id = user_record.user_id;
    UPDATE act_items SET company_id = new_company_id WHERE act_id IN (
      SELECT id FROM acts WHERE user_id = user_record.user_id
    );
    -- Опциональные таблицы (с проверкой существования)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'checklist_rules') THEN
      UPDATE checklist_rules SET company_id = new_company_id WHERE user_id = user_record.user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'checklists') THEN
      UPDATE checklists SET company_id = new_company_id WHERE user_id = user_record.user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cable_categories') THEN
      UPDATE cable_categories SET company_id = new_company_id WHERE user_id = user_record.user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cable_inventory') THEN
      UPDATE cable_inventory SET company_id = new_company_id WHERE user_id = user_record.user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
      UPDATE expenses SET company_id = new_company_id WHERE user_id = user_record.user_id;
    END IF;
    UPDATE goals SET company_id = new_company_id WHERE user_id = user_record.user_id;
    
  END LOOP;
END $$;

-- ============================================
-- 5. Включаем триггеры аудита обратно
-- ============================================

-- Включаем триггеры аудита обратно
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'equipment_audit_trigger') THEN
    ALTER TABLE equipment ENABLE TRIGGER equipment_audit_trigger;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'estimate_audit_trigger') THEN
    ALTER TABLE estimates ENABLE TRIGGER estimate_audit_trigger;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'customer_audit_trigger') THEN
    ALTER TABLE customers ENABLE TRIGGER customer_audit_trigger;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'staff_audit_trigger') THEN
    ALTER TABLE staff ENABLE TRIGGER staff_audit_trigger;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'contract_audit_trigger') THEN
    ALTER TABLE contracts ENABLE TRIGGER contract_audit_trigger;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'contract_template_audit_trigger') THEN
    ALTER TABLE contract_templates ENABLE TRIGGER contract_template_audit_trigger;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'estimate_item_audit_trigger') THEN
    ALTER TABLE estimate_items ENABLE TRIGGER estimate_item_audit_trigger;
  END IF;
END $$;

-- ============================================
-- 6. Делаем company_id NOT NULL (после миграции)
-- ============================================

ALTER TABLE equipment ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE estimates ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE contracts ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE acts ALTER COLUMN company_id SET NOT NULL;

-- ============================================
-- 7. Создаём индексы
-- ============================================

CREATE INDEX IF NOT EXISTS idx_companies_inn ON companies(inn);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);

CREATE INDEX IF NOT EXISTS idx_equipment_company_id ON equipment(company_id);
CREATE INDEX IF NOT EXISTS idx_estimates_company_id ON estimates(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company_id ON contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_acts_company_id ON acts(company_id);

-- ============================================
-- 8. RLS (Row Level Security) для companies
-- ============================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- Политики для companies
DROP POLICY IF EXISTS "Company members can view their company" ON companies;
CREATE POLICY "Company members can view their company" 
  ON companies FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM company_members 
      WHERE company_id = companies.id 
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Company owners and admins can update" ON companies;
CREATE POLICY "Company owners and admins can update" 
  ON companies FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM company_members 
      WHERE company_id = companies.id 
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

-- Политики для company_members
DROP POLICY IF EXISTS "Members can view company members" ON company_members;
CREATE POLICY "Members can view company members" 
  ON company_members FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM company_members AS cm
      WHERE cm.company_id = company_members.company_id 
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Owners and admins can manage members" ON company_members;
CREATE POLICY "Owners and admins can manage members" 
  ON company_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM company_members AS cm
      WHERE cm.company_id = company_members.company_id 
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
      AND cm.status = 'active'
    )
  );

-- ============================================
-- 9. Обновляем RLS для всех таблиц (company_id вместо user_id)
-- ============================================

-- Equipment
DROP POLICY IF EXISTS "Users can view own equipment" ON equipment;
DROP POLICY IF EXISTS "Users can insert own equipment" ON equipment;
DROP POLICY IF EXISTS "Users can update own equipment" ON equipment;
DROP POLICY IF EXISTS "Users can delete own equipment" ON equipment;

CREATE POLICY "Company members can view equipment" ON equipment FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = equipment.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can insert equipment" ON equipment FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = equipment.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can update equipment" ON equipment FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = equipment.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can delete equipment" ON equipment FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = equipment.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

-- Estimates
DROP POLICY IF EXISTS "Users can view own estimates" ON estimates;
DROP POLICY IF EXISTS "Users can insert own estimates" ON estimates;
DROP POLICY IF EXISTS "Users can update own estimates" ON estimates;
DROP POLICY IF EXISTS "Users can delete own estimates" ON estimates;

CREATE POLICY "Company members can view estimates" ON estimates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = estimates.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can insert estimates" ON estimates FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = estimates.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can update estimates" ON estimates FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = estimates.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can delete estimates" ON estimates FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = estimates.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

-- Customers
DROP POLICY IF EXISTS "Users can view own customers" ON customers;
DROP POLICY IF EXISTS "Users can insert own customers" ON customers;
DROP POLICY IF EXISTS "Users can update own customers" ON customers;
DROP POLICY IF EXISTS "Users can delete own customers" ON customers;

CREATE POLICY "Company members can view customers" ON customers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = customers.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can insert customers" ON customers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = customers.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can update customers" ON customers FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = customers.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can delete customers" ON customers FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = customers.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

-- Contracts
DROP POLICY IF EXISTS "Users can view own contracts" ON contracts;
DROP POLICY IF EXISTS "Users can insert own contracts" ON contracts;
DROP POLICY IF EXISTS "Users can update own contracts" ON contracts;
DROP POLICY IF EXISTS "Users can delete own contracts" ON contracts;

CREATE POLICY "Company members can view contracts" ON contracts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = contracts.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can insert contracts" ON contracts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = contracts.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can update contracts" ON contracts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = contracts.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can delete contracts" ON contracts FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = contracts.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

-- Invoices
DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete own invoices" ON invoices;

CREATE POLICY "Company members can view invoices" ON invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = invoices.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can insert invoices" ON invoices FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = invoices.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can update invoices" ON invoices FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = invoices.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can delete invoices" ON invoices FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = invoices.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

-- Acts
DROP POLICY IF EXISTS "Users can view own acts" ON acts;
DROP POLICY IF EXISTS "Users can insert own acts" ON acts;
DROP POLICY IF EXISTS "Users can update own acts" ON acts;
DROP POLICY IF EXISTS "Users can delete own acts" ON acts;

CREATE POLICY "Company members can view acts" ON acts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = acts.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can insert acts" ON acts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = acts.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can update acts" ON acts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = acts.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

CREATE POLICY "Company members can delete acts" ON acts FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_id = acts.company_id 
    AND user_id = auth.uid()
    AND status = 'active'
  ));

-- ============================================
-- 10. Real-time подписки
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'companies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE companies;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'company_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE company_members;
  END IF;
END $$;

-- ============================================
-- 11. Триггеры для обновления updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at 
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Проверка миграции
-- ============================================
SELECT 
  'Миграция завершена!' as status,
  (SELECT COUNT(*) FROM companies) as companies_count,
  (SELECT COUNT(*) FROM company_members) as members_count;
