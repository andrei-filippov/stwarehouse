-- Интеграция чек-листов с QR-сканированием и двойной проверкой
-- Погрузка (loaded) + Разгрузка (unloaded)

-- Расширяем ChecklistItem для двойной проверки
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS inventory_id UUID; -- Связь с cable_inventory
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS qr_code TEXT; -- QR-код для сканирования
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS loaded BOOLEAN DEFAULT FALSE; -- Погружено
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS loaded_at TIMESTAMPTZ; -- Когда погружено
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS loaded_by TEXT; -- Кто погрузил
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS unloaded BOOLEAN DEFAULT FALSE; -- Разгружено
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS unloaded_at TIMESTAMPTZ; -- Когда разгружено
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS unloaded_by TEXT; -- Кто разгрузил
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS kit_id UUID; -- ID комплекта/кофра (если в кофре)

-- Таблица комплектов/кофров (Kit/Case)
CREATE TABLE IF NOT EXISTS equipment_kits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Название комплекта (например "Кофр звук #1")
    qr_code TEXT UNIQUE, -- QR-код на кофре
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Связь комплектов с оборудованием
CREATE TABLE IF NOT EXISTS kit_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kit_id UUID REFERENCES equipment_kits(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES cable_inventory(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_checklist_items_inventory ON checklist_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_qr ON checklist_items(qr_code);
CREATE INDEX IF NOT EXISTS idx_checklist_items_kit ON checklist_items(kit_id);
CREATE INDEX IF NOT EXISTS idx_equipment_kits_company ON equipment_kits(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_kits_qr ON equipment_kits(qr_code);
CREATE INDEX IF NOT EXISTS idx_kit_items_kit ON kit_items(kit_id);

-- Политики безопасности для комплектов
ALTER TABLE equipment_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view kits in their company" 
    ON equipment_kits FOR SELECT 
    USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can create kits in their company" 
    ON equipment_kits FOR INSERT 
    WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update kits in their company" 
    ON equipment_kits FOR UPDATE 
    USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete kits in their company" 
    ON equipment_kits FOR DELETE 
    USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view kit items" 
    ON kit_items FOR SELECT 
    USING (kit_id IN (SELECT id FROM equipment_kits WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())));

CREATE POLICY "Users can manage kit items" 
    ON kit_items FOR ALL 
    USING (kit_id IN (SELECT id FROM equipment_kits WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())));

-- Функция для создания чек-листа из сметы с QR-кодами
CREATE OR REPLACE FUNCTION create_checklist_from_estimate_v2(
    p_estimate_id UUID,
    p_company_id UUID
) RETURNS UUID AS $$
DECLARE
    v_checklist_id UUID;
    v_estimate RECORD;
    v_item RECORD;
BEGIN
    -- Получаем данные сметы
    SELECT * INTO v_estimate FROM estimates WHERE id = p_estimate_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Estimate not found';
    END IF;

    -- Создаем чек-лист
    INSERT INTO checklists (estimate_id, user_id, event_name, event_date, notes)
    VALUES (p_estimate_id, auth.uid(), v_estimate.event_name, v_estimate.event_date, 'Автоматически создан из сметы')
    RETURNING id INTO v_checklist_id;

    -- Добавляем позиции из сметы со связью на cable_inventory через QR
    FOR v_item IN 
        SELECT 
            ei.name,
            ei.quantity,
            ei.category,
            ci.id as inventory_id,
            ci.qr_code
        FROM estimate_items ei
        LEFT JOIN cable_inventory ci ON LOWER(ci.name) = LOWER(ei.name) AND ci.company_id = p_company_id
        WHERE ei.estimate_id = p_estimate_id
    LOOP
        INSERT INTO checklist_items (
            checklist_id, 
            name, 
            quantity, 
            category, 
            is_required, 
            is_checked,
            inventory_id,
            qr_code,
            loaded,
            unloaded
        ) VALUES (
            v_checklist_id,
            v_item.name,
            v_item.quantity,
            v_item.category,
            TRUE,
            FALSE,
            v_item.inventory_id,
            v_item.qr_code,
            FALSE,
            FALSE
        );
    END LOOP;

    RETURN v_checklist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для отметки погрузки через QR
CREATE OR REPLACE FUNCTION mark_item_loaded(
    p_qr_code TEXT,
    p_checklist_id UUID
) RETURNS TABLE(item_name TEXT, already_loaded BOOLEAN) AS $$
DECLARE
    v_item RECORD;
BEGIN
    SELECT * INTO v_item 
    FROM checklist_items 
    WHERE qr_code = p_qr_code AND checklist_id = p_checklist_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item with QR code % not found in checklist', p_qr_code;
    END IF;
    
    IF v_item.loaded THEN
        RETURN QUERY SELECT v_item.name, TRUE;
        RETURN;
    END IF;
    
    UPDATE checklist_items 
    SET loaded = TRUE, 
        loaded_at = NOW(), 
        loaded_by = auth.uid()::text
    WHERE id = v_item.id;
    
    RETURN QUERY SELECT v_item.name, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для отметки разгрузки через QR
CREATE OR REPLACE FUNCTION mark_item_unloaded(
    p_qr_code TEXT,
    p_checklist_id UUID
) RETURNS TABLE(item_name TEXT, already_unloaded BOOLEAN) AS $$
DECLARE
    v_item RECORD;
BEGIN
    SELECT * INTO v_item 
    FROM checklist_items 
    WHERE qr_code = p_qr_code AND checklist_id = p_checklist_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item with QR code % not found in checklist', p_qr_code;
    END IF;
    
    IF v_item.unloaded THEN
        RETURN QUERY SELECT v_item.name, TRUE;
        RETURN;
    END IF;
    
    UPDATE checklist_items 
    SET unloaded = TRUE, 
        unloaded_at = NOW(), 
        unloaded_by = auth.uid()::text
    WHERE id = v_item.id;
    
    RETURN QUERY SELECT v_item.name, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для отметки всего комплекта
CREATE OR REPLACE FUNCTION mark_kit_loaded(
    p_kit_qr TEXT,
    p_checklist_id UUID
) RETURNS TABLE(item_count INTEGER) AS $$
DECLARE
    v_kit_id UUID;
    v_count INTEGER;
BEGIN
    SELECT id INTO v_kit_id FROM equipment_kits WHERE qr_code = p_kit_qr;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Kit with QR code % not found', p_kit_qr;
    END IF;
    
    -- Отмечаем все позиции из комплекта
    UPDATE checklist_items 
    SET loaded = TRUE, 
        loaded_at = NOW(), 
        loaded_by = auth.uid()::text
    WHERE checklist_id = p_checklist_id 
    AND kit_id = v_kit_id::text
    AND loaded = FALSE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Включаем Realtime для новых таблиц
ALTER TABLE equipment_kits REPLICA IDENTITY FULL;
ALTER TABLE kit_items REPLICA IDENTITY FULL;

-- Комментарии
COMMENT ON TABLE equipment_kits IS 'Комплекты/кофры оборудования для быстрой погрузки';
COMMENT ON TABLE kit_items IS 'Содержимое комплектов';
COMMENT ON COLUMN checklist_items.loaded IS 'Отмечено при погрузке';
COMMENT ON COLUMN checklist_items.unloaded IS 'Отмечено при разгрузке';
