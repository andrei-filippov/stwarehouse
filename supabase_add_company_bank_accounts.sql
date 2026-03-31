-- ============================================
-- Таблица банковских счетов компании
-- ============================================
CREATE TABLE IF NOT EXISTS company_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Название счета (для отображения в списке)
  name TEXT NOT NULL,
  
  -- Банковские реквизиты
  bank_name TEXT NOT NULL,
  bik TEXT NOT NULL,
  account TEXT NOT NULL,
  corr_account TEXT,
  
  -- Валюта счета
  currency TEXT NOT NULL DEFAULT 'RUB',
  
  -- Статус
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Служебные поля
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Индексы
-- ============================================
CREATE INDEX IF NOT EXISTS idx_company_bank_accounts_company ON company_bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_company_bank_accounts_default ON company_bank_accounts(company_id, is_default);

-- ============================================
-- Триггер для обновления updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_company_bank_accounts_updated_at ON company_bank_accounts;
CREATE TRIGGER update_company_bank_accounts_updated_at
  BEFORE UPDATE ON company_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS политики
-- ============================================
ALTER TABLE company_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_bank_accounts_isolation" ON company_bank_accounts;
CREATE POLICY "company_bank_accounts_isolation" ON company_bank_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM company_members 
      WHERE company_id = company_bank_accounts.company_id 
      AND user_id = auth.uid()
    )
  );

-- ============================================
-- Функция: установить счет по умолчанию
-- ============================================
CREATE OR REPLACE FUNCTION set_default_bank_account()
RETURNS TRIGGER AS $$
BEGIN
  -- Если новый счет помечен как default, снимаем default с остальных
  IF NEW.is_default = true THEN
    UPDATE company_bank_accounts 
    SET is_default = false 
    WHERE company_id = NEW.company_id 
    AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_default_bank_account ON company_bank_accounts;
CREATE TRIGGER trigger_set_default_bank_account
  BEFORE INSERT OR UPDATE ON company_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION set_default_bank_account();

COMMENT ON TABLE company_bank_accounts IS 'Банковские счета компании';
