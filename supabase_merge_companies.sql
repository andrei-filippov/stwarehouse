-- ============================================
-- Перенос сотрудников в Общую компанию и удаление лишних компаний
-- ============================================

-- 1. Переносим всех сотрудников из компаний "Андрей" и "Николай" в "Общую компанию"
UPDATE staff 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',  -- Андрей
    '27ab0fa2-05e5-41d9-94c3-57e667850296'   -- Николай
);

-- 2. Переносим категории
UPDATE categories 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 3. Переносим оборудование
UPDATE equipment 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 4. Переносим сметы
UPDATE estimates 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE company_id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 5. Проверяем что все перенесено
SELECT 'Сотрудники после переноса:' as info;
SELECT full_name, company_id FROM staff ORDER BY full_name;

-- 6. Удаляем компании "Андрей" и "Николай"
-- (это удалит также связанные записи из company_members)
DELETE FROM companies 
WHERE id IN (
    '8ed7be07-4954-4d11-a829-0becf3d2a8ba',
    '27ab0fa2-05e5-41d9-94c3-57e667850296'
);

-- 7. Проверяем оставшиеся компании
SELECT 'Оставшиеся компании:' as info;
SELECT id, name FROM companies;
