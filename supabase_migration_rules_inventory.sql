-- Миграция: Обновление правил чек-листов для работы с реальным инвентарем
-- Дата: 2025-01-XX
-- Описание: Правила теперь ссылаются на cable_inventory вместо хранения текстовых названий

-- 1. Добавляем новые колонки в checklist_rule_items
ALTER TABLE checklist_rule_items 
ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES cable_inventory(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS inventory_name TEXT, -- Кэш названия для отображения
ADD COLUMN IF NOT EXISTS inventory_category TEXT, -- Кэш категории
ADD COLUMN IF NOT EXISTS inventory_qr_code TEXT; -- Кэш QR-кода

-- 2. Удаляем старую колонку category (если она не нужна)
-- ALTER TABLE checklist_rule_items DROP COLUMN IF EXISTS category;

-- 3. Обновляем политики RLS для новых колонок
-- Проверяем существование политик
DO $$
BEGIN
  -- Для SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'checklist_rule_items' 
    AND policyname = 'Users can view rule items in their company'
  ) THEN
    CREATE POLICY "Users can view rule items in their company"
      ON checklist_rule_items FOR SELECT
      USING (rule_id IN (
        SELECT id FROM checklist_rules WHERE company_id IN (
          SELECT company_id FROM company_members WHERE user_id = auth.uid()
        )
      ));
  END IF;

  -- Для INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'checklist_rule_items' 
    AND policyname = 'Users can insert rule items in their company'
  ) THEN
    CREATE POLICY "Users can insert rule items in their company"
      ON checklist_rule_items FOR INSERT
      WITH CHECK (rule_id IN (
        SELECT id FROM checklist_rules WHERE company_id IN (
          SELECT company_id FROM company_members WHERE user_id = auth.uid()
        )
      ));
  END IF;

  -- Для DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'checklist_rule_items' 
    AND policyname = 'Users can delete rule items in their company'
  ) THEN
    CREATE POLICY "Users can delete rule items in their company"
      ON checklist_rule_items FOR DELETE
      USING (rule_id IN (
        SELECT id FROM checklist_rules WHERE company_id IN (
          SELECT company_id FROM company_members WHERE user_id = auth.uid()
        )
      ));
  END IF;
END $$;

-- 4. Создаем индекс для быстрого поиска по inventory_id
CREATE INDEX IF NOT EXISTS idx_checklist_rule_items_inventory_id 
ON checklist_rule_items(inventory_id);

-- 5. Комментарии к колонкам
COMMENT ON COLUMN checklist_rule_items.inventory_id IS 'Ссылка на реальную позицию в cable_inventory';
COMMENT ON COLUMN checklist_rule_items.inventory_name IS 'Кэш названия для отображения (на случай если инвентарь изменится)';
COMMENT ON COLUMN checklist_rule_items.inventory_qr_code IS 'Кэш QR-кода для отображения';
