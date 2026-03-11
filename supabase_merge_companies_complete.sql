-- ============================================
-- Перенос ВСЕХ данных в Общую компанию (полная версия)
-- ============================================

-- 1. Переносим шаблоны договоров
UPDATE contract_templates 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 2. Переносим шаблоны
UPDATE templates 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 3. Переносим позиции шаблонов
UPDATE template_items 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 4. Переносим заказчиков
UPDATE customers 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 5. Переносим договоры
UPDATE contracts 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 6. Переносим счета
UPDATE invoices 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 7. Переносим акты
UPDATE acts 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 8. Переносим позиции актов
UPDATE act_items 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 9. Переносим расходы
UPDATE expenses 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 10. Переносим задачи/цели
UPDATE goals 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 11. Переносим сотрудников
UPDATE staff 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 12. Переносим категории
UPDATE categories 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 13. Переносим оборудование
UPDATE equipment 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 14. Переносим сметы
UPDATE estimates 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 15. Переносим позиции смет
UPDATE estimate_items 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 16. Переносим связи договоров и смет
UPDATE contract_estimates 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 17. Удаляем членов компании из старых компаний
DELETE FROM company_members 
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 18. Удаляем компании "Андрей" и "Николай"
DELETE FROM companies 
WHERE id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 19. Проверяем оставшиеся компании
SELECT 'Оставшиеся компании:' as info;
SELECT id, name FROM companies;
