-- Включение Realtime для таблиц кабельного учета
-- Это позволит всем пользователям видеть изменения в реальном времени

-- Включаем realtime для cable_inventory
ALTER TABLE cable_inventory REPLICA IDENTITY FULL;

-- Включаем realtime для cable_movements  
ALTER TABLE cable_movements REPLICA IDENTITY FULL;

-- Включаем realtime для equipment_repairs
ALTER TABLE equipment_repairs REPLICA IDENTITY FULL;

-- Включаем realtime для cable_categories
ALTER TABLE cable_categories REPLICA IDENTITY FULL;

-- Проверяем статус
SELECT 
    schemaname,
    tablename,
    publication_name
FROM pg_publication_tables
WHERE tablename IN ('cable_inventory', 'cable_movements', 'equipment_repairs', 'cable_categories');
