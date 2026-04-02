-- ============================================
-- Исправление: добавление company_id в acts и invoices
-- ============================================

-- 1. Добавляем company_id в acts
ALTER TABLE acts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 2. Добавляем company_id в invoices  
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 3. Добавляем company_id в act_items (если нужно для RLS)
ALTER TABLE act_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 4. Создаем индексы
CREATE INDEX IF NOT EXISTS idx_acts_company_id ON acts(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_act_items_company_id ON act_items(company_id);

-- 5. Обновляем существующие записи - присваиваем company_id из связанных договоров
UPDATE acts 
SET company_id = contracts.company_id
FROM contracts
WHERE acts.contract_id = contracts.id
  AND acts.company_id IS NULL;

UPDATE invoices 
SET company_id = contracts.company_id
FROM contracts
WHERE invoices.contract_id = contracts.id
  AND invoices.company_id IS NULL;

UPDATE act_items 
SET company_id = acts.company_id
FROM acts
WHERE act_items.act_id = acts.id
  AND act_items.company_id IS NULL;

-- 6. Обновляем RLS политики для acts
DROP POLICY IF EXISTS "Users can view own acts" ON acts;
CREATE POLICY "Users can view company acts" 
  ON acts FOR SELECT 
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert own acts" ON acts;
CREATE POLICY "Users can insert company acts" 
  ON acts FOR INSERT 
  WITH CHECK (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update own acts" ON acts;
CREATE POLICY "Users can update company acts" 
  ON acts FOR UPDATE 
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete own acts" ON acts;
CREATE POLICY "Users can delete company acts" 
  ON acts FOR DELETE 
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

-- 7. Обновляем RLS политики для invoices
DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
CREATE POLICY "Users can view company invoices" 
  ON invoices FOR SELECT 
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert own invoices" ON invoices;
CREATE POLICY "Users can insert company invoices" 
  ON invoices FOR INSERT 
  WITH CHECK (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update own invoices" ON invoices;
CREATE POLICY "Users can update company invoices" 
  ON invoices FOR UPDATE 
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete own invoices" ON invoices;
CREATE POLICY "Users can delete company invoices" 
  ON invoices FOR DELETE 
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

-- 8. Обновляем RLS политики для act_items
DROP POLICY IF EXISTS "Users can view own act items" ON act_items;
CREATE POLICY "Users can view company act items" 
  ON act_items FOR SELECT 
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert own act items" ON act_items;
CREATE POLICY "Users can insert company act items" 
  ON act_items FOR INSERT 
  WITH CHECK (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update own act items" ON act_items;
CREATE POLICY "Users can update company act items" 
  ON act_items FOR UPDATE 
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete own act items" ON act_items;
CREATE POLICY "Users can delete company act items" 
  ON act_items FOR DELETE 
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

SELECT 'company_id добавлен в acts, invoices, act_items!' as status;
