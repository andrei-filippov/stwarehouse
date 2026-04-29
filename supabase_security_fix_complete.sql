-- ============================================================
-- ПОЛНЫЙ СКРИПТ ИСПРАВЛЕНИЯ БЕЗОПАСНОСТИ RLS
-- stwarehouse — исправление всех уязвимостей перед переездом
-- Выполнить в Supabase SQL Editor (New Query)
-- ============================================================
-- ⚠️  СОЗДАЙТЕ БЭКАП БАЗЫ ДАННЫХ ПЕРЕД ВЫПОЛНЕНИЕМ!
-- ============================================================

-- ============================================
-- 0. Вспомогательная функция (единая точка проверки)
-- ============================================

-- Создаём единую функцию проверки членства в компании
-- (CREATE OR REPLACE, т.к. функция уже используется в существующих политиках)
CREATE OR REPLACE FUNCTION is_company_member(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION is_company_member(UUID) TO authenticated;

-- Функция check_company_access оставлена как есть (используется в company_members)

-- ============================================
-- 1. CATEGORIES — БЫЛА ОТКРЫТА ДЛЯ ВСЕХ!
-- ============================================
-- Раньше: USING (true) — любой авторизованный видел ВСЕ категории

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON categories;
DROP POLICY IF EXISTS "categories_select_company" ON categories;
DROP POLICY IF EXISTS "categories_insert_company" ON categories;
DROP POLICY IF EXISTS "categories_update_company" ON categories;
DROP POLICY IF EXISTS "categories_delete_company" ON categories;

CREATE POLICY "categories_select_company" ON categories FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "categories_insert_company" ON categories FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "categories_update_company" ON categories FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "categories_delete_company" ON categories FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 2. STAFF — БЫЛА НА user_id, А НЕ НА company_id
-- ============================================
-- Раньше: auth.uid() = user_id — только создатель видел сотрудников

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own staff" ON staff;
DROP POLICY IF EXISTS "Users can insert own staff" ON staff;
DROP POLICY IF EXISTS "Users can update own staff" ON staff;
DROP POLICY IF EXISTS "Users can delete own staff" ON staff;
DROP POLICY IF EXISTS "staff_select_company" ON staff;
DROP POLICY IF EXISTS "staff_insert_company" ON staff;
DROP POLICY IF EXISTS "staff_update_company" ON staff;
DROP POLICY IF EXISTS "staff_delete_company" ON staff;

CREATE POLICY "staff_select_company" ON staff FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "staff_insert_company" ON staff FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "staff_update_company" ON staff FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "staff_delete_company" ON staff FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- ПРЕДВАРИТЕЛЬНО: Добавляем company_id где её нет
-- ============================================

-- Дочерние таблицы (позиции), которые создавались без company_id
ALTER TABLE estimate_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE template_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE checklist_rule_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE kit_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Заполняем company_id из родительских таблиц (если NULL)
UPDATE estimate_items SET company_id = (
  SELECT e.company_id FROM estimates e WHERE e.id = estimate_items.estimate_id
) WHERE company_id IS NULL;

UPDATE template_items SET company_id = (
  SELECT t.company_id FROM templates t WHERE t.id = template_items.template_id
) WHERE company_id IS NULL;

UPDATE checklist_rule_items SET company_id = (
  SELECT cr.company_id FROM checklist_rules cr WHERE cr.id = checklist_rule_items.rule_id
) WHERE company_id IS NULL;

UPDATE checklist_items SET company_id = (
  SELECT c.company_id FROM checklists c WHERE c.id = checklist_items.checklist_id
) WHERE company_id IS NULL;

UPDATE kit_items SET company_id = (
  SELECT ek.company_id FROM equipment_kits ek WHERE ek.id = kit_items.kit_id
) WHERE company_id IS NULL;

-- ============================================
-- 3. ESTIMATE_ITEMS — НЕ БЫЛО RLS ВООБЩЕ
-- ============================================

ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own estimate items" ON estimate_items;
DROP POLICY IF EXISTS "Users can insert own estimate items" ON estimate_items;
DROP POLICY IF EXISTS "Users can delete own estimate items" ON estimate_items;
DROP POLICY IF EXISTS "estimate_items_select_company" ON estimate_items;
DROP POLICY IF EXISTS "estimate_items_insert_company" ON estimate_items;
DROP POLICY IF EXISTS "estimate_items_update_company" ON estimate_items;
DROP POLICY IF EXISTS "estimate_items_delete_company" ON estimate_items;

CREATE POLICY "estimate_items_select_company" ON estimate_items FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "estimate_items_insert_company" ON estimate_items FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "estimate_items_update_company" ON estimate_items FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "estimate_items_delete_company" ON estimate_items FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 4. TEMPLATE_ITEMS — НЕ БЫЛО RLS ВООБЩЕ
-- ============================================

ALTER TABLE template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own template items" ON template_items;
DROP POLICY IF EXISTS "Users can insert own template items" ON template_items;
DROP POLICY IF EXISTS "Users can delete own template items" ON template_items;
DROP POLICY IF EXISTS "template_items_select_company" ON template_items;
DROP POLICY IF EXISTS "template_items_insert_company" ON template_items;
DROP POLICY IF EXISTS "template_items_update_company" ON template_items;
DROP POLICY IF EXISTS "template_items_delete_company" ON template_items;

CREATE POLICY "template_items_select_company" ON template_items FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "template_items_insert_company" ON template_items FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "template_items_update_company" ON template_items FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "template_items_delete_company" ON template_items FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 5. CHECKLIST_RULE_ITEMS — НЕ БЫЛО RLS ВООБЩЕ
-- ============================================

ALTER TABLE checklist_rule_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own checklist rule items" ON checklist_rule_items;
DROP POLICY IF EXISTS "Users can insert own checklist rule items" ON checklist_rule_items;
DROP POLICY IF EXISTS "Users can delete own checklist rule items" ON checklist_rule_items;
DROP POLICY IF EXISTS "checklist_rule_items_select_company" ON checklist_rule_items;
DROP POLICY IF EXISTS "checklist_rule_items_insert_company" ON checklist_rule_items;
DROP POLICY IF EXISTS "checklist_rule_items_update_company" ON checklist_rule_items;
DROP POLICY IF EXISTS "checklist_rule_items_delete_company" ON checklist_rule_items;

CREATE POLICY "checklist_rule_items_select_company" ON checklist_rule_items FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "checklist_rule_items_insert_company" ON checklist_rule_items FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "checklist_rule_items_update_company" ON checklist_rule_items FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "checklist_rule_items_delete_company" ON checklist_rule_items FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 6. CHECKLIST_ITEMS — ПЕРЕСОЗДАЁМ С company_id
-- ============================================
-- Раньше: через подзапрос к checklists — медленно и сложно

ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Users can insert own checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Users can update own checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Users can delete own checklist items" ON checklist_items;
DROP POLICY IF EXISTS "Users can view checklist items in their company" ON checklist_items;
DROP POLICY IF EXISTS "Users can insert checklist items in their company" ON checklist_items;
DROP POLICY IF EXISTS "Users can update checklist items in their company" ON checklist_items;
DROP POLICY IF EXISTS "Users can delete checklist items in their company" ON checklist_items;
DROP POLICY IF EXISTS "checklist_items_select_company" ON checklist_items;
DROP POLICY IF EXISTS "checklist_items_insert_company" ON checklist_items;
DROP POLICY IF EXISTS "checklist_items_update_company" ON checklist_items;
DROP POLICY IF EXISTS "checklist_items_delete_company" ON checklist_items;

CREATE POLICY "checklist_items_select_company" ON checklist_items FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "checklist_items_insert_company" ON checklist_items FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "checklist_items_update_company" ON checklist_items FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "checklist_items_delete_company" ON checklist_items FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 7. CONTRACT_ESTIMATES — НЕ БЫЛО RLS ВООБЩЕ
-- ============================================

ALTER TABLE contract_estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view contract estimates" ON contract_estimates;
DROP POLICY IF EXISTS "Users can insert contract estimates" ON contract_estimates;
DROP POLICY IF EXISTS "Users can delete contract estimates" ON contract_estimates;
DROP POLICY IF EXISTS "contract_estimates_select_company" ON contract_estimates;
DROP POLICY IF EXISTS "contract_estimates_insert_company" ON contract_estimates;
DROP POLICY IF EXISTS "contract_estimates_update_company" ON contract_estimates;
DROP POLICY IF EXISTS "contract_estimates_delete_company" ON contract_estimates;

CREATE POLICY "contract_estimates_select_company" ON contract_estimates FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "contract_estimates_insert_company" ON contract_estimates FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "contract_estimates_update_company" ON contract_estimates FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "contract_estimates_delete_company" ON contract_estimates FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 8. ACT_ITEMS — НЕ БЫЛО RLS ВООБЩЕ (были старые user_id)
-- ============================================

ALTER TABLE act_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own act items" ON act_items;
DROP POLICY IF EXISTS "Users can insert own act items" ON act_items;
DROP POLICY IF EXISTS "Users can update own act items" ON act_items;
DROP POLICY IF EXISTS "Users can delete own act items" ON act_items;
DROP POLICY IF EXISTS "act_items_select_company" ON act_items;
DROP POLICY IF EXISTS "act_items_insert_company" ON act_items;
DROP POLICY IF EXISTS "act_items_update_company" ON act_items;
DROP POLICY IF EXISTS "act_items_delete_company" ON act_items;

CREATE POLICY "act_items_select_company" ON act_items FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "act_items_insert_company" ON act_items FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "act_items_update_company" ON act_items FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "act_items_delete_company" ON act_items FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 9. PAYROLL_ENTRIES — НЕ БЫЛО RLS ВООБЩЕ
-- ============================================

ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_company_isolation" ON payroll_entries;
DROP POLICY IF EXISTS "payroll_select_company" ON payroll_entries;
DROP POLICY IF EXISTS "payroll_insert_company" ON payroll_entries;
DROP POLICY IF EXISTS "payroll_update_company" ON payroll_entries;
DROP POLICY IF EXISTS "payroll_delete_company" ON payroll_entries;

CREATE POLICY "payroll_select_company" ON payroll_entries FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "payroll_insert_company" ON payroll_entries FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "payroll_update_company" ON payroll_entries FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "payroll_delete_company" ON payroll_entries FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 10. SALARY_PAYMENTS — НЕ БЫЛО RLS ВООБЩЕ
-- ============================================

ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salary_payments_company_isolation" ON salary_payments;
DROP POLICY IF EXISTS "salary_payments_select_company" ON salary_payments;
DROP POLICY IF EXISTS "salary_payments_insert_company" ON salary_payments;
DROP POLICY IF EXISTS "salary_payments_update_company" ON salary_payments;
DROP POLICY IF EXISTS "salary_payments_delete_company" ON salary_payments;

CREATE POLICY "salary_payments_select_company" ON salary_payments FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "salary_payments_insert_company" ON salary_payments FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "salary_payments_update_company" ON salary_payments FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "salary_payments_delete_company" ON salary_payments FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 11. COMPANY_BANK_ACCOUNTS — ДОБАВЛЯЕМ status = 'active'
-- ============================================

ALTER TABLE company_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_bank_accounts_isolation" ON company_bank_accounts;
DROP POLICY IF EXISTS "company_bank_accounts_select" ON company_bank_accounts;
DROP POLICY IF EXISTS "company_bank_accounts_insert" ON company_bank_accounts;
DROP POLICY IF EXISTS "company_bank_accounts_update" ON company_bank_accounts;
DROP POLICY IF EXISTS "company_bank_accounts_delete" ON company_bank_accounts;

CREATE POLICY "company_bank_accounts_select" ON company_bank_accounts FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "company_bank_accounts_insert" ON company_bank_accounts FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "company_bank_accounts_update" ON company_bank_accounts FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "company_bank_accounts_delete" ON company_bank_accounts FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 12. COMPANY_YANDEX_DISK — ДОБАВЛЯЕМ status = 'active'
-- ============================================

ALTER TABLE company_yandex_disk ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view yandex disk settings" ON company_yandex_disk;
DROP POLICY IF EXISTS "Company owners can manage yandex disk" ON company_yandex_disk;
DROP POLICY IF EXISTS "yandex_disk_select" ON company_yandex_disk;
DROP POLICY IF EXISTS "yandex_disk_manage" ON company_yandex_disk;

CREATE POLICY "yandex_disk_select" ON company_yandex_disk FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "yandex_disk_manage" ON company_yandex_disk FOR ALL
  USING (
    is_company_member(company_id) AND
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = company_yandex_disk.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

-- ============================================
-- 13. EQUIPMENT_REPAIRS — УЖЕ ЕСТЬ, НО ПЕРЕПРОВЕРИМ
-- ============================================

ALTER TABLE equipment_repairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view repairs" ON equipment_repairs;
DROP POLICY IF EXISTS "Company members can insert repairs" ON equipment_repairs;
DROP POLICY IF EXISTS "Company members can update repairs" ON equipment_repairs;
DROP POLICY IF EXISTS "Company members can delete repairs" ON equipment_repairs;
DROP POLICY IF EXISTS "equipment_repairs_select" ON equipment_repairs;
DROP POLICY IF EXISTS "equipment_repairs_insert" ON equipment_repairs;
DROP POLICY IF EXISTS "equipment_repairs_update" ON equipment_repairs;
DROP POLICY IF EXISTS "equipment_repairs_delete" ON equipment_repairs;

CREATE POLICY "equipment_repairs_select" ON equipment_repairs FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "equipment_repairs_insert" ON equipment_repairs FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "equipment_repairs_update" ON equipment_repairs FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "equipment_repairs_delete" ON equipment_repairs FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 14. EQUIPMENT_KITS — УЖЕ ЕСТЬ, НО УПРОЩАЕМ
-- ============================================

ALTER TABLE equipment_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view kits in their company" ON equipment_kits;
DROP POLICY IF EXISTS "Users can create kits in their company" ON equipment_kits;
DROP POLICY IF EXISTS "Users can update kits in their company" ON equipment_kits;
DROP POLICY IF EXISTS "Users can delete kits in their company" ON equipment_kits;
DROP POLICY IF EXISTS "equipment_kits_select" ON equipment_kits;
DROP POLICY IF EXISTS "equipment_kits_insert" ON equipment_kits;
DROP POLICY IF EXISTS "equipment_kits_update" ON equipment_kits;
DROP POLICY IF EXISTS "equipment_kits_delete" ON equipment_kits;

CREATE POLICY "equipment_kits_select" ON equipment_kits FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "equipment_kits_insert" ON equipment_kits FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "equipment_kits_update" ON equipment_kits FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "equipment_kits_delete" ON equipment_kits FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 15. KIT_ITEMS — УЖЕ ЕСТЬ, НО УПРОЩАЕМ
-- ============================================

ALTER TABLE kit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view kit items" ON kit_items;
DROP POLICY IF EXISTS "Users can manage kit items" ON kit_items;
DROP POLICY IF EXISTS "kit_items_select" ON kit_items;
DROP POLICY IF EXISTS "kit_items_insert" ON kit_items;
DROP POLICY IF EXISTS "kit_items_update" ON kit_items;
DROP POLICY IF EXISTS "kit_items_delete" ON kit_items;

CREATE POLICY "kit_items_select" ON kit_items FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "kit_items_insert" ON kit_items FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "kit_items_update" ON kit_items FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "kit_items_delete" ON kit_items FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 16. CABLE_MOVEMENTS — УЖЕ ЕСТЬ, ПЕРЕПРОВЕРИМ
-- ============================================

ALTER TABLE cable_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view cable movements" ON cable_movements;
DROP POLICY IF EXISTS "Company members can insert cable movements" ON cable_movements;
DROP POLICY IF EXISTS "Company members can update cable movements" ON cable_movements;
DROP POLICY IF EXISTS "Company members can delete cable movements" ON cable_movements;
DROP POLICY IF EXISTS "cable_movements_select" ON cable_movements;
DROP POLICY IF EXISTS "cable_movements_insert" ON cable_movements;
DROP POLICY IF EXISTS "cable_movements_update" ON cable_movements;
DROP POLICY IF EXISTS "cable_movements_delete" ON cable_movements;

CREATE POLICY "cable_movements_select" ON cable_movements FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "cable_movements_insert" ON cable_movements FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "cable_movements_update" ON cable_movements FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "cable_movements_delete" ON cable_movements FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 17. USER_PERMISSIONS — ДОБАВЛЯЕМ status = 'active'
-- ============================================

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Пользователи видят свои разрешения" ON user_permissions;
DROP POLICY IF EXISTS "Админы видят все разрешения" ON user_permissions;
DROP POLICY IF EXISTS "Админы управляют разрешениями" ON user_permissions;
DROP POLICY IF EXISTS "user_permissions_select_own" ON user_permissions;
DROP POLICY IF EXISTS "user_permissions_select_admin" ON user_permissions;
DROP POLICY IF EXISTS "user_permissions_manage" ON user_permissions;

-- Пользователи видят свои разрешения
CREATE POLICY "user_permissions_select_own" ON user_permissions FOR SELECT
  USING (user_id = auth.uid());

-- Админы и владельцы видят разрешения своей компании
CREATE POLICY "user_permissions_select_admin" ON user_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      JOIN company_members target ON cm.company_id = target.company_id
      WHERE cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
      AND cm.status = 'active'
      AND target.user_id = user_permissions.user_id
    )
  );

-- Админы и владельцы управляют разрешениями
CREATE POLICY "user_permissions_manage" ON user_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      JOIN company_members target ON cm.company_id = target.company_id
      WHERE cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
      AND cm.status = 'active'
      AND target.user_id = user_permissions.user_id
    )
  );

-- ============================================
-- 18. AUDIT_LOGS — ИСПРАВЛЯЕМ (только service_role для вставки)
-- ============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Только админы видят логи" ON audit_logs;
DROP POLICY IF EXISTS "Пользователи видят свои логи" ON audit_logs;
DROP POLICY IF EXISTS "Вставка логов для авторизованных" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_admin" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_own" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;

-- Админы видят все логи своей компании
CREATE POLICY "audit_logs_select_admin" ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
      AND cm.status = 'active'
    )
  );

-- Пользователи видят только свои логи
CREATE POLICY "audit_logs_select_own" ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- Вставка только через service_role (триггеры используют SECURITY DEFINER)
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 19. INCOME — ДОБАВЛЯЕМ status = 'active'
-- ============================================

ALTER TABLE income ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "income_company_isolation" ON income;
DROP POLICY IF EXISTS "income_select" ON income;
DROP POLICY IF EXISTS "income_insert" ON income;
DROP POLICY IF EXISTS "income_update" ON income;
DROP POLICY IF EXISTS "income_delete" ON income;

CREATE POLICY "income_select" ON income FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "income_insert" ON income FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "income_update" ON income FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "income_delete" ON income FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 20. EXPENSES — ДОБАВЛЯЕМ status = 'active'
-- ============================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_company_isolation" ON expenses;
DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_update" ON expenses;
DROP POLICY IF EXISTS "expenses_delete" ON expenses;

CREATE POLICY "expenses_select" ON expenses FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 21. INCOME_MANUAL_ENTRIES — ДОБАВЛЯЕМ status = 'active'
-- ============================================

ALTER TABLE income_manual_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view manual incomes for their company" ON income_manual_entries;
DROP POLICY IF EXISTS "Users can insert manual incomes for their company" ON income_manual_entries;
DROP POLICY IF EXISTS "Users can update manual incomes for their company" ON income_manual_entries;
DROP POLICY IF EXISTS "Users can delete manual incomes for their company" ON income_manual_entries;
DROP POLICY IF EXISTS "income_manual_select" ON income_manual_entries;
DROP POLICY IF EXISTS "income_manual_insert" ON income_manual_entries;
DROP POLICY IF EXISTS "income_manual_update" ON income_manual_entries;
DROP POLICY IF EXISTS "income_manual_delete" ON income_manual_entries;

CREATE POLICY "income_manual_select" ON income_manual_entries FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "income_manual_insert" ON income_manual_entries FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "income_manual_update" ON income_manual_entries FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "income_manual_delete" ON income_manual_entries FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 22. SALARY_RECORDS — ДОБАВЛЯЕМ status = 'active'
-- ============================================

ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view salary records for their company" ON salary_records;
DROP POLICY IF EXISTS "Users can insert salary records for their company" ON salary_records;
DROP POLICY IF EXISTS "Users can update salary records for their company" ON salary_records;
DROP POLICY IF EXISTS "Users can delete salary records for their company" ON salary_records;
DROP POLICY IF EXISTS "salary_records_select" ON salary_records;
DROP POLICY IF EXISTS "salary_records_insert" ON salary_records;
DROP POLICY IF EXISTS "salary_records_update" ON salary_records;
DROP POLICY IF EXISTS "salary_records_delete" ON salary_records;

CREATE POLICY "salary_records_select" ON salary_records FOR SELECT
  USING (is_company_member(company_id));
CREATE POLICY "salary_records_insert" ON salary_records FOR INSERT
  WITH CHECK (is_company_member(company_id));
CREATE POLICY "salary_records_update" ON salary_records FOR UPDATE
  USING (is_company_member(company_id));
CREATE POLICY "salary_records_delete" ON salary_records FOR DELETE
  USING (is_company_member(company_id));

-- ============================================
-- 23. COMPANY_MEMBERS — ИСПРАВЛЯЕМ РЕКУРСИЮ
-- ============================================

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_members_all" ON company_members;
DROP POLICY IF EXISTS "company_members_select" ON company_members;
DROP POLICY IF EXISTS "company_members_insert" ON company_members;
DROP POLICY IF EXISTS "company_members_update" ON company_members;
DROP POLICY IF EXISTS "company_members_delete" ON company_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON company_members;
DROP POLICY IF EXISTS "Users can insert own memberships" ON company_members;
DROP POLICY IF EXISTS "Owners and admins can manage members" ON company_members;

-- SELECT: Видим свои записи ИЛИ записи компаний где мы активные члены
-- Используем check_company_access (SECURITY DEFINER) чтобы избежать рекурсии RLS
CREATE POLICY "company_members_select" ON company_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    check_company_access(company_id)
  );

-- INSERT: Себя как владельца при создании компании ИЛИ admin/owner
CREATE POLICY "company_members_insert" ON company_members FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role = 'owner')
    OR
    check_company_access(company_id, 'owner')
    OR
    check_company_access(company_id, 'admin')
  );

-- UPDATE: Только admin/owner
CREATE POLICY "company_members_update" ON company_members FOR UPDATE
  TO authenticated
  USING (
    check_company_access(company_id, 'owner')
    OR
    check_company_access(company_id, 'admin')
  );

-- DELETE: Только owner
CREATE POLICY "company_members_delete" ON company_members FOR DELETE
  TO authenticated
  USING (
    check_company_access(company_id, 'owner')
  );

-- ============================================
-- 24. PROFILES — ОСТАВЛЯЕМ КАК ЕСТЬ (user-bound)
-- ============================================
-- profiles привязаны к auth.users, company_id не нужен

-- ============================================
-- 25. COMPANIES — ПЕРЕПРОВЕРЯЕМ
-- ============================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view their company" ON companies;
DROP POLICY IF EXISTS "Company owners and admins can update" ON companies;
DROP POLICY IF EXISTS "companies_select" ON companies;
DROP POLICY IF EXISTS "companies_update" ON companies;

CREATE POLICY "companies_select" ON companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = companies.id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "companies_update" ON companies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = companies.id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

-- ============================================
-- 26. ПЕРЕПРОВЕРКА: ВСЕ ОСНОВНЫЕ ТАБЛИЦЫ
-- ============================================
-- Убеждаемся, что RLS включён на всех таблицах

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'profiles', 'categories', 'equipment', 'customers', 'estimates', 'estimate_items',
    'templates', 'template_items', 'staff', 'goals', 'checklist_rules', 'checklist_rule_items',
    'checklists', 'checklist_items', 'companies', 'company_members', 'company_bank_accounts',
    'company_yandex_disk', 'contracts', 'contract_estimates', 'contract_templates',
    'invoices', 'acts', 'act_items', 'expenses', 'income', 'income_manual_entries',
    'payroll_entries', 'salary_payments', 'salary_records', 'cable_categories',
    'cable_inventory', 'cable_movements', 'equipment_repairs', 'equipment_kits',
    'kit_items', 'audit_logs', 'user_permissions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

-- ============================================
-- ПРОВЕРКА РЕЗУЛЬТАТОВ
-- ============================================

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE pg_policies.tablename = schemaname || '.' || tablename) AS policy_count
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'profiles', 'categories', 'equipment', 'customers', 'estimates', 'estimate_items',
  'templates', 'template_items', 'staff', 'goals', 'checklist_rules', 'checklist_rule_items',
  'checklists', 'checklist_items', 'companies', 'company_members', 'company_bank_accounts',
  'company_yandex_disk', 'contracts', 'contract_estimates', 'contract_templates',
  'invoices', 'acts', 'act_items', 'expenses', 'income', 'income_manual_entries',
  'payroll_entries', 'salary_payments', 'salary_records', 'cable_categories',
  'cable_inventory', 'cable_movements', 'equipment_repairs', 'equipment_kits',
  'kit_items', 'audit_logs', 'user_permissions'
)
ORDER BY tablename;
