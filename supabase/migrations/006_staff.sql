-- Таблица сотрудников
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    position TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    birth_date DATE,
    passport_series TEXT,
    passport_number TEXT,
    passport_issued_by TEXT,
    passport_issue_date DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_staff_user ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff(is_active);
CREATE INDEX IF NOT EXISTS idx_staff_name ON staff(full_name);

-- RLS Policies
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own staff"
    ON staff FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own staff"
    ON staff FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own staff"
    ON staff FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own staff"
    ON staff FOR DELETE
    USING (auth.uid() = user_id);
