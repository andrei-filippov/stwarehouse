-- Изменение значения по умолчанию для min_quantity с 5 на 0

ALTER TABLE cable_inventory 
ALTER COLUMN min_quantity SET DEFAULT 0;

-- Обновляем существующие записи где min_quantity = 5 (старое дефолтное) на 0
-- Только если это действительно было дефолтное значение и не было изменено вручную
-- UPDATE cable_inventory SET min_quantity = 0 WHERE min_quantity = 5;
