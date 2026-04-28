// Типы для расходов

export type ExpenseCategory = 
  | 'equipment'      // Закуп оборудования
  | 'consumables'    // Закуп расходников
  | 'subrent'        // Субаренда
  | 'rent'           // Аренда
  | 'transport'      // Транспорт
  | 'taxes'          // Налоги
  | 'other';         // Прочее

export interface Expense {
  id: string;
  user_id?: string;
  company_id?: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  type?: 'expense' | 'income';
  created_at?: string;
  updated_at?: string;
}

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'equipment', label: 'Закуп оборудования' },
  { value: 'consumables', label: 'Закуп расходников' },
  { value: 'subrent', label: 'Субаренда' },
  { value: 'rent', label: 'Аренда' },
  { value: 'transport', label: 'Транспорт' },
  { value: 'taxes', label: 'Налоги' },
  { value: 'other', label: 'Прочее' },
];

export function getExpenseCategoryLabel(category: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find(c => c.value === category)?.label || category;
}
