-- ============================================
-- Миграция: добавление updated_at в таблицы без него
-- для поддержки polling и оптимистичных обновлений
-- ============================================

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. profiles
-- ============================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. categories
-- ============================================
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. customers
-- ============================================
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. estimates
-- ============================================
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_estimates_updated_at ON estimates;
CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. estimate_items
-- ============================================
ALTER TABLE estimate_items 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_estimate_items_updated_at ON estimate_items;
CREATE TRIGGER update_estimate_items_updated_at
  BEFORE UPDATE ON estimate_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. templates
-- ============================================
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. template_items
-- ============================================
ALTER TABLE template_items 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_template_items_updated_at ON template_items;
CREATE TRIGGER update_template_items_updated_at
  BEFORE UPDATE ON template_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. checklist_rules
-- ============================================
ALTER TABLE checklist_rules 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_checklist_rules_updated_at ON checklist_rules;
CREATE TRIGGER update_checklist_rules_updated_at
  BEFORE UPDATE ON checklist_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. checklist_rule_items
-- ============================================
ALTER TABLE checklist_rule_items 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_checklist_rule_items_updated_at ON checklist_rule_items;
CREATE TRIGGER update_checklist_rule_items_updated_at
  BEFORE UPDATE ON checklist_rule_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. checklist_items
-- ============================================
ALTER TABLE checklist_items 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_checklist_items_updated_at ON checklist_items;
CREATE TRIGGER update_checklist_items_updated_at
  BEFORE UPDATE ON checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Обновляем существующие записи (проставляем текущее время)
-- ============================================
UPDATE profiles SET updated_at = NOW() WHERE updated_at IS NULL;
UPDATE categories SET updated_at = NOW() WHERE updated_at IS NULL;
UPDATE customers SET updated_at = NOW() WHERE updated_at IS NULL;
UPDATE estimates SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE estimate_items SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE templates SET updated_at = NOW() WHERE updated_at IS NULL;
UPDATE template_items SET updated_at = NOW() WHERE updated_at IS NULL;
UPDATE checklist_rules SET updated_at = NOW() WHERE updated_at IS NULL;
UPDATE checklist_rule_items SET updated_at = NOW() WHERE updated_at IS NULL;
UPDATE checklist_items SET updated_at = NOW() WHERE updated_at IS NULL;

SELECT 'updated_at добавлен во все таблицы' as status;
