import { supabase } from './supabase';

// Система прав доступа (RBAC) с поддержкой кастомных разрешений

export type UserRole = 'owner' | 'admin' | 'manager' | 'warehouse' | 'accountant' | 'viewer';
export type TabId = 'dashboard' | 'equipment' | 'estimates' | 'templates' | 'calendar' | 'checklists' | 'kits' | 'staff' | 'goals' | 'cables' | 'finance' | 'customers' | 'contracts' | 'settings' | 'admin';

// Разрешения по умолчанию для каждой роли
export const ROLE_TABS: Record<UserRole, TabId[]> = {
  owner: ['dashboard', 'equipment', 'estimates', 'templates', 'calendar', 'checklists', 'kits', 'staff', 'goals', 'cables', 'finance', 'customers', 'contracts', 'settings', 'admin'],
  admin: ['dashboard', 'equipment', 'estimates', 'templates', 'calendar', 'checklists', 'kits', 'staff', 'goals', 'cables', 'finance', 'customers', 'contracts', 'settings', 'admin'],
  manager: ['dashboard', 'equipment', 'estimates', 'templates', 'calendar', 'checklists', 'kits', 'goals', 'cables', 'finance', 'customers'],
  warehouse: ['dashboard', 'equipment', 'checklists', 'kits', 'calendar', 'cables'],
  accountant: ['dashboard', 'estimates', 'finance', 'customers', 'calendar'],
  viewer: [], // Наблюдатель - нет доступа по умолчанию, только кастомные разрешения
};

export const ALL_TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'equipment', label: 'Оборудование' },
  { id: 'estimates', label: 'Сметы' },
  { id: 'templates', label: 'Шаблоны' },
  { id: 'calendar', label: 'Календарь' },
  { id: 'checklists', label: 'Чек-листы' },
  { id: 'kits', label: 'Комплекты' },
  { id: 'staff', label: 'Персонал' },
  { id: 'goals', label: 'Задачи' },
  { id: 'cables', label: 'Учёт оборудования' },
  { id: 'finance', label: 'Финансы' },
  { id: 'customers', label: 'Заказчики' },
  { id: 'contracts', label: 'Договоры' },
  { id: 'settings', label: 'Настройки PDF' },
  { id: 'admin', label: 'Админ-панель' },
];

// Проверка доступа (только на клиенте, для сервера используем has_tab_access)
export function hasAccess(role: UserRole | undefined, tab: TabId): boolean {
  if (!role) return false;
  if (role === 'owner' || role === 'admin') return true;
  return ROLE_TABS[role]?.includes(tab) ?? false;
}

// Получение метки роли
export function getRoleLabel(role: UserRole | string): string {
  const labels: Record<string, string> = {
    owner: 'Владелец',
    admin: 'Администратор',
    manager: 'Менеджер',
    warehouse: 'Кладовщик',
    accountant: 'Бухгалтер',
    viewer: 'Наблюдатель',
  };
  return labels[role] || role;
}

// ============ API функции для работы с разрешениями ============

export interface UserPermission {
  id: string;
  user_id: string;
  tab_id: TabId;
  allowed: boolean;
  created_at: string;
  updated_at: string;
}

export interface EffectivePermission {
  tab_id: TabId;
  allowed: boolean;
  source: 'role' | 'custom';
}

/**
 * Получить всех пользователей с их ролями и email
 */
export async function fetchAllUsers(): Promise<{ id: string; name: string; email: string; role: UserRole }[] | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .order('name');
  
  if (error) {
    console.error('Error fetching users:', error);
    return null;
  }
  
  return data as { id: string; name: string; email: string; role: UserRole }[];
}

/**
 * Обновить роль пользователя
 */
export async function updateUserRole(userId: string, role: UserRole): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);
  
  return { error };
}

/**
 * Получить кастомные разрешения пользователя
 */
export async function fetchUserCustomPermissions(userId: string): Promise<UserPermission[] | null> {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error fetching permissions:', error);
    return null;
  }
  
  return data as UserPermission[];
}

/**
 * Получить эффективные разрешения пользователя (роль + кастомные)
 */
export async function fetchUserEffectivePermissions(userId: string): Promise<EffectivePermission[] | null> {
  const { data, error } = await supabase
    .rpc('get_user_effective_permissions', { p_user_id: userId });
  
  if (error) {
    console.error('Error fetching effective permissions:', error);
    return null;
  }
  
  return data as EffectivePermission[];
}

/**
 * Установить кастомное разрешение для пользователя (via RPC)
 */
export async function setUserPermission(
  userId: string, 
  tabId: TabId, 
  allowed: boolean
): Promise<{ error: Error | null }> {
  console.log('setUserPermission called:', { userId, tabId, allowed });
  const { data, error } = await supabase.rpc('set_user_permission', {
    p_user_id: userId,
    p_tab_id: tabId,
    p_allowed: allowed
  });
  console.log('set_user_permission RPC result:', { data, error });
  
  if (error) {
    console.error('RPC error in setUserPermission:', error);
    return { error };
  }
  if (data?.error) {
    console.error('RPC returned error in setUserPermission:', data.error);
    return { error: new Error(data.error) };
  }
  return { error: null };
}

/**
 * Удалить кастомное разрешение (via RPC)
 */
export async function removeUserPermission(userId: string, tabId: TabId): Promise<{ error: Error | null }> {
  console.log('removeUserPermission called:', { userId, tabId });
  const { data, error } = await supabase.rpc('remove_user_permission', {
    p_user_id: userId,
    p_tab_id: tabId
  });
  console.log('remove_user_permission RPC result:', { data, error });
  
  if (error) {
    console.error('RPC error in removeUserPermission:', error);
    return { error };
  }
  if (data?.error) {
    console.error('RPC returned error in removeUserPermission:', data.error);
    return { error: new Error(data.error) };
  }
  return { error: null };
}

/**
 * Проверить доступ пользователя к вкладке (с учётом кастомных разрешений)
 */
export async function checkUserAccess(userId: string, tabId: TabId): Promise<boolean> {
  // Сначала проверяем кастомное разрешение
  const { data: customPerm } = await supabase
    .from('user_permissions')
    .select('allowed')
    .eq('user_id', userId)
    .eq('tab_id', tabId)
    .single();
  
  if (customPerm) {
    return customPerm.allowed;
  }
  
  // Если нет кастомного - используем роль
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  
  return hasAccess(profile?.role as UserRole, tabId);
}
