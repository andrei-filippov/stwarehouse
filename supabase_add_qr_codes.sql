-- Добавляем поле qr_code в cable_inventory

ALTER TABLE cable_inventory 
ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE;

-- Создаем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_cable_inventory_qr_code ON cable_inventory(qr_code);

-- Функция для генерации QR-кода
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
    
    -- Проверяем уникальность
    SELECT qr_code INTO existing FROM cable_inventory WHERE qr_code = result;
    EXIT WHEN existing IS NULL;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Генерируем QR-коды для существующего оборудования
UPDATE cable_inventory 
SET qr_code = generate_qr_code()
WHERE qr_code IS NULL;

-- Делаем поле обязательным (после заполнения)
-- ALTER TABLE cable_inventory ALTER COLUMN qr_code SET NOT NULL;

COMMENT ON COLUMN cable_inventory.qr_code IS 'Уникальный QR-код оборудования';

SELECT 'QR-коды добавлены' as status;
