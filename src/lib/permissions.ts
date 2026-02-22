import { supabase } from './supabase';

// Система прав доступа (RBAC) с поддержкой кастомных разрешений

export type UserRole = 'admin' | 'manager' | 'warehouse' | 'accountant';
export type TabId = 'equipment' | 'estimates' | 'templates' | 'calendar' | 'checklists' | 'staff' | 'goals' | 'analytics' | 'customers' | 'settings' | 'admin';

// Разрешения по умолчанию для каждой роли
export const ROLE_TABS: Record<UserRole, TabId[]> = {
  admin: ['equipment', 'estimates', 'templates', 'calendar', 'checklists', 'staff', 'goals', 'analytics', 'customers', 'settings', 'admin'],
  manager: ['equipment', 'estimates', 'templates', 'calendar', 'checklists', 'goals', 'analytics', 'customers'],
  warehouse: ['equipment', 'checklists', 'calendar'],
  accountant: ['estimates', 'analytics', 'customers', 'calendar'],
};

export const ALL_TABS: { id: TabId; label: string }[] = [
  { id: 'equipment', label: 'Оборудование' },
  { id: 'estimates', label: 'Сметы' },
  { id: 'templates', label: 'Шаблоны' },
  { id: 'calendar', label: 'Календарь' },
  { id: 'checklists', label: 'Чек-листы' },
  { id: 'staff', label: 'Персонал' },
  { id: 'goals', label: 'Задачи' },
  { id: 'analytics', label: 'Аналитика' },
  { id: 'customers', label: 'Заказчики' },
  { id: 'settings', label: 'Настройки PDF' },
  { id: 'admin', label: 'Админ-панель' },
];

// Проверка доступа (только на клиенте, для сервера используем has_tab_access)
export function hasAccess(role: UserRole | undefined, tab: TabId): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  return ROLE_TABS[role]?.includes(tab) ?? false;
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
  // Получаем профили
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, role')
    .order('name');
  
  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    return null;
  }

  // Получаем email из auth.users через RPC или отдельный запрос
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  
  // Если не удалось получить email (нет admin прав), возвращаем без email
  if (usersError || !users) {
    return profiles.map(p => ({
      id: p.id,
      name: p.name,
      email: '', // Email скрыт
      role: p.role as UserRole,
    }));
  }

  // Соединяем профили с email
  const userMap = new Map(users.users.map(u => [u.id, u.email]));
  
  return profiles.map(p => ({
    id: p.id,
    name: p.name,
    email: userMap.get(p.id) || '',
    role: p.role as UserRole,
  }));
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
 * Установить кастомное разрешение для пользователя
 */
export async function setUserPermission(
  userId: string, 
  tabId: TabId, 
  allowed: boolean
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('user_permissions')
    .upsert(
      { user_id: userId, tab_id: tabId, allowed },
      { onConflict: 'user_id,tab_id' }
    );
  
  return { error };
}

/**
 * Удалить кастомное разрешение (вернуть к ролевому значению)
 */
export async function removeUserPermission(userId: string, tabId: TabId): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('user_permissions')
    .delete()
    .eq('user_id', userId)
    .eq('tab_id', tabId);
  
  return { error };
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
