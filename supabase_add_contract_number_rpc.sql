-- ============================================
-- RPC функция для генерации номера договора
-- ============================================
-- Инструкция: Выполните этот скрипт в Supabase Dashboard → SQL Editor
-- ============================================

-- Функция для получения следующего номера договора
CREATE OR REPLACE FUNCTION get_next_contract_number(p_year INTEGER, p_type TEXT)
RETURNS TEXT AS $$
DECLARE
  v_max_number INTEGER;
  v_type_code TEXT;
  v_result TEXT;
BEGIN
  -- Определяем код типа договора
  v_type_code := CASE p_type
    WHEN 'service' THEN 'У'
    WHEN 'rent' THEN 'А'
    WHEN 'supply' THEN 'П'
    WHEN 'mixed' THEN 'С'
    ELSE 'У'
  END;
  
  -- Ищем максимальный номер для данного года и типа
  -- Формат номера: XX-YY[Тип], где XX - порядковый номер, YY - год
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(number FROM '^[0-9]+') AS INTEGER
      )
    ),
    0
  )
  INTO v_max_number
  FROM contracts
  WHERE EXTRACT(YEAR FROM date) = p_year
    AND type = p_type
    AND number ~ '^[0-9]+-[0-9]+'  -- проверяем формат номера
    AND number LIKE '%-' || RIGHT(p_year::TEXT, 2) || v_type_code;
  
  -- Формируем следующий номер
  v_result := LPAD((v_max_number + 1)::TEXT, 2, '0') || '-' || RIGHT(p_year::TEXT, 2) || v_type_code;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Даём права на выполнение функции
GRANT EXECUTE ON FUNCTION get_next_contract_number(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_contract_number(INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_next_contract_number(INTEGER, TEXT) TO service_role;

-- ============================================
-- Проверка создания функции
-- ============================================
SELECT 'RPC функция get_next_contract_number создана успешно!' as status;
