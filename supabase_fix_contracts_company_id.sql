-- ============================================
-- Добавление company_id в таблицу contracts и обновление RLS
-- ============================================
-- Инструкция: Выполните этот скрипт в Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Добавляем поле company_id
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 2. Создаём индекс
CREATE INDEX IF NOT EXISTS idx_contracts_company_id ON contracts (company_id);

-- 3. Добавляем поле bank_account_id (если ещё не добавлено)
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES company_bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_bank_account_id ON contracts (bank_account_id);

-- 4. Обновляем RLS политики для использования company_id

-- Удаляем старые политики (если есть)
DROP POLICY IF EXISTS "Users can view own contracts" ON contracts;
DROP POLICY IF EXISTS "Users can insert own contracts" ON contracts;
DROP POLICY IF EXISTS "Users can update own contracts" ON contracts;
DROP POLICY IF EXISTS "Users can delete own contracts" ON contracts;

-- Новые политики на основе company_id
DROP POLICY IF EXISTS "Company members can view contracts" ON contracts;
CREATE POLICY "Company members can view contracts" 
  ON contracts FOR SELECT 
  USING (company_id IN (
    SELECT company_id FROM company_members 
    WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Company members can insert contracts" ON contracts;
CREATE POLICY "Company members can insert contracts" 
  ON contracts FOR INSERT 
  WITH CHECK (company_id IN (
    SELECT company_id FROM company_members 
    WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Company members can update contracts" ON contracts;
CREATE POLICY "Company members can update contracts" 
  ON contracts FOR UPDATE 
  USING (company_id IN (
    SELECT company_id FROM company_members 
    WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Company members can delete contracts" ON contracts;
CREATE POLICY "Company members can delete contracts" 
  ON contracts FOR DELETE 
  USING (company_id IN (
    SELECT company_id FROM company_members 
    WHERE user_id = auth.uid()
  ));

-- 5. Обновляем политики для contract_estimates
DROP POLICY IF EXISTS "Users can view own contract estimates" ON contract_estimates;
DROP POLICY IF EXISTS "Users can insert own contract estimates" ON contract_estimates;
DROP POLICY IF EXISTS "Users can delete own contract estimates" ON contract_estimates;

DROP POLICY IF EXISTS "Company members can view contract estimates" ON contract_estimates;
CREATE POLICY "Company members can view contract estimates" 
  ON contract_estimates FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM contracts 
    WHERE contracts.id = contract_estimates.contract_id 
    AND contracts.company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Company members can insert contract estimates" ON contract_estimates;
CREATE POLICY "Company members can insert contract estimates" 
  ON contract_estimates FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM contracts 
    WHERE contracts.id = contract_estimates.contract_id 
    AND contracts.company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Company members can delete contract estimates" ON contract_estimates;
CREATE POLICY "Company members can delete contract estimates" 
  ON contract_estimates FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM contracts 
    WHERE contracts.id = contract_estimates.contract_id 
    AND contracts.company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  ));

-- 6. Обновляем политики для contract_templates
DROP POLICY IF EXISTS "Authenticated users can view contract templates" ON contract_templates;
DROP POLICY IF EXISTS "Users can insert own contract templates" ON contract_templates;
DROP POLICY IF EXISTS "Users can update own contract templates" ON contract_templates;
DROP POLICY IF EXISTS "Users can delete own contract templates" ON contract_templates;

DROP POLICY IF EXISTS "Company members can view contract templates" ON contract_templates;
CREATE POLICY "Company members can view contract templates" 
  ON contract_templates FOR SELECT 
  USING (company_id = auth.uid() OR company_id IS NULL);

DROP POLICY IF EXISTS "Company members can insert contract templates" ON contract_templates;
CREATE POLICY "Company members can insert contract templates" 
  ON contract_templates FOR INSERT 
  WITH CHECK (company_id IN (
    SELECT company_id FROM company_members 
    WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Company members can update contract templates" ON contract_templates;
CREATE POLICY "Company members can update contract templates" 
  ON contract_templates FOR UPDATE 
  USING (company_id IN (
    SELECT company_id FROM company_members 
    WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Company members can delete contract templates" ON contract_templates;
CREATE POLICY "Company members can delete contract templates" 
  ON contract_templates FOR DELETE 
  USING (company_id IN (
    SELECT company_id FROM company_members 
    WHERE user_id = auth.uid()
  ));

-- ============================================
-- Проверка
-- ============================================
SELECT 'Таблица contracts обновлена: добавлены company_id и bank_account_id, RLS политики обновлены!' as status;
