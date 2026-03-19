-- Копирование категорий и оборудования из вкладки "Оборудование" во вкладку "Учет оборудования"
-- Выполнить в SQL Editor Supabase

-- ============================================
-- 1. Копирование категорий
-- ============================================

-- Создаем временную таблицу для сопоставления старых и новых ID категорий
CREATE TEMP TABLE IF NOT EXISTS category_mapping (
    old_id UUID,
    new_id UUID,
    company_id UUID
);

-- Очищаем временную таблицу
TRUNCATE category_mapping;

-- Копируем категории (только те, которых еще нет в cable_categories)
INSERT INTO cable_categories (company_id, name, description, color, sort_order)
SELECT 
    c.company_id,
    c.name,
    c.description,
    '#3b82f6', -- Синий цвет по умолчанию
    c.sort_order
FROM categories c
WHERE NOT EXISTS (
    SELECT 1 FROM cable_categories cc 
    WHERE cc.company_id = c.company_id 
    AND cc.name = c.name
)
RETURNING id, name, company_id;

-- ============================================
-- 2. Копирование оборудования (без длины)
-- ============================================

-- Для каждой компании копируем оборудование
DO $$
DECLARE
    equip_record RECORD;
    target_category_id UUID;
    company_uuid UUID;
BEGIN
    -- Получаем список компаний
    FOR company_uuid IN 
        SELECT DISTINCT company_id FROM equipment WHERE company_id IS NOT NULL
    LOOP
        RAISE NOTICE 'Processing company: %', company_uuid;
        
        -- Для каждого оборудования в компании
        FOR equip_record IN 
            SELECT e.*, c.name as category_name
            FROM equipment e
            LEFT JOIN categories c ON e.category = c.name AND c.company_id = e.company_id
            WHERE e.company_id = company_uuid
            AND NOT EXISTS (
                SELECT 1 FROM cable_inventory ci
                JOIN cable_categories cc ON ci.category_id = cc.id
                WHERE cc.company_id = company_uuid
                AND ci.name = e.name
            )
        LOOP
            -- Ищем или создаем категорию
            SELECT id INTO target_category_id
            FROM cable_categories
            WHERE company_id = company_uuid
            AND name = COALESCE(equip_record.category_name, 'Оборудование')
            LIMIT 1;
            
            -- Если категория не найдена, создаем общую
            IF target_category_id IS NULL THEN
                INSERT INTO cable_categories (company_id, name, color, sort_order)
                VALUES (company_uuid, COALESCE(equip_record.category_name, 'Оборудование'), '#3b82f6', 0)
                RETURNING id INTO target_category_id;
                
                RAISE NOTICE 'Created category % for company %', COALESCE(equip_record.category_name, 'Оборудование'), company_uuid;
            END IF;
            
            -- Добавляем оборудование в инвентарь (без длины - только name)
            INSERT INTO cable_inventory (company_id, category_id, name, quantity, min_quantity, notes)
            VALUES (
                company_uuid,
                target_category_id,
                equip_record.name,
                GREATEST(equip_record.quantity, 0),
                0, -- min_quantity по умолчанию
                equip_record.description
            );
            
            RAISE NOTICE 'Copied equipment: % to category %', equip_record.name, target_category_id;
        END LOOP;
    END LOOP;
END $$;

-- ============================================
-- 3. Проверка результата
-- ============================================

SELECT 
    'Categories copied' as info,
    COUNT(*) as count
FROM cable_categories
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
    'Equipment items copied' as info,
    COUNT(*) as count
FROM cable_inventory
WHERE created_at > NOW() - INTERVAL '1 hour';

-- ============================================
-- 4. Показать что получилось
-- ============================================

SELECT 
    cc.name as category_name,
    ci.name as equipment_name,
    ci.quantity,
    ci.length,
    cc.company_id
FROM cable_inventory ci
JOIN cable_categories cc ON ci.category_id = cc.id
WHERE ci.created_at > NOW() - INTERVAL '1 hour'
ORDER BY cc.name, ci.name;
