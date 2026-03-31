export type IncomeType = 'estimate' | 'manual';
export type ExpenseCategory = 'equipment' | 'repair' | 'supplies' | 'subrent' | 'rent' | 'fuel' | 'other';
export type PaymentType = 'regular' | 'advance' | 'bonus';

export interface Income {
  id: string;
  company_id: string;
  estimate_id?: string | null;
  source: string;
  amount: number;
  date: string;
  description?: string;
  type: IncomeType;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  company_id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string;
  receipt_url?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollEntry {
  id: string;
  company_id: string;
  staff_id: string;
  month: string; // YYYY-MM
  project_name: string;
  amount: number;
  project_date?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SalaryPayment {
  id: string;
  company_id: string;
  staff_id: string;
  month: string; // YYYY-MM
  amount: number;
  payment_date: string;
  payment_type: PaymentType;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface SalarySummary {
  company_id: string;
  staff_id: string;
  month: string;
  staff_name: string;
  position?: string;
  total_calculated: number;
  total_paid: number;
  balance: number;
}

export interface FinancialReport {
  company_id: string;
  month: string;
  income: number;
  expenses: number;
  salary_paid: number;
  profit: number;
}
