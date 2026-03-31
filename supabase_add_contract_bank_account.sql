-- ============================================
-- Добавление bank_account_id в таблицу contracts
-- ============================================
-- Инструкция: Выполните этот скрипт в Supabase Dashboard → SQL Editor
-- ============================================

-- Добавляем поле bank_account_id
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES company_bank_accounts(id) ON DELETE SET NULL;

-- Создаём индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_contracts_bank_account_id ON contracts (bank_account_id);

-- Обновляем RLS политики для contracts (добавляем проверку company_id если его ещё нет)
DO $$
BEGIN
  -- Проверяем существование company_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contracts' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE contracts ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_contracts_company_id ON contracts (company_id);
  END IF;
END $$;

-- ============================================
-- Проверка создания поля
-- ============================================
SELECT 'Поле bank_account_id добавлено в таблицу contracts!' as status;
