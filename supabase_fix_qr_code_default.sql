-- Миграция: автоматическая генерация QR-кода при вставке в cable_inventory
-- Это исправляет ситуацию, когда оборудование добавляется без явного указания qr_code
-- (например, из конструктора смет с опцией "на склад")

-- Убедимся, что функция генерации QR-кода существует
CREATE OR REPLACE FUNCTION generate_qr_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
  existing TEXT;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    result := 'EQ-' || result;
    SELECT qr_code INTO existing FROM cable_inventory WHERE qr_code = result;
    EXIT WHEN existing IS NULL;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Заполняем существующие записи без QR-кода
UPDATE cable_inventory
SET qr_code = generate_qr_code()
WHERE qr_code IS NULL;

-- Устанавливаем DEFAULT для автоматической генерации QR-кода при INSERT
ALTER TABLE cable_inventory
ALTER COLUMN qr_code SET DEFAULT generate_qr_code();

SELECT 'QR-код default установлен' as status;
