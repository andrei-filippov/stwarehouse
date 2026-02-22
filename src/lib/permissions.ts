// Система прав доступа (RBAC) с поддержкой индивидуальных настроек
import { supabase } from './supabase';

export type UserRole = 'admin' | 'manager' | 'warehouse' | 'accountant';
export type TabId = 'equipment' | 'estimates' | 'templates' | 'calendar' | 'checklists' | 'staff' | 'goals' | 'analytics' | 'customers' | 'settings' | 'admin';

// Все доступные вкладки
export const ALL_TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'equipment', label: 'Оборудование', icon: 'Package' },
  { id: 'estimates', label: 'Сметы', icon: 'FileText' },
  { id: 'templates', label: 'Шаблоны', icon: 'Layout' },
  { id: 'calendar', label: 'Календарь', icon: 'Calendar' },
  { id: 'checklists', label: 'Чек-листы', icon: 'ClipboardCheck' },
  { id: 'staff', label: 'Персонал', icon: 'Users' },
  { id: 'goals', label: 'Задачи', icon: 'Target' },
  { id: 'analytics', label: 'Аналитика', icon: 'BarChart3' },
  { id: 'customers', label: 'Заказчики', icon: 'Building2' },
  { id: 'settings', label: 'Настройки PDF', icon: 'Settings' },
  { id: 'admin', label: 'Админ', icon: 'Shield' },
];

export interface UserPermissions {
  user_id: string;
  allowed_tabs: TabId[];
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
}

// Загрузка прав пользователя из БД
export async function fetchUserPermissions(userId: string): Promise<UserPermissions | null> {
  try {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching permissions:', error);
      return null;
    }

    return data as UserPermissions;
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}

// Обновление прав пользователя (только для админа)
export async function updateUserPermissions(
  userId: string, 
  permissions: Partial<UserPermissions>
): Promise<{ error: any }> {
  const { error } = await supabase
    .from('user_permissions')
    .upsert({
      user_id: userId,
      ...permissions,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  return { error };
}

// Проверка доступа к вкладке
export function hasTabAccess(permissions: UserPermissions | null | undefined, tab: TabId): boolean {
  if (!permissions) return false;
  return permissions.allowed_tabs.includes(tab);
}

// Проверка возможности редактирования
export function canEdit(permissions: UserPermissions | null | undefined): boolean {
  return permissions?.can_edit ?? false;
}

// Проверка возможности удаления
export function canDelete(permissions: UserPermissions | null | undefined): boolean {
  return permissions?.can_delete ?? false;
}

// Проверка возможности экспорта
export function canExport(permissions: UserPermissions | null | undefined): boolean {
  return permissions?.can_export ?? false;
}

// Получение метки роли
export function getRoleLabel(role: UserRole | string): string {
  const labels: Record<string, string> = {
    admin: 'Администратор',
    manager: 'Менеджер',
    warehouse: 'Кладовщик',
    accountant: 'Бухгалтер',
  };
  return labels[role] || role;
}

// Предустановленные наборы прав (шаблоны)
export const PERMISSION_TEMPLATES: Record<UserRole, Partial<UserPermissions>> = {
  admin: {
    allowed_tabs: ['equipment', 'estimates', 'templates', 'calendar', 'checklists', 'staff', 'goals', 'analytics', 'customers', 'settings', 'admin'],
    can_edit: true,
    can_delete: true,
    can_export: true,
  },
  manager: {
    allowed_tabs: ['equipment', 'estimates', 'templates', 'calendar', 'checklists', 'goals', 'analytics', 'customers'],
    can_edit: true,
    can_delete: true,
    can_export: true,
  },
  warehouse: {
    allowed_tabs: ['equipment', 'checklists', 'calendar'],
    can_edit: true,
    can_delete: false,
    can_export: false,
  },
  accountant: {
    allowed_tabs: ['estimates', 'analytics', 'customers', 'calendar'],
    can_edit: false,
    can_delete: false,
    can_export: true,
  },
};
