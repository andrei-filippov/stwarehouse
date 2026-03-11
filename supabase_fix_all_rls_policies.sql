-- ============================================
-- Обновление ВСЕХ RLS политик для мультиарендности
-- ============================================

-- Функция для проверки членства в компании
CREATE OR REPLACE FUNCTION is_company_member(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = p_company_id
    AND cm.user_id = auth.uid()
    AND cm.status = 'active'
  );
END;
$$;

-- ============================================
-- 1. EQUIPMENT (Оборудование)
-- ============================================
DROP POLICY IF EXISTS "Users can view own equipment" ON equipment;
DROP POLICY IF EXISTS "Users can insert own equipment" ON equipment;
DROP POLICY IF EXISTS "Users can update own equipment" ON equipment;
DROP POLICY IF EXISTS "Users can delete own equipment" ON equipment;
DROP POLICY IF EXISTS "equipment_select" ON equipment;
DROP POLICY IF EXISTS "equipment_insert" ON equipment;
DROP POLICY IF EXISTS "equipment_update" ON equipment;
DROP POLICY IF EXISTS "equipment_delete" ON equipment;

CREATE POLICY "equipment_select_company" ON equipment FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "equipment_insert_company" ON equipment FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "equipment_update_company" ON equipment FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "equipment_delete_company" ON equipment FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 2. CATEGORIES (Категории)
-- ============================================
DROP POLICY IF EXISTS "Users can view categories" ON categories;
DROP POLICY IF EXISTS "Users can insert categories" ON categories;
DROP POLICY IF EXISTS "Users can update categories" ON categories;
DROP POLICY IF EXISTS "Users can delete categories" ON categories;

CREATE POLICY "categories_select_company" ON categories FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "categories_insert_company" ON categories FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "categories_update_company" ON categories FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "categories_delete_company" ON categories FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 3. ESTIMATES (Сметы)
-- ============================================
DROP POLICY IF EXISTS "Users can view own estimates" ON estimates;
DROP POLICY IF EXISTS "Users can insert own estimates" ON estimates;
DROP POLICY IF EXISTS "Users can update own estimates" ON estimates;
DROP POLICY IF EXISTS "Users can delete own estimates" ON estimates;

CREATE POLICY "estimates_select_company" ON estimates FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "estimates_insert_company" ON estimates FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "estimates_update_company" ON estimates FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "estimates_delete_company" ON estimates FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 4. ESTIMATE_ITEMS (Позиции смет)
-- ============================================
DROP POLICY IF EXISTS "Users can view own estimate items" ON estimate_items;
DROP POLICY IF EXISTS "Users can insert own estimate items" ON estimate_items;
DROP POLICY IF EXISTS "Users can delete own estimate items" ON estimate_items;

CREATE POLICY "estimate_items_select_company" ON estimate_items FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "estimate_items_insert_company" ON estimate_items FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "estimate_items_delete_company" ON estimate_items FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 5. CUSTOMERS (Заказчики)
-- ============================================
DROP POLICY IF EXISTS "Users can view customers" ON customers;
DROP POLICY IF EXISTS "Users can insert customers" ON customers;
DROP POLICY IF EXISTS "Users can update customers" ON customers;
DROP POLICY IF EXISTS "Users can delete customers" ON customers;

CREATE POLICY "customers_select_company" ON customers FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "customers_insert_company" ON customers FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "customers_update_company" ON customers FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "customers_delete_company" ON customers FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 6. TEMPLATES (Шаблоны)
-- ============================================
DROP POLICY IF EXISTS "Users can view own templates" ON templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON templates;
DROP POLICY IF EXISTS "Users can update own templates" ON templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON templates;

CREATE POLICY "templates_select_company" ON templates FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "templates_insert_company" ON templates FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "templates_update_company" ON templates FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "templates_delete_company" ON templates FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 7. TEMPLATE_ITEMS (Позиции шаблонов)
-- ============================================
DROP POLICY IF EXISTS "Users can view template items" ON template_items;
DROP POLICY IF EXISTS "Users can insert template items" ON template_items;
DROP POLICY IF EXISTS "Users can delete template items" ON template_items;

CREATE POLICY "template_items_select_company" ON template_items FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "template_items_insert_company" ON template_items FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "template_items_delete_company" ON template_items FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 8. CONTRACTS (Договоры)
-- ============================================
DROP POLICY IF EXISTS "Users can view contracts" ON contracts;
DROP POLICY IF EXISTS "Users can insert contracts" ON contracts;
DROP POLICY IF EXISTS "Users can update contracts" ON contracts;
DROP POLICY IF EXISTS "Users can delete contracts" ON contracts;

CREATE POLICY "contracts_select_company" ON contracts FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "contracts_insert_company" ON contracts FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "contracts_update_company" ON contracts FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "contracts_delete_company" ON contracts FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 9. INVOICES (Счета)
-- ============================================
DROP POLICY IF EXISTS "Users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;

CREATE POLICY "invoices_select_company" ON invoices FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "invoices_insert_company" ON invoices FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "invoices_update_company" ON invoices FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "invoices_delete_company" ON invoices FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 10. ACTS (Акты)
-- ============================================
DROP POLICY IF EXISTS "Users can view acts" ON acts;
DROP POLICY IF EXISTS "Users can insert acts" ON acts;
DROP POLICY IF EXISTS "Users can update acts" ON acts;
DROP POLICY IF EXISTS "Users can delete acts" ON acts;

CREATE POLICY "acts_select_company" ON acts FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "acts_insert_company" ON acts FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "acts_update_company" ON acts FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "acts_delete_company" ON acts FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 11. ACT_ITEMS (Позиции актов)
-- ============================================
DROP POLICY IF EXISTS "Users can view act items" ON act_items;
DROP POLICY IF EXISTS "Users can insert act items" ON act_items;
DROP POLICY IF EXISTS "Users can delete act items" ON act_items;

CREATE POLICY "act_items_select_company" ON act_items FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "act_items_insert_company" ON act_items FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "act_items_delete_company" ON act_items FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 12. EXPENSES (Расходы)
-- ============================================
DROP POLICY IF EXISTS "Users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses" ON expenses;

CREATE POLICY "expenses_select_company" ON expenses FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "expenses_insert_company" ON expenses FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "expenses_update_company" ON expenses FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "expenses_delete_company" ON expenses FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 13. GOALS (Цели/Задачи)
-- ============================================
DROP POLICY IF EXISTS "Users can view goals" ON goals;
DROP POLICY IF EXISTS "Users can insert goals" ON goals;
DROP POLICY IF EXISTS "Users can update goals" ON goals;
DROP POLICY IF EXISTS "Users can delete goals" ON goals;

CREATE POLICY "goals_select_company" ON goals FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "goals_insert_company" ON goals FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "goals_update_company" ON goals FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "goals_delete_company" ON goals FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 14. CHECKLIST_RULES (Правила чек-листов)
-- ============================================
DROP POLICY IF EXISTS "Users can view checklist rules" ON checklist_rules;
DROP POLICY IF EXISTS "Users can insert checklist rules" ON checklist_rules;
DROP POLICY IF EXISTS "Users can delete checklist rules" ON checklist_rules;

CREATE POLICY "checklist_rules_select_company" ON checklist_rules FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "checklist_rules_insert_company" ON checklist_rules FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "checklist_rules_delete_company" ON checklist_rules FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 15. CHECKLISTS (Чек-листы)
-- ============================================
DROP POLICY IF EXISTS "Users can view checklists" ON checklists;
DROP POLICY IF EXISTS "Users can insert checklists" ON checklists;
DROP POLICY IF EXISTS "Users can delete checklists" ON checklists;

CREATE POLICY "checklists_select_company" ON checklists FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "checklists_insert_company" ON checklists FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "checklists_delete_company" ON checklists FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 16. CONTRACT_ESTIMATES (Связь договоров и смет)
-- ============================================
DROP POLICY IF EXISTS "Users can view contract estimates" ON contract_estimates;
DROP POLICY IF EXISTS "Users can insert contract estimates" ON contract_estimates;
DROP POLICY IF EXISTS "Users can delete contract estimates" ON contract_estimates;

CREATE POLICY "contract_estimates_select_company" ON contract_estimates FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "contract_estimates_insert_company" ON contract_estimates FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "contract_estimates_delete_company" ON contract_estimates FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 17. CONTRACT_TEMPLATES (Шаблоны договоров)
-- ============================================
DROP POLICY IF EXISTS "Users can view contract templates" ON contract_templates;
DROP POLICY IF EXISTS "Users can insert contract templates" ON contract_templates;
DROP POLICY IF EXISTS "Users can update contract templates" ON contract_templates;
DROP POLICY IF EXISTS "Users can delete contract templates" ON contract_templates;

CREATE POLICY "contract_templates_select_company" ON contract_templates FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "contract_templates_insert_company" ON contract_templates FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "contract_templates_update_company" ON contract_templates FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "contract_templates_delete_company" ON contract_templates FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 18. CABLE_CATEGORIES (Категории кабелей)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cable_categories') THEN
    DROP POLICY IF EXISTS "Users can view cable categories" ON cable_categories;
    DROP POLICY IF EXISTS "Users can insert cable categories" ON cable_categories;
    DROP POLICY IF EXISTS "Users can update cable categories" ON cable_categories;
    DROP POLICY IF EXISTS "Users can delete cable categories" ON cable_categories;

    CREATE POLICY "cable_categories_select_company" ON cable_categories FOR SELECT
      USING (is_company_member(company_id));
    CREATE POLICY "cable_categories_insert_company" ON cable_categories FOR INSERT
      WITH CHECK (is_company_member(company_id));
    CREATE POLICY "cable_categories_update_company" ON cable_categories FOR UPDATE
      USING (is_company_member(company_id));
    CREATE POLICY "cable_categories_delete_company" ON cable_categories FOR DELETE
      USING (is_company_member(company_id));
  END IF;
END $$;

-- ============================================
-- 19. CABLE_INVENTORY (Кабели)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cable_inventory') THEN
    DROP POLICY IF EXISTS "Users can view cable inventory" ON cable_inventory;
    DROP POLICY IF EXISTS "Users can insert cable inventory" ON cable_inventory;
    DROP POLICY IF EXISTS "Users can update cable inventory" ON cable_inventory;
    DROP POLICY IF EXISTS "Users can delete cable inventory" ON cable_inventory;

    CREATE POLICY "cable_inventory_select_company" ON cable_inventory FOR SELECT
      USING (is_company_member(company_id));
    CREATE POLICY "cable_inventory_insert_company" ON cable_inventory FOR INSERT
      WITH CHECK (is_company_member(company_id));
    CREATE POLICY "cable_inventory_update_company" ON cable_inventory FOR UPDATE
      USING (is_company_member(company_id));
    CREATE POLICY "cable_inventory_delete_company" ON cable_inventory FOR DELETE
      USING (is_company_member(company_id));
  END IF;
END $$;

-- ============================================
-- Проверка результатов
-- ============================================
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN (
    'equipment', 'categories', 'estimates', 'estimate_items', 
    'customers', 'templates', 'template_items', 'contracts',
    'invoices', 'acts', 'act_items', 'expenses', 'goals',
    'checklist_rules', 'checklists', 'contract_estimates',
    'contract_templates', 'staff'
)
ORDER BY tablename, cmd;
