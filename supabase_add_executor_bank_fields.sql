-- ============================================
-- Добавление полей для реквизитов исполнителя в таблицу contracts
-- ============================================

-- Добавляем поля для банковских реквизитов исполнителя
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS executor_bank_name TEXT,
ADD COLUMN IF NOT EXISTS executor_bik TEXT,
ADD COLUMN IF NOT EXISTS executor_bank_account TEXT,
ADD COLUMN IF NOT EXISTS executor_bank_corr_account TEXT;

-- Добавляем комментарии к полям
COMMENT ON COLUMN contracts.executor_bank_name IS 'Название банка исполнителя для счетов/актов';
COMMENT ON COLUMN contracts.executor_bik IS 'БИК банка исполнителя';
COMMENT ON COLUMN contracts.executor_bank_account IS 'Расчетный счет исполнителя';
COMMENT ON COLUMN contracts.executor_bank_corr_account IS 'Корреспондентский счет банка исполнителя';
