export type Equipment = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  description: string;
  unit: string; // единица измерения: шт, комплект, услуга, человек, п.м.
  created_at?: string;
  updated_at?: string;
};

export type Category = {
  id: string;
  name: string;
};

export type EstimateItem = {
  id?: string;
  estimate_id?: string;
  equipment_id: string;
  name: string;
  description: string;
  quantity: number;
  price: number;
  unit: string; // единица измерения
  coefficient: number; // коэффициент, по умолчанию 1
};

export type Estimate = {
  id: string;
  user_id?: string;
  event_name: string;
  venue: string;
  event_date: string;
  total: number;
  created_at?: string;
  updated_at?: string;
  items?: EstimateItem[];
};

export type TemplateItem = {
  id?: string;
  template_id?: string;
  category: string;
  equipment_name: string;
  default_quantity: number;
};

export type Template = {
  id: string;
  user_id?: string;
  name: string;
  description: string;
  items?: TemplateItem[];
  created_at?: string;
};

export type Profile = {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'warehouse' | 'accountant';
  created_at?: string;
};

export type PDFSettings = {
  logo: string | null;
  companyName: string;
  companyDetails: string;
  position: string;
  personName: string;
  signature: string | null;
  stamp: string | null;
};

// Правило: связывает оборудование с необходимыми инструментами
export type ChecklistRule = {
  id: string;
  user_id?: string;
  name: string;
  // Условие: категория оборудования или конкретное название
  condition_type: 'category' | 'equipment';
  condition_value: string; // название категории или оборудования
  // Что добавлять в чек-лист
  items: ChecklistRuleItem[];
  created_at?: string;
};

export type ChecklistRuleItem = {
  id?: string;
  rule_id?: string;
  name: string; // название инструмента/оборудования
  quantity: number; // количество на единицу оборудования
  category: string; // категория: 'tool' | 'cable' | 'accessory' | 'other'
  is_required: boolean; // обязательный или опциональный
};

// Чек-лист для конкретной сметы
export type Checklist = {
  id: string;
  estimate_id: string;
  user_id?: string;
  event_name: string;
  event_date: string;
  items: ChecklistItem[];
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type ChecklistItem = {
  id?: string;
  checklist_id?: string;
  name: string;
  quantity: number;
  category: string;
  is_required: boolean;
  is_checked: boolean; // отмечено ли
  source_rule_id?: string; // откуда пришло (из какого правила)
  notes?: string;
};

// Сотрудник
export type Staff = {
  id: string;
  user_id?: string;
  full_name: string;
  position: string;
  phone?: string;
  email?: string;
  birth_date?: string;
  passport_series?: string;
  passport_number?: string;
  passport_issued_by?: string;
  passport_issue_date?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};
