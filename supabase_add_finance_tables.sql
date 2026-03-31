-- =====================================================
-- Миграция: Добавление таблиц для модуля "Финансы"
-- =====================================================

-- 1. Таблица доходов (ручные поступления + привязка к сметам)
CREATE TABLE IF NOT EXISTS income (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL, -- если доход от сметы
    source TEXT NOT NULL, -- название источника (например: "Аренда оборудования", "Консультация")
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'manual' CHECK (type IN ('estimate', 'manual')), -- estimate = от сметы, manual = ручное
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Таблица расходов
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('equipment', 'repair', 'supplies', 'subrent', 'rent', 'fuel', 'other')),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    receipt_url TEXT, -- ссылка на чек/документ (опционально)
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Таблица зарплатных начислений (проекты сотрудников)
CREATE TABLE IF NOT EXISTS payroll_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- формат: YYYY-MM (например: 2026-03)
    project_name TEXT NOT NULL, -- название проекта/мероприятия
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    project_date DATE, -- дата мероприятия
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(staff_id, month, project_name) -- один проект один раз в месяц
);

-- 4. Таблица выплат зарплат
CREATE TABLE IF NOT EXISTS salary_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- формат: YYYY-MM
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_type TEXT DEFAULT 'regular' CHECK (payment_type IN ('regular', 'advance', 'bonus')), -- regular = зарплата, advance = аванс, bonus = премия
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_income_company ON income(company_id);
CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
CREATE INDEX IF NOT EXISTS idx_income_estimate ON income(estimate_id);
CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_payroll_staff ON payroll_entries(staff_id);
CREATE INDEX IF NOT EXISTS idx_payroll_month ON payroll_entries(month);
CREATE INDEX IF NOT EXISTS idx_salary_payments_staff ON salary_payments(staff_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_month ON salary_payments(month);

-- 6. Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_income_updated_at ON income;
CREATE TRIGGER update_income_updated_at BEFORE UPDATE ON income
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payroll_entries_updated_at ON payroll_entries;
CREATE TRIGGER update_payroll_entries_updated_at BEFORE UPDATE ON payroll_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. RLS Политики (Row Level Security)

-- Включаем RLS
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;

-- Политика: пользователи видят только данные своей компании
DROP POLICY IF EXISTS "income_company_isolation" ON income;
CREATE POLICY "income_company_isolation" ON income
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM company_members 
            WHERE company_id = income.company_id 
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "expenses_company_isolation" ON expenses;
CREATE POLICY "expenses_company_isolation" ON expenses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM company_members 
            WHERE company_id = expenses.company_id 
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "payroll_company_isolation" ON payroll_entries;
CREATE POLICY "payroll_company_isolation" ON payroll_entries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM company_members 
            WHERE company_id = payroll_entries.company_id 
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "salary_payments_company_isolation" ON salary_payments;
CREATE POLICY "salary_payments_company_isolation" ON salary_payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM company_members 
            WHERE company_id = salary_payments.company_id 
            AND user_id = auth.uid()
        )
    );

-- 8. Представление (VIEW) для сводной таблицы зарплат
CREATE OR REPLACE VIEW salary_summary AS
SELECT 
    sp.company_id,
    sp.staff_id,
    sp.month,
    s.full_name as staff_name,
    s.position,
    COALESCE(pe.total_calculated, 0) as total_calculated,
    COALESCE(sp2.total_paid, 0) as total_paid,
    COALESCE(pe.total_calculated, 0) - COALESCE(sp2.total_paid, 0) as balance
FROM (
    SELECT DISTINCT company_id, staff_id, month FROM payroll_entries
    UNION
    SELECT DISTINCT company_id, staff_id, month FROM salary_payments
) sp
LEFT JOIN staff s ON s.id = sp.staff_id
LEFT JOIN (
    SELECT staff_id, month, SUM(amount) as total_calculated 
    FROM payroll_entries 
    GROUP BY staff_id, month
) pe ON pe.staff_id = sp.staff_id AND pe.month = sp.month
LEFT JOIN (
    SELECT staff_id, month, SUM(amount) as total_paid 
    FROM salary_payments 
    GROUP BY staff_id, month
) sp2 ON sp2.staff_id = sp.staff_id AND sp2.month = sp.month;

-- 9. Представление для финансовой сводки по месяцам
CREATE OR REPLACE VIEW monthly_finance_summary AS
SELECT 
    company_id,
    date_trunc('month', date) as month,
    SUM(CASE WHEN type = 'estimate' THEN amount ELSE 0 END) as income_from_estimates,
    SUM(CASE WHEN type = 'manual' THEN amount ELSE 0 END) as income_manual,
    SUM(amount) as total_income
FROM income
GROUP BY company_id, date_trunc('month', date);

COMMENT ON TABLE income IS 'Доходы компании (от смет и ручные поступления)';
COMMENT ON TABLE expenses IS 'Расходы компании по категориям';
COMMENT ON TABLE payroll_entries IS 'Начисления зарплат (сдельная оплата по проектам)';
COMMENT ON TABLE salary_payments IS 'Выплаты зарплат сотрудникам';
