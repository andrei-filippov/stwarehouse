-- ============================================
-- Исправление функций get_next_invoice_number и get_next_act_number
-- ============================================

-- Удаляем старые функции
DROP FUNCTION IF EXISTS get_next_invoice_number(INTEGER);
DROP FUNCTION IF EXISTS get_next_act_number(INTEGER);

-- ============================================
-- Функция для генерации номера счета
-- ============================================
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
    -- Формат номера: XXX-YYYY (например: 001-2024)
    SELECT number INTO v_last_number
    FROM invoices
    WHERE EXTRACT(YEAR FROM date) = p_year
      AND number ~ '^[0-9]{3}-[0-9]{4}$'  -- regex для формата XXX-YYYY
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
-- Функция для генерации номера акта
-- ============================================
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
    -- Формат номера: XXX-YYYYA (например: 001-2024A)
    SELECT number INTO v_last_number
    FROM acts
    WHERE EXTRACT(YEAR FROM date) = p_year
      AND number ~ '^[0-9]{3}-[0-9]{4}A$'  -- regex для формата XXX-YYYYA
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
