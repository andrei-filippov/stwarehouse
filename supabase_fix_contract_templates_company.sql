-- Добавление company_id в таблицу contract_templates
-- для фильтрации шаблонов по компании

-- 1. Добавляем колонку company_id (если её нет)
ALTER TABLE contract_templates 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 2. Создаём индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_contract_templates_company_id ON contract_templates(company_id);

-- 3. Обновляем существующие записи - привязываем к компании создателя
-- (если есть записи без company_id)
UPDATE contract_templates 
SET company_id = (
  SELECT cm.company_id 
  FROM company_members cm 
  WHERE cm.user_id = contract_templates.user_id 
  LIMIT 1
)
WHERE company_id IS NULL;

-- 4. Добавляем RLS политики для защиты данных
-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "Users can view contract templates" ON contract_templates;
DROP POLICY IF EXISTS "Users can insert contract templates" ON contract_templates;
DROP POLICY IF EXISTS "Users can update contract templates" ON contract_templates;
DROP POLICY IF EXISTS "Users can delete contract templates" ON contract_templates;

-- Политика: просмотр (только своя компания)
CREATE POLICY "Users can view contract templates"
  ON contract_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = contract_templates.company_id
      AND cm.user_id = auth.uid()
    )
  );

-- Политика: вставка (только своя компания)
CREATE POLICY "Users can insert contract templates"
  ON contract_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = contract_templates.company_id
      AND cm.user_id = auth.uid()
    )
  );

-- Политика: обновление (только своя компания)
CREATE POLICY "Users can update contract templates"
  ON contract_templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = contract_templates.company_id
      AND cm.user_id = auth.uid()
    )
  );

-- Политика: удаление (только своя компания)
CREATE POLICY "Users can delete contract templates"
  ON contract_templates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = contract_templates.company_id
      AND cm.user_id = auth.uid()
    )
  );

-- 5. Включаем RLS (если ещё не включен)
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

-- 6. Комментарий
COMMENT ON COLUMN contract_templates.company_id IS 'ID компании для мультитенантности';
