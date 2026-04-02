-- ============================================
-- Исправление функции get_next_invoice_number
-- ============================================

-- Удаляем старую функцию
DROP FUNCTION IF EXISTS get_next_invoice_number(INTEGER);

-- Создаем новую функцию
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
      AND number ~ '^\d{3}-\d{4}$'  -- формат: 001-2024
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

-- Добавляем комментарий
COMMENT ON FUNCTION get_next_invoice_number(INTEGER) IS 'Генерирует следующий номер счета в формате XXX-YYYY';
