export type Task = {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  category: 'repair' | 'check' | 'wiring' | 'moving' | 'purchase' | 'other';
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
  { value: 'repair', label: 'Ремонт', icon: '🔧', color: 'bg-red-100 text-red-800' },
  { value: 'check', label: 'Проверка', icon: '✓', color: 'bg-blue-100 text-blue-800' },
  { value: 'wiring', label: 'Распайка', icon: '🔌', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'moving', label: 'Переноска', icon: '📦', color: 'bg-purple-100 text-purple-800' },
  { value: 'purchase', label: 'Закупка', icon: '🛒', color: 'bg-green-100 text-green-800' },
  { value: 'other', label: 'Другое', icon: '📝', color: 'bg-gray-100 text-gray-800' },
];

export const TASK_PRIORITIES: TaskPriority[] = [
  { value: 'low', label: 'Низкий', color: 'bg-gray-100 text-gray-600' },
  { value: 'medium', label: 'Средний', color: 'bg-blue-100 text-blue-600' },
  { value: 'high', label: 'Высокий', color: 'bg-orange-100 text-orange-600' },
  { value: 'urgent', label: 'Срочно', color: 'bg-red-100 text-red-600' },
];

export const TASK_STATUSES: TaskStatus[] = [
  { value: 'pending', label: 'Ожидает', color: 'bg-gray-100 text-gray-600' },
  { value: 'in_progress', label: 'В работе', color: 'bg-blue-100 text-blue-600' },
  { value: 'completed', label: 'Выполнено', color: 'bg-green-100 text-green-600' },
  { value: 'cancelled', label: 'Отменено', color: 'bg-red-100 text-red-600' },
];
