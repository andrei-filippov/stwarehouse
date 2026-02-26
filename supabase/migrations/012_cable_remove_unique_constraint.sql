-- Удаление ограничения UNIQUE(category_id, length) 
-- чтобы можно было добавлять несколько кабелей одинаковой длины в одну категорию
-- Например: 1.2м обычный и 1.2м IP65, или две разные партии одного типа

-- Удаляем ограничение уникальности если оно существует
ALTER TABLE cable_inventory 
DROP CONSTRAINT IF EXISTS cable_inventory_category_id_length_key;

-- Дополнительно удаляем любые другие constraints с unique на этих колонках
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'cable_inventory' 
        AND tc.constraint_type = 'UNIQUE'
        AND ccu.column_name IN ('category_id', 'length')
    LIMIT 1;
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE cable_inventory DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END IF;
END $$;
