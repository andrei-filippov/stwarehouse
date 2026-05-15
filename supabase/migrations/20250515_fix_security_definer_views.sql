-- Fix SECURITY DEFINER views - recreate with SECURITY INVOKER
-- This ensures views respect RLS policies of the querying user, not the creator

-- 1. salary_summary view
DROP VIEW IF EXISTS salary_summary;
CREATE OR REPLACE VIEW salary_summary
WITH (security_invoker = on)
AS
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

-- 2. monthly_finance_summary view
DROP VIEW IF EXISTS monthly_finance_summary;
CREATE OR REPLACE VIEW monthly_finance_summary
WITH (security_invoker = on)
AS
SELECT 
    company_id,
    date_trunc('month', date) as month,
    SUM(CASE WHEN type = 'estimate' THEN amount ELSE 0 END) as income_from_estimates,
    SUM(CASE WHEN type = 'manual' THEN amount ELSE 0 END) as income_manual,
    SUM(amount) as total_income
FROM income
GROUP BY company_id, date_trunc('month', date);

-- 3. payroll_details view
DROP VIEW IF EXISTS payroll_details;
CREATE OR REPLACE VIEW payroll_details
WITH (security_invoker = on)
AS
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

-- 4. financial_report view
DROP VIEW IF EXISTS financial_report;
CREATE OR REPLACE VIEW financial_report
WITH (security_invoker = on)
AS
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
    COALESCE(i.total_income, 0) as total_income,
    COALESCE(e.total_expenses, 0) as total_expenses,
    COALESCE(s.total_salary_paid, 0) as total_salary_paid,
    COALESCE(i.total_income, 0) - COALESCE(e.total_expenses, 0) - COALESCE(s.total_salary_paid, 0) as net_profit
FROM monthly_income i
FULL OUTER JOIN monthly_expenses e ON i.company_id = e.company_id AND i.month = e.month
FULL OUTER JOIN monthly_salary s ON COALESCE(i.company_id, e.company_id) = s.company_id 
    AND COALESCE(i.month, e.month) = s.month;

-- Also fix RPC functions that use SECURITY DEFINER - they need to be reviewed
-- For now, we add comments documenting why SECURITY DEFINER is used
COMMENT ON FUNCTION get_staff_salary_summary IS 'SECURITY DEFINER required for aggregated salary access across staff';
