// Типы для поштучного учёта экземпляров оборудования

export type ItemStatus = 'available' | 'issued' | 'repair' | 'written_off';
export type ItemCondition = 'excellent' | 'good' | 'fair' | 'poor';

export interface InventoryItem {
  id: string;
  company_id?: string;
  inventory_id: string;
  serial_number?: string;
  qr_code: string;
  status: ItemStatus;
  condition: ItemCondition;
  notes?: string;
  purchase_date?: string;
  purchase_price?: number;
  created_at?: string;
  updated_at?: string;
  // Join-поля
  inventory_name?: string;
  inventory_category_id?: string;
}

export interface ItemComment {
  id: string;
  item_id: string;
  author_id?: string;
  author_name?: string;
  text: string;
  created_at?: string;
}

export interface ItemHistory {
  type: 'issue' | 'return' | 'repair' | 'comment';
  date: string;
  description: string;
  author?: string;
  details?: string;
}

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  available: 'На складе',
  issued: 'Выдано',
  repair: 'В ремонте',
  written_off: 'Списано',
};

export const ITEM_STATUS_COLORS: Record<ItemStatus, string> = {
  available: 'bg-green-100 text-green-700 border-green-200',
  issued: 'bg-blue-100 text-blue-700 border-blue-200',
  repair: 'bg-red-100 text-red-700 border-red-200',
  written_off: 'bg-gray-100 text-gray-700 border-gray-200',
};

export const ITEM_CONDITION_LABELS: Record<ItemCondition, string> = {
  excellent: 'Отличное',
  good: 'Хорошее',
  fair: 'Удовлетворительное',
  poor: 'Плохое',
};

export const getItemStatusLabel = (status: ItemStatus): string =>
  ITEM_STATUS_LABELS[status] || status;

export const getItemStatusColor = (status: ItemStatus): string =>
  ITEM_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';

export const getItemConditionLabel = (condition: ItemCondition): string =>
  ITEM_CONDITION_LABELS[condition] || condition;
