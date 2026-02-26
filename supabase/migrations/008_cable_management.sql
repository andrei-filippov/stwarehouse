-- Управление кабельным хозяйством (коммутация)

-- Категории кабелей (PowerCon, XLR, DMX, etc.)
CREATE TABLE IF NOT EXISTS cable_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- например: "PowerCon Link"
    description TEXT,
    color TEXT DEFAULT '#3b82f6', -- цвет для визуального различия
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Номенклатура: длина × количество
CREATE TABLE IF NOT EXISTS cable_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES cable_categories(id) ON DELETE CASCADE,
    length NUMERIC(10, 2) NOT NULL, -- длина в метрах (0.5, 1, 1.5, etc.)
    quantity INTEGER NOT NULL DEFAULT 0, -- всего на складе
    min_quantity INTEGER DEFAULT 0, -- минимальный остаток для алерта
    notes TEXT, -- комментарий (например: IP65, на шуко и т.д.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    -- Уникальность по (category_id, length, notes) добавляется в отдельной миграции
);

-- Движение: выдача и возврат
CREATE TABLE IF NOT EXISTS cable_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES cable_categories(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES cable_inventory(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('issue', 'return', 'write_off')),
    length NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    issued_to TEXT NOT NULL, -- кому выдано (свободный ввод)
    contact TEXT, -- контакт для связи
    issued_by UUID REFERENCES auth.users(id), -- кто оформил
    returned_at TIMESTAMP WITH TIME ZONE, -- когда вернули
    returned_quantity INTEGER DEFAULT 0, -- сколько вернули
    notes TEXT,
    is_returned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_cable_categories_user ON cable_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_cable_categories_order ON cable_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_cable_inventory_category ON cable_inventory(category_id);
CREATE INDEX IF NOT EXISTS idx_cable_movements_category ON cable_movements(category_id);
CREATE INDEX IF NOT EXISTS idx_cable_movements_issued_to ON cable_movements(issued_to);
CREATE INDEX IF NOT EXISTS idx_cable_movements_is_returned ON cable_movements(is_returned);

-- RLS Policies
ALTER TABLE cable_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cable_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE cable_movements ENABLE ROW LEVEL SECURITY;

-- Все видят все записи (для синхронизации между пользователями)
CREATE POLICY "Users can view all cable categories"
    ON cable_categories FOR SELECT USING (true);

CREATE POLICY "Users can view all cable inventory"
    ON cable_inventory FOR SELECT USING (true);

CREATE POLICY "Users can view all cable movements"
    ON cable_movements FOR SELECT USING (true);

-- CUD только для авторизованных
CREATE POLICY "Users can insert own categories"
    ON cable_categories FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
    ON cable_categories FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
    ON cable_categories FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can manage cable inventory"
    ON cable_inventory FOR ALL USING (true);

CREATE POLICY "Users can manage cable movements"
    ON cable_movements FOR ALL USING (true);

-- Realtime
ALTER TABLE cable_categories REPLICA IDENTITY FULL;
ALTER TABLE cable_inventory REPLICA IDENTITY FULL;
ALTER TABLE cable_movements REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'cable_categories'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE cable_categories;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'cable_inventory'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE cable_inventory;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'cable_movements'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE cable_movements;
    END IF;
END
$$;
