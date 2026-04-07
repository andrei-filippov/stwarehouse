// ============================================
// Типы для компаний и мультитенантности
// ============================================

export type CompanyPlan = 'free' | 'basic' | 'pro' | 'enterprise';
export type CompanyRole = 'owner' | 'admin' | 'manager' | 'accountant' | 'viewer';
export type MemberStatus = 'pending' | 'active' | 'suspended' | 'removed';
export type CompanyType = 'company' | 'ip' | 'individual';

// Компания
export type Company = {
  id: string;
  name: string;
  type?: CompanyType;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  legal_address?: string;
  actual_address?: string;
  phone?: string;
  email?: string;
  website?: string;
  
  // Банковские реквизиты
  bank_name?: string;
  bank_bik?: string;
  bank_account?: string;
  bank_corr_account?: string;
  
  // Настройки
  logo_url?: string;
  settings?: Record<string, any>;
  
  // Тариф
  plan: CompanyPlan;
  plan_expires_at?: string;
  
  created_at?: string;
  updated_at?: string;
};

// Член компании (сотрудник)
export type CompanyMember = {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  position?: string;
  invited_by?: string;
  invited_at?: string;
  status: MemberStatus;
  joined_at?: string;
  
  // Данные пользователя (при join)
  user?: {
    id: string;
    email: string;
    name?: string;
    avatar_url?: string;
  };
  
  // Данные пригласившего
  inviter?: {
    id: string;
    name?: string;
  };
};

// Контекст компании
export type CompanyContextType = {
  company: Company | null;
  companies: Company[];
  members: CompanyMember[];
  myRole: CompanyRole | null;
  myMember: CompanyMember | null;
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  canManage: boolean; // owner или admin
  error: string | null;
  
  // Действия
  loadCompany: () => Promise<void>;
  loadUserCompanies: () => Promise<void>;
  switchCompany: (companyId: string) => void;
  inviteMember: (email: string, role: CompanyRole, position?: string) => Promise<{ error?: string }>;
  removeMember: (memberId: string) => Promise<{ error?: string }>;
  updateMemberRole: (memberId: string, role: CompanyRole) => Promise<{ error?: string }>;
  updateCompany: (updates: Partial<Company>) => Promise<{ error?: string }>;
};

// Метки для ролей
export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  manager: 'Менеджер',
  accountant: 'Бухгалтер',
  viewer: 'Наблюдатель',
};

// Метки для статусов
export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  pending: 'Ожидает',
  active: 'Активен',
  suspended: 'Приостановлен',
  removed: 'Удалён',
};

// Метки для тарифов
export const COMPANY_PLAN_LABELS: Record<CompanyPlan, string> = {
  free: 'Бесплатный',
  basic: 'Базовый',
  pro: 'Профессиональный',
  enterprise: 'Enterprise',
};

// Метки для типов компаний
export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  company: 'ООО (Общество с ограниченной ответственностью)',
  ip: 'ИП (Индивидуальный предприниматель)',
  individual: 'Физическое лицо',
};

// Цвета для ролей
export const COMPANY_ROLE_COLORS: Record<CompanyRole, { bg: string; text: string }> = {
  owner: { bg: 'bg-purple-100', text: 'text-purple-700' },
  admin: { bg: 'bg-blue-100', text: 'text-blue-700' },
  manager: { bg: 'bg-green-100', text: 'text-green-700' },
  accountant: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  viewer: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

// Права доступа по ролям
export const ROLE_PERMISSIONS: Record<CompanyRole, string[]> = {
  owner: ['*'], // Все права
  admin: [
    'company.settings',
    'company.members',
    'estimates.*',
    'contracts.*',
    'equipment.*',
    'customers.*',
    'staff.*',
    'invoices.*',
    'acts.*',
    'reports.*',
  ],
  manager: [
    'estimates.view',
    'estimates.create',
    'estimates.edit',
    'contracts.view',
    'contracts.create',
    'contracts.edit',
    'equipment.view',
    'customers.view',
    'customers.create',
    'customers.edit',
    'invoices.view',
    'acts.view',
  ],
  accountant: [
    'estimates.view',
    'contracts.view',
    'customers.view',
    'invoices.*',
    'acts.*',
    'reports.*',
    'expenses.*',
  ],
  viewer: [
    'estimates.view',
    'contracts.view',
    'equipment.view',
    'customers.view',
  ],
};

// Проверка права доступа
export function hasPermission(role: CompanyRole, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (permissions.includes('*')) return true;
  if (permissions.includes(permission)) return true;
  
  // Проверка wildcard (например, 'estimates.*')
  const parts = permission.split('.');
  const wildcard = parts[0] + '.*';
  return permissions.includes(wildcard);
}

// Получение label
export function getCompanyRoleLabel(role: CompanyRole): string {
  return COMPANY_ROLE_LABELS[role] || role;
}

export function getMemberStatusLabel(status: MemberStatus): string {
  return MEMBER_STATUS_LABELS[status] || status;
}

export function getCompanyPlanLabel(plan: CompanyPlan): string {
  return COMPANY_PLAN_LABELS[plan] || plan;
}
