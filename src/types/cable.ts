export type CableCategory = {
  id: string;
  company_id?: string;
  name: string;
  description?: string;
  color: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type CableInventory = {
  id: string;
  company_id?: string;
  category_id: string;
  length: number;
  quantity: number;
  min_quantity: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type CableMovement = {
  id: string;
  company_id?: string;
  category_id: string;
  inventory_id?: string;
  type: 'issue' | 'return' | 'write_off';
  length: number;
  quantity: number;
  issued_to: string;
  contact?: string;
  issued_by?: string;
  returned_at?: string;
  returned_quantity?: number;
  notes?: string;
  is_returned?: boolean;
  created_at?: string;
};

export type CableMovementWithCategory = CableMovement & {
  category_name?: string;
};

export const CABLE_COLORS = [
  { value: '#3b82f6', label: 'Синий' },
  { value: '#ef4444', label: 'Красный' },
  { value: '#22c55e', label: 'Зелёный' },
  { value: '#f59e0b', label: 'Жёлтый' },
  { value: '#8b5cf6', label: 'Фиолетовый' },
  { value: '#ec4899', label: 'Розовый' },
  { value: '#06b6d4', label: 'Бирюзовый' },
  { value: '#6b7280', label: 'Серый' },
  { value: '#000000', label: 'Чёрный' },
];
