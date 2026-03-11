-- ============================================
-- Перенос ВСЕХ данных в Общую компанию (все таблицы)
-- ============================================

-- 1. Переносим шаблоны договоров
UPDATE contract_templates 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');

-- 2. Переносим правила чек-листов
UPDATE checklist_rules 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');

-- 3. Переносим позиции правил чек-листов
UPDATE checklist_rule_items 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');

-- 4. Переносим чек-листы
UPDATE checklists 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');

-- 5. Переносим позиции чек-листов
UPDATE checklist_items 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');

-- 6. Кабели (если есть)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cable_categories') THEN
    UPDATE cable_categories 
    SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
    WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cable_inventory') THEN
    UPDATE cable_inventory 
    SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
    WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cable_movements') THEN
    UPDATE cable_movements 
    SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
    WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
  END IF;
END $$;

-- 7. Все остальные таблицы
UPDATE contract_templates SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE templates SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE template_items SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE customers SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE contracts SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE invoices SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE acts SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE act_items SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE expenses SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE goals SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE staff SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE categories SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE equipment SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE estimates SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE estimate_items SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');
UPDATE contract_estimates SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');

-- Удаляем членов компании
DELETE FROM company_members WHERE company_id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');

-- Удаляем компании
DELETE FROM companies WHERE id IN ('8ed7be07-4954-4d11-a829-0becf3d2a8ba', '27ab0fa2-05e5-41d9-94c3-57e667850296');

-- Проверяем
SELECT id, name FROM companies;
