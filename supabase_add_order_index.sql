-- Добавление колонки order_index в таблицы для хранения порядка элементов
-- Выполните этот скрипт в SQL Editor Supabase

-- ============================================
-- 1. Таблица estimate_items
-- ============================================
ALTER TABLE estimate_items 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_estimate_items_order_index ON estimate_items(estimate_id, order_index);

-- ============================================
-- 2. Таблица act_items
-- ============================================
ALTER TABLE act_items 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_act_items_order_index ON act_items(act_id, order_index);

-- ============================================
-- 3. Таблица template_items
-- ============================================
ALTER TABLE template_items 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_template_items_order_index ON template_items(template_id, order_index);

-- ============================================
-- 4. Таблица contract_estimates (связь договоров и смет)
-- ============================================
ALTER TABLE contract_estimates 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_contract_estimates_order_index ON contract_estimates(contract_id, order_index);

-- ============================================
-- Проверка результата
-- ============================================
SELECT 
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('estimate_items', 'act_items', 'template_items', 'contract_estimates')
  AND column_name = 'order_index'
ORDER BY table_name;
