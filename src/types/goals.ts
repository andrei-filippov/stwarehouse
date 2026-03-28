export type Task = {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  category: 'repair' | 'check' | 'wiring' | 'purchase' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date: string; // YYYY-MM-DD
  assigned_to?: string; // ID сотрудника
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type TaskCategory = {
  value: Task['category'];
  label: string;
  icon: string;
  color: string;
};

export type TaskPriority = {
  value: Task['priority'];
  label: string;
  color: string;
};

export type TaskStatus = {
  value: Task['status'];
  label: string;
  color: string;
};

export const TASK_CATEGORIES: TaskCategory[] = [
  { value: 'repair', label: 'Ремонт', icon: '🔧', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' },
  { value: 'check', label: 'Проверка', icon: '✓', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' },
  { value: 'wiring', label: 'Изготовление', icon: '🔌', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' },
  { value: 'purchase', label: 'Закупка', icon: '🛒', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' },
  { value: 'other', label: 'Другое', icon: '📝', color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300' },
];

export const TASK_PRIORITIES: TaskPriority[] = [
  { value: 'low', label: 'Низкий', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
  { value: 'medium', label: 'Средний', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
  { value: 'high', label: 'Высокий', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' },
  { value: 'urgent', label: 'Срочно', color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
];

export const TASK_STATUSES: TaskStatus[] = [
  { value: 'pending', label: 'Ожидает', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
  { value: 'in_progress', label: 'В работе', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
  { value: 'completed', label: 'Выполнено', color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
  { value: 'cancelled', label: 'Отменено', color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
];
