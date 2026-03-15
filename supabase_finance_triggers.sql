-- =====================================================
-- Триггеры для автоматизации финансового учета
-- =====================================================

-- 1. Функция: автоматически создавать доход при изменении статуса сметы на 'completed'
CREATE OR REPLACE FUNCTION create_income_on_estimate_completed()
RETURNS TRIGGER AS $$
BEGIN
    -- Если статус изменился на 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Проверяем, нет ли уже дохода для этой сметы
        IF NOT EXISTS (
            SELECT 1 FROM income 
            WHERE estimate_id = NEW.id AND type = 'estimate'
        ) THEN
            INSERT INTO income (
                company_id,
                estimate_id,
                source,
                amount,
                date,
                description,
                type,
                created_by
            ) VALUES (
                NEW.company_id,
                NEW.id,
                'Смета: ' || COALESCE(NEW.event_name, 'Без названия'),
                COALESCE(NEW.total, 0),
                COALESCE(NEW.event_date::date, CURRENT_DATE),
                'Автоматическое создание при завершении сметы',
                'estimate',
                NEW.user_id
            );
        END IF;
    END IF;
    
    -- Если статус изменился с 'completed' на другой - удаляем доход
    IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
        DELETE FROM income 
        WHERE estimate_id = NEW.id AND type = 'estimate';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS estimate_completed_income ON estimates;
CREATE TRIGGER estimate_completed_income
    AFTER UPDATE ON estimates
    FOR EACH ROW
    EXECUTE FUNCTION create_income_on_estimate_completed();

-- 2. Функция: автоматически обновлять доход при изменении суммы сметы
CREATE OR REPLACE FUNCTION update_income_on_estimate_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем сумму дохода если смета завершена и изменилась сумма
    IF NEW.status = 'completed' AND NEW.total IS DISTINCT FROM OLD.total THEN
        UPDATE income 
        SET amount = COALESCE(NEW.total, 0),
            updated_at = NOW()
        WHERE estimate_id = NEW.id AND type = 'estimate';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS estimate_change_income ON estimates;
CREATE TRIGGER estimate_change_income
    AFTER UPDATE ON estimates
    FOR EACH ROW
    EXECUTE FUNCTION update_income_on_estimate_change();

-- 3. Функция: проверка баланса перед выплатой зарплаты
CREATE OR REPLACE FUNCTION check_salary_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_total_calculated DECIMAL(12,2);
    v_total_paid DECIMAL(12,2);
    v_balance DECIMAL(12,2);
BEGIN
    -- Получаем сумму начислений за месяц
    SELECT COALESCE(SUM(amount), 0) INTO v_total_calculated
    FROM payroll_entries
    WHERE staff_id = NEW.staff_id AND month = NEW.month;
    
    -- Получаем сумму уже выплаченного
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM salary_payments
    WHERE staff_id = NEW.staff_id AND month = NEW.month;
    
    v_balance := v_total_calculated - v_total_paid;
    
    -- Если пытаемся выплатить больше чем начислено (кроме аванса)
    IF NEW.payment_type != 'advance' AND NEW.amount > v_balance THEN
        RAISE EXCEPTION 'Выплата (%) превышает остаток (%)', NEW.amount, v_balance;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS salary_payment_check ON salary_payments;
CREATE TRIGGER salary_payment_check
    BEFORE INSERT ON salary_payments
    FOR EACH ROW
    EXECUTE FUNCTION check_salary_payment();

-- 4. Представление для детального отчета по зарплате сотрудника
CREATE OR REPLACE VIEW payroll_details AS
SELECT 
    pe.id,
    pe.company_id,
    pe.staff_id,
    s.full_name as staff_name,
    s.position,
    pe.month,
    pe.project_name,
    pe.amount as project_amount,
    pe.project_date,
    pe.notes,
    pe.created_at
FROM payroll_entries pe
JOIN staff s ON s.id = pe.staff_id;

-- 5. Представление для полной финансовой отчетности
CREATE OR REPLACE VIEW financial_report AS
WITH monthly_income AS (
    SELECT 
        company_id,
        date_trunc('month', date) as month,
        SUM(amount) as total_income
    FROM income
    GROUP BY company_id, date_trunc('month', date)
),
monthly_expenses AS (
    SELECT 
        company_id,
        date_trunc('month', date) as month,
        SUM(amount) as total_expenses
    FROM expenses
    GROUP BY company_id, date_trunc('month', date)
),
monthly_salary AS (
    SELECT 
        company_id,
        date_trunc('month', (month || '-01')::date) as month,
        SUM(amount) as total_salary_paid
    FROM salary_payments
    GROUP BY company_id, date_trunc('month', (month || '-01')::date)
)
SELECT 
    COALESCE(i.company_id, e.company_id, s.company_id) as company_id,
    COALESCE(i.month, e.month, s.month) as month,
    COALESCE(i.total_income, 0) as income,
    COALESCE(e.total_expenses, 0) as expenses,
    COALESCE(s.total_salary_paid, 0) as salary_paid,
    COALESCE(i.total_income, 0) - COALESCE(e.total_expenses, 0) - COALESCE(s.total_salary_paid, 0) as profit
FROM monthly_income i
FULL OUTER JOIN monthly_expenses e ON i.company_id = e.company_id AND i.month = e.month
FULL OUTER JOIN monthly_salary s ON COALESCE(i.company_id, e.company_id) = s.company_id 
    AND COALESCE(i.month, e.month) = s.month
ORDER BY month DESC;

COMMENT ON FUNCTION create_income_on_estimate_completed() IS 'Автоматически создает запись дохода при завершении сметы';
COMMENT ON FUNCTION check_salary_payment() IS 'Проверяет что выплата не превышает начисленную сумму';
