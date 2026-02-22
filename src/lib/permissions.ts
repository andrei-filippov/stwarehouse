// Система прав доступа (RBAC)
export type UserRole = 'admin' | 'manager' | 'warehouse' | 'accountant';
export type TabId = 'equipment' | 'estimates' | 'templates' | 'calendar' | 'checklists' | 'staff' | 'goals' | 'analytics' | 'customers' | 'settings';

export const ROLE_TABS: Record<UserRole, TabId[]> = {
  admin: ['equipment', 'estimates', 'templates', 'calendar', 'checklists', 'staff', 'goals', 'analytics', 'customers', 'settings'],
  manager: ['equipment', 'estimates', 'templates', 'calendar', 'checklists', 'goals', 'analytics', 'customers'],
  warehouse: ['equipment', 'checklists', 'calendar'],
  accountant: ['estimates', 'analytics', 'customers', 'calendar'],
};

export function hasAccess(role: UserRole | undefined, tab: TabId): boolean {
  if (!role) return false;
  return ROLE_TABS[role]?.includes(tab) ?? false;
}

export function getRoleLabel(role: UserRole | string): string {
  const labels: Record<string, string> = {
    admin: 'Администратор',
    manager: 'Менеджер',
    warehouse: 'Кладовщик',
    accountant: 'Бухгалтер',
  };
  return labels[role] || role;
}
