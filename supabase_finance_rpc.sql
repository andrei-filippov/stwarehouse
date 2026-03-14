-- =====================================================
-- RPC функции для работы с финансами
-- =====================================================

-- 1. Получить сводку по зарплате сотрудника за месяц
CREATE OR REPLACE FUNCTION get_staff_salary_summary(
    p_staff_id UUID,
    p_month TEXT
)
RETURNS TABLE (
    total_calculated DECIMAL,
    total_paid DECIMAL,
    balance DECIMAL,
    projects JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH calculated AS (
        SELECT COALESCE(SUM(amount), 0) as total
        FROM payroll_entries
        WHERE staff_id = p_staff_id AND month = p_month
    ),
    paid AS (
        SELECT COALESCE(SUM(amount), 0) as total
        FROM salary_payments
        WHERE staff_id = p_staff_id AND month = p_month
    ),
    project_list AS (
        SELECT json_agg(
            json_build_object(
                'id', id,
                'project_name', project_name,
                'amount', amount,
                'project_date', project_date,
                'notes', notes
            ) ORDER BY project_date
        ) as projects
        FROM payroll_entries
        WHERE staff_id = p_staff_id AND month = p_month
    )
    SELECT 
        c.total as total_calculated,
        p.total as total_paid,
        c.total - p.total as balance,
        COALESCE(pl.projects, '[]'::json) as projects
    FROM calculated c, paid p, project_list pl;
END;
$$;

-- 2. Получить финансовую сводку за период
CREATE OR REPLACE FUNCTION get_finance_summary(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    total_income DECIMAL,
    total_expenses DECIMAL,
    total_salary DECIMAL,
    profit DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH inc AS (
        SELECT COALESCE(SUM(amount), 0) as total
        FROM income
        WHERE company_id = p_company_id 
        AND date BETWEEN p_start_date AND p_end_date
    ),
    exp AS (
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expenses
        WHERE company_id = p_company_id 
        AND date BETWEEN p_start_date AND p_end_date
    ),
    sal AS (
        SELECT COALESCE(SUM(amount), 0) as total
        FROM salary_payments
        WHERE company_id = p_company_id 
        AND payment_date BETWEEN p_start_date AND p_end_date
    )
    SELECT 
        i.total as total_income,
        e.total as total_expenses,
        s.total as total_salary,
        i.total - e.total - s.total as profit
    FROM inc i, exp e, sal s;
END;
$$;

-- 3. Получить расходы по категориям за период
CREATE OR REPLACE FUNCTION get_expenses_by_category(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    category TEXT,
    total_amount DECIMAL,
    count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.category,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COUNT(*) as count
    FROM expenses e
    WHERE e.company_id = p_company_id 
    AND e.date BETWEEN p_start_date AND p_end_date
    GROUP BY e.category
    ORDER BY total_amount DESC;
END;
$$;

-- 4. Получить доходы по источникам за период
CREATE OR REPLACE FUNCTION get_income_by_source(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    type TEXT,
    source TEXT,
    total_amount DECIMAL,
    count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.type,
        CASE 
            WHEN i.type = 'estimate' THEN 'От смет'
            ELSE 'Ручные поступления'
        END as source,
        COALESCE(SUM(i.amount), 0) as total_amount,
        COUNT(*) as count
    FROM income i
    WHERE i.company_id = p_company_id 
    AND i.date BETWEEN p_start_date AND p_end_date
    GROUP BY i.type
    ORDER BY total_amount DESC;
END;
$$;

-- 5. Добавить начисление зарплаты с проверкой
CREATE OR REPLACE FUNCTION add_payroll_entry(
    p_company_id UUID,
    p_staff_id UUID,
    p_month TEXT,
    p_project_name TEXT,
    p_amount DECIMAL,
    p_project_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_entry_id UUID;
BEGIN
    -- Проверяем что сотрудник принадлежит компании
    IF NOT EXISTS (
        SELECT 1 FROM staff 
        WHERE id = p_staff_id AND company_id = p_company_id
    ) THEN
        RAISE EXCEPTION 'Сотрудник не найден или не принадлежит компании';
    END IF;
    
    INSERT INTO payroll_entries (
        company_id,
        staff_id,
        month,
        project_name,
        amount,
        project_date,
        notes,
        created_by
    ) VALUES (
        p_company_id,
        p_staff_id,
        p_month,
        p_project_name,
        p_amount,
        p_project_date,
        p_notes,
        auth.uid()
    )
    ON CONFLICT (staff_id, month, project_name) 
    DO UPDATE SET 
        amount = EXCLUDED.amount,
        project_date = EXCLUDED.project_date,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    RETURNING id INTO v_entry_id;
    
    RETURN v_entry_id;
END;
$$;

-- 6. Получить дашборд финансов (сводка за текущий месяц)
CREATE OR REPLACE FUNCTION get_finance_dashboard(
    p_company_id UUID
)
RETURNS TABLE (
    current_month_income DECIMAL,
    current_month_expenses DECIMAL,
    current_month_salary DECIMAL,
    current_month_profit DECIMAL,
    prev_month_income DECIMAL,
    prev_month_expenses DECIMAL,
    prev_month_salary DECIMAL,
    income_growth DECIMAL,
    expense_growth DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_month TEXT := to_char(CURRENT_DATE, 'YYYY-MM');
    v_prev_month TEXT := to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM');
BEGIN
    RETURN QUERY
    WITH current_month AS (
        SELECT 
            COALESCE(SUM(CASE WHEN i.month = v_current_month THEN i.amount ELSE 0 END), 0) as inc,
            COALESCE(SUM(CASE WHEN i.month = v_current_month THEN e.amount ELSE 0 END), 0) as exp,
            COALESCE(SUM(CASE WHEN i.month = v_current_month THEN s.amount ELSE 0 END), 0) as sal
        FROM (SELECT v_current_month as month) m
        LEFT JOIN income i ON date_trunc('month', i.date)::text = m.month AND i.company_id = p_company_id
        LEFT JOIN expenses e ON date_trunc('month', e.date)::text = m.month AND e.company_id = p_company_id
        LEFT JOIN salary_payments s ON s.month = m.month AND s.company_id = p_company_id
    ),
    prev_month AS (
        SELECT 
            COALESCE(SUM(CASE WHEN i.month = v_prev_month THEN i.amount ELSE 0 END), 0) as inc,
            COALESCE(SUM(CASE WHEN i.month = v_prev_month THEN e.amount ELSE 0 END), 0) as exp,
            COALESCE(SUM(CASE WHEN i.month = v_prev_month THEN s.amount ELSE 0 END), 0) as sal
        FROM (SELECT v_prev_month as month) m
        LEFT JOIN income i ON date_trunc('month', i.date)::text = m.month AND i.company_id = p_company_id
        LEFT JOIN expenses e ON date_trunc('month', e.date)::text = m.month AND e.company_id = p_company_id
        LEFT JOIN salary_payments s ON s.month = m.month AND s.company_id = p_company_id
    )
    SELECT 
        c.inc as current_month_income,
        c.exp as current_month_expenses,
        c.sal as current_month_salary,
        c.inc - c.exp - c.sal as current_month_profit,
        p.inc as prev_month_income,
        p.exp as prev_month_expenses,
        p.sal as prev_month_salary,
        CASE 
            WHEN p.inc = 0 THEN 100
            ELSE ROUND(((c.inc - p.inc) / p.inc * 100)::numeric, 2)
        END as income_growth,
        CASE 
            WHEN p.exp = 0 THEN 0
            ELSE ROUND(((c.exp - p.exp) / p.exp * 100)::numeric, 2)
        END as expense_growth
    FROM current_month c, prev_month p;
END;
$$;

COMMENT ON FUNCTION get_staff_salary_summary(UUID, TEXT) IS 'Получает сводку по зарплате сотрудника за месяц';
COMMENT ON FUNCTION get_finance_summary(UUID, DATE, DATE) IS 'Получает финансовую сводку за период';
COMMENT ON FUNCTION get_finance_dashboard(UUID) IS 'Получает данные для дашборда (текущий и прошлый месяц)';
