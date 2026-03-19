-- Копирование категорий и оборудования из вкладки "Оборудование" во вкладку "Учет оборудования"
-- Выполнить в SQL Editor Supabase

-- ============================================
-- 1. Копирование категорий
-- ============================================

-- Копируем категории (только те, которых еще нет в cable_categories)
INSERT INTO cable_categories (company_id, name, description, color, sort_order)
SELECT 
    c.company_id,
    c.name,
    NULL, -- description нет в исходной таблице
    '#3b82f6', -- Синий цвет по умолчанию
    0 -- sort_order по умолчанию
FROM categories c
WHERE c.company_id IS NOT NULL
AND NOT EXISTS (
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
    imported_count INTEGER := 0;
BEGIN
    -- Получаем список компаний
    FOR company_uuid IN 
        SELECT DISTINCT company_id FROM equipment WHERE company_id IS NOT NULL
    LOOP
        RAISE NOTICE 'Processing company: %', company_uuid;
        
        -- Для каждого оборудования в компании
        FOR equip_record IN 
            SELECT e.*
            FROM equipment e
            WHERE e.company_id = company_uuid
            AND NOT EXISTS (
                SELECT 1 FROM cable_inventory ci
                JOIN cable_categories cc ON ci.category_id = cc.id
                WHERE cc.company_id = company_uuid
                AND ci.name = e.name
            )
        LOOP
            -- Ищем категорию по имени (поле category в equipment - это текст)
            SELECT id INTO target_category_id
            FROM cable_categories
            WHERE company_id = company_uuid
            AND name = equip_record.category
            LIMIT 1;
            
            -- Если категория не найдена, создаем общую "Оборудование"
            IF target_category_id IS NULL THEN
                -- Проверяем существует ли уже такая категория
                SELECT id INTO target_category_id
                FROM cable_categories
                WHERE company_id = company_uuid
                AND name = COALESCE(NULLIF(equip_record.category, ''), 'Оборудование')
                LIMIT 1;
                
                -- Если не существует - создаем
                IF target_category_id IS NULL THEN
                    INSERT INTO cable_categories (company_id, name, color, sort_order)
                    VALUES (company_uuid, COALESCE(NULLIF(equip_record.category, ''), 'Оборудование'), '#3b82f6', 0)
                    RETURNING id INTO target_category_id;
                    
                    RAISE NOTICE 'Created category % for company %', COALESCE(NULLIF(equip_record.category, ''), 'Оборудование'), company_uuid;
                END IF;
            END IF;
            
            -- Добавляем оборудование в инвентарь (без длины - только name)
            IF target_category_id IS NOT NULL THEN
                INSERT INTO cable_inventory (company_id, category_id, name, quantity, min_quantity, notes)
                VALUES (
                    company_uuid,
                    target_category_id,
                    equip_record.name,
                    GREATEST(equip_record.quantity, 0),
                    0, -- min_quantity по умолчанию
                    equip_record.description
                );
                
                imported_count := imported_count + 1;
                RAISE NOTICE 'Copied equipment: % to category %', equip_record.name, target_category_id;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Total imported items: %', imported_count;
END $$;

-- ============================================
-- 3. Проверка результата
-- ============================================

SELECT 
    'Categories in cable_categories' as info,
    COUNT(*) as count
FROM cable_categories;

-- ============================================
-- 4. Показать что получилось
-- ============================================

SELECT 
    cc.name as category_name,
    ci.name as equipment_name,
    ci.quantity,
    ci.length,
    ci.notes,
    cc.company_id
FROM cable_inventory ci
JOIN cable_categories cc ON ci.category_id = cc.id
ORDER BY cc.name, ci.name
LIMIT 50;
