export type Target = {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  priority: 'high' | 'medium' | 'low';
  allocation_percent: number;
  status: 'active' | 'completed' | 'paused';
  is_private?: boolean;
  target_date?: string;
  created_at?: string;
  updated_at?: string;
};

export type TargetPriority = {
  value: Target['priority'];
  label: string;
  color: string;
  allocationPercent: number;
};

export const TARGET_PRIORITIES: TargetPriority[] = [
  { value: 'high', label: 'Высокий', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300', allocationPercent: 15 },
  { value: 'medium', label: 'Средний', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300', allocationPercent: 10 },
  { value: 'low', label: 'Низкий', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300', allocationPercent: 5 },
];

export const TARGET_STATUS_LABELS: Record<Target['status'], string> = {
  active: 'Активна',
  completed: 'Достигнута',
  paused: 'Приостановлена',
};

export const TARGET_STATUS_COLORS: Record<Target['status'], string> = {
  active: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  completed: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  paused: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300',
};

// Прогноз: сколько месяцев до цели
export function calculateMonthsToTarget(
  targetAmount: number,
  currentAmount: number,
  avgMonthlyProfit: number,
  allocationPercent: number
): number | null {
  if (avgMonthlyProfit <= 0) return null;
  const monthlyAllocation = avgMonthlyProfit * (allocationPercent / 100);
  if (monthlyAllocation <= 0) return null;
  const remaining = targetAmount - currentAmount;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / monthlyAllocation);
}

// Прогнозная дата достижения
export function calculateTargetDate(monthsToTarget: number | null): Date | null {
  if (monthsToTarget === null) return null;
  const date = new Date();
  date.setMonth(date.getMonth() + monthsToTarget);
  return date;
}
