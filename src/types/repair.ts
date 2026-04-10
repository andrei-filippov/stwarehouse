// Типы для учета оборудования в ремонте

export type EquipmentRepair = {
  id: string;
  company_id?: string;
  category_id: string;
  inventory_id?: string;
  equipment_name: string; // Название оборудования для быстрого поиска
  length?: number; // Для кабелей
  quantity: number;
  status: 'in_repair' | 'repaired' | 'written_off' | 'returned';
  reason: string; // Причина поломки
  repair_cost?: number; // Стоимость ремонта
  sent_date: string;
  returned_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type RepairStatus = {
  value: EquipmentRepair['status'];
  label: string;
  color: string;
};

export const REPAIR_STATUSES: RepairStatus[] = [
  { value: 'in_repair', label: 'В ремонте', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'repaired', label: 'Отремонтировано', color: 'bg-green-100 text-green-700' },
  { value: 'returned', label: 'Возвращено', color: 'bg-blue-100 text-blue-700' },
  { value: 'written_off', label: 'Списано', color: 'bg-red-100 text-red-700' },
];

export const getRepairStatusLabel = (status: string): string => {
  return REPAIR_STATUSES.find(s => s.value === status)?.label || status;
};

export const getRepairStatusColor = (status: string): string => {
  return REPAIR_STATUSES.find(s => s.value === status)?.color || 'bg-gray-100';
};
