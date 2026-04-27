export type IncomeType = 'estimate' | 'manual';
export type ExpenseCategory = 'equipment' | 'repair' | 'supplies' | 'subrent' | 'rent' | 'fuel' | 'other';
export type PaymentType = 'regular' | 'advance' | 'bonus';

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  regular: 'Зарплата',
  advance: 'Аванс',
  bonus: 'Бонус',
};

export function getPaymentTypeLabel(type: PaymentType): string {
  return PAYMENT_TYPE_LABELS[type] || type;
}

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
