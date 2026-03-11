-- ============================================
-- Привязка Пумпурса к общей компании
-- ============================================

UPDATE staff 
SET company_id = '08f8164e-d861-467a-be88-6108ea3650fd'::UUID
WHERE id = '09e8cbab-4d9c-4bee-b030-b6de5223c652';

-- Проверить
SELECT id, full_name, company_id FROM staff WHERE id = '09e8cbab-4d9c-4bee-b030-b6de5223c652';
