-- Добавляем колонку для хранения имени выдавшего (т.к. issued_by имеет тип UUID)
ALTER TABLE cable_movements ADD COLUMN IF NOT EXISTS issued_by_name TEXT;

-- Обновляем существующие записи: копируем имена из profiles, где issued_by — валидный UUID
DO $$
BEGIN
  UPDATE cable_movements cm
  SET issued_by_name = p.full_name
  FROM profiles p
  WHERE cm.issued_by = p.id::uuid
    AND (cm.issued_by_name IS NULL OR cm.issued_by_name = '');
END $$;
