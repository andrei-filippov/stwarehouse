-- Таблица правил для чек-листов
CREATE TABLE IF NOT EXISTS checklist_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    condition_type TEXT NOT NULL CHECK (condition_type IN ('category', 'equipment')),
    condition_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица элементов правил
CREATE TABLE IF NOT EXISTS checklist_rule_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES checklist_rules(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    category TEXT NOT NULL DEFAULT 'tool' CHECK (category IN ('tool', 'cable', 'accessory', 'other')),
    is_required BOOLEAN DEFAULT true
);

-- Таблица чек-листов
CREATE TABLE IF NOT EXISTS checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL,
    event_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица элементов чек-листа
CREATE TABLE IF NOT EXISTS checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('tool', 'cable', 'accessory', 'other')),
    is_required BOOLEAN DEFAULT true,
    is_checked BOOLEAN DEFAULT false,
    source_rule_id UUID REFERENCES checklist_rules(id) ON DELETE SET NULL,
    notes TEXT
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_checklist_rules_user ON checklist_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_rule_items_rule ON checklist_rule_items(rule_id);
CREATE INDEX IF NOT EXISTS idx_checklists_estimate ON checklists(estimate_id);
CREATE INDEX IF NOT EXISTS idx_checklists_user ON checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON checklist_items(checklist_id);

-- RLS Policies
ALTER TABLE checklist_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_rule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- Policies для checklist_rules
CREATE POLICY "Users can view own rules"
    ON checklist_rules FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rules"
    ON checklist_rules FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rules"
    ON checklist_rules FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rules"
    ON checklist_rules FOR DELETE
    USING (auth.uid() = user_id);

-- Policies для checklist_rule_items
CREATE POLICY "Users can view items of own rules"
    ON checklist_rule_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM checklist_rules 
            WHERE checklist_rules.id = checklist_rule_items.rule_id 
            AND checklist_rules.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert items to own rules"
    ON checklist_rule_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM checklist_rules 
            WHERE checklist_rules.id = checklist_rule_items.rule_id 
            AND checklist_rules.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete items of own rules"
    ON checklist_rule_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM checklist_rules 
            WHERE checklist_rules.id = checklist_rule_items.rule_id 
            AND checklist_rules.user_id = auth.uid()
        )
    );

-- Policies для checklists
CREATE POLICY "Users can view own checklists"
    ON checklists FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checklists"
    ON checklists FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checklists"
    ON checklists FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own checklists"
    ON checklists FOR DELETE
    USING (auth.uid() = user_id);

-- Policies для checklist_items
CREATE POLICY "Users can view items of own checklists"
    ON checklist_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM checklists 
            WHERE checklists.id = checklist_items.checklist_id 
            AND checklists.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert items to own checklists"
    ON checklist_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM checklists 
            WHERE checklists.id = checklist_items.checklist_id 
            AND checklists.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update items of own checklists"
    ON checklist_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM checklists 
            WHERE checklists.id = checklist_items.checklist_id 
            AND checklists.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete items of own checklists"
    ON checklist_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM checklists 
            WHERE checklists.id = checklist_items.checklist_id 
            AND checklists.user_id = auth.uid()
        )
    );
