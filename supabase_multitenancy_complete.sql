-- ============================================
-- Полная настройка мультиарендности (multitenancy)
-- Добавляет company_id во все таблицы
-- ============================================

-- ============================================
-- 1. Таблица estimate_items
-- ============================================
ALTER TABLE estimate_items 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

ALTER TABLE estimate_items 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_estimate_items_order_index ON estimate_items(estimate_id, order_index);
CREATE INDEX IF NOT EXISTS idx_estimate_items_company_id ON estimate_items(company_id);

-- Обновляем существующие записи
UPDATE estimate_items 
SET company_id = estimates.company_id
FROM estimates
WHERE estimate_items.estimate_id = estimates.id
  AND estimate_items.company_id IS NULL;

-- ============================================
-- 2. Таблица act_items (позиции актов)
-- ============================================
ALTER TABLE act_items 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

ALTER TABLE act_items 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_act_items_order_index ON act_items(act_id, order_index);
CREATE INDEX IF NOT EXISTS idx_act_items_company_id ON act_items(company_id);

-- Обновляем существующие записи
UPDATE act_items 
SET company_id = acts.company_id
FROM acts
WHERE act_items.act_id = acts.id
  AND act_items.company_id IS NULL;

-- ============================================
-- 3. Таблица template_items (позиции шаблонов)
-- ============================================
ALTER TABLE template_items 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

ALTER TABLE template_items 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_template_items_order_index ON template_items(template_id, order_index);
CREATE INDEX IF NOT EXISTS idx_template_items_company_id ON template_items(company_id);

-- Обновляем существующие записи
UPDATE template_items 
SET company_id = templates.company_id
FROM templates
WHERE template_items.template_id = templates.id
  AND template_items.company_id IS NULL;

-- ============================================
-- 4. Таблица contract_estimates (связь договоров и смет)
-- ============================================
ALTER TABLE contract_estimates 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_contract_estimates_company_id ON contract_estimates(company_id);

-- Обновляем существующие записи
UPDATE contract_estimates 
SET company_id = contracts.company_id
FROM contracts
WHERE contract_estimates.contract_id = contracts.id
  AND contract_estimates.company_id IS NULL;

-- ============================================
-- 5. Проверка результата
-- ============================================
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name IN ('estimate_items', 'act_items', 'template_items', 'contract_estimates')
  AND column_name IN ('company_id', 'order_index')
ORDER BY table_name, ordinal_position;
