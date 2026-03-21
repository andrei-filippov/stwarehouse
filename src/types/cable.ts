export type CableCategory = {
  id: string;
  company_id?: string;
  parent_id?: string | null; // Для подкатегорий
  name: string;
  description?: string;
  color: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  // Для иерархии в UI
  children?: CableCategory[];
  level?: number;
};

export type CableInventory = {
  id: string;
  company_id?: string;
  category_id: string;
  name?: string; // Название позиции (для оборудования, не кабелей)
  length?: number; // Для кабелей - длина, для оборудования может быть null
  quantity: number;
  min_quantity: number;
  price?: number; // Цена аренды (для оборудования)
  unit?: string; // Единица измерения (шт, комплект, услуга)
  watts?: number; // Мощность в ваттах (для расчёта нагрузки)
  qr_code?: string; // Уникальный QR-код
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
  length?: number;
  equipment_name?: string;
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
