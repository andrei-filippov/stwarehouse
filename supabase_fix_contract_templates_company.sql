-- ============================================
-- Добавление company_id в таблицу contract_templates
-- ============================================
-- Инструкция: Выполните этот скрипт в Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Добавляем поле company_id
ALTER TABLE contract_templates 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 2. Создаём индекс
CREATE INDEX IF NOT EXISTS idx_contract_templates_company_id ON contract_templates (company_id);

-- 3. Обновляем существующие шаблоны - назначаем NULL (общие шаблоны)
-- или можно назначить конкретную компанию если известна
UPDATE contract_templates SET company_id = NULL WHERE company_id IS NULL;

-- ============================================
-- Проверка
-- ============================================
SELECT 'Поле company_id добавлено в таблицу contract_templates!' as status;
