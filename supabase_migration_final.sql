-- ============================================
-- Миграция: Исправление функций нумерации и добавление полей для банковских реквизитов
-- ============================================

-- ============================================
-- 1. Добавляем поле bank_account_id в contracts (если нужно выбирать конкретный счёт)
-- ============================================
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES company_bank_accounts(id);

COMMENT ON COLUMN contracts.bank_account_id IS 'ID банковского счета из company_bank_accounts для счетов/актов по договору';

-- ============================================
-- 2. Добавляем поля для реквизитов исполнителя (альтернативный вариант без привязки к company_bank_accounts)
-- ============================================
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS executor_bank_name TEXT,
ADD COLUMN IF NOT EXISTS executor_bik TEXT,
ADD COLUMN IF NOT EXISTS executor_bank_account TEXT,
ADD COLUMN IF NOT EXISTS executor_bank_corr_account TEXT;

COMMENT ON COLUMN contracts.executor_bank_name IS 'Название банка исполнителя (для счетов/актов)';
COMMENT ON COLUMN contracts.executor_bik IS 'БИК банка исполнителя';
COMMENT ON COLUMN contracts.executor_bank_account IS 'Расчетный счет исполнителя';
COMMENT ON COLUMN contracts.executor_bank_corr_account IS 'Корреспондентский счет банка исполнителя';

-- ============================================
-- 3. Исправляем функцию get_next_invoice_number
-- ============================================
DROP FUNCTION IF EXISTS get_next_invoice_number(INTEGER);

CREATE OR REPLACE FUNCTION get_next_invoice_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_last_number TEXT;
    v_sequence INTEGER;
    v_result TEXT;
BEGIN
    -- Находим последний номер счета за указанный год
    SELECT number INTO v_last_number
    FROM invoices
    WHERE EXTRACT(YEAR FROM date) = p_year
      AND number ~ '^[0-9]{3}-[0-9]{4}$'  -- формат: XXX-YYYY
    ORDER BY 
        CAST(SPLIT_PART(number, '-', 1) AS INTEGER) DESC,
        number DESC
    LIMIT 1;
    
    -- Если нет счетов, начинаем с 001
    IF v_last_number IS NULL THEN
        v_sequence := 1;
    ELSE
        -- Извлекаем номер из формата XXX-YYYY
        v_sequence := CAST(SPLIT_PART(v_last_number, '-', 1) AS INTEGER) + 1;
    END IF;
    
    -- Формируем новый номер
    v_result := LPAD(v_sequence::TEXT, 3, '0') || '-' || p_year::TEXT;
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_next_invoice_number(INTEGER) IS 'Генерирует следующий номер счета в формате XXX-YYYY';

-- ============================================
-- 4. Исправляем функцию get_next_act_number
-- ============================================
DROP FUNCTION IF EXISTS get_next_act_number(INTEGER);

CREATE OR REPLACE FUNCTION get_next_act_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_last_number TEXT;
    v_sequence INTEGER;
    v_result TEXT;
BEGIN
    -- Находим последний номер акта за указанный год
    SELECT number INTO v_last_number
    FROM acts
    WHERE EXTRACT(YEAR FROM date) = p_year
      AND number ~ '^[0-9]{3}-[0-9]{4}A$'  -- формат: XXX-YYYYA
    ORDER BY 
        CAST(SPLIT_PART(number, '-', 1) AS INTEGER) DESC,
        number DESC
    LIMIT 1;
    
    -- Если нет актов, начинаем с 001
    IF v_last_number IS NULL THEN
        v_sequence := 1;
    ELSE
        -- Извлекаем номер из формата XXX-YYYYA
        v_sequence := CAST(SPLIT_PART(v_last_number, '-', 1) AS INTEGER) + 1;
    END IF;
    
    -- Формируем новый номер
    v_result := LPAD(v_sequence::TEXT, 3, '0') || '-' || p_year::TEXT || 'A';
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_next_act_number(INTEGER) IS 'Генерирует следующий номер акта в формате XXX-YYYYA';
