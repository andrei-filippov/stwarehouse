// Расширенные типы для чек-листов с QR-сканированием

export type ChecklistItemStatus = 'pending' | 'loaded' | 'unloaded';

export type ChecklistItemV2 = {
  id?: string;
  checklist_id?: string;
  name: string;
  quantity: number;
  category: string;
  is_required: boolean;
  is_checked: boolean; // Legacy: общий статус
  
  // Новые поля для двойной проверки
  inventory_id?: string; // Связь с cable_inventory
  qr_code?: string; // QR-код для сканирования
  
  // Погрузка (перед выездом)
  loaded: boolean;
  loaded_at?: string;
  loaded_by?: string;
  
  // Разгрузка (после возврата)
  unloaded: boolean;
  unloaded_at?: string;
  unloaded_by?: string;
  
  // Комплект/кофр
  kit_id?: string;
  kit_name?: string; // Join с equipment_kits
  
  notes?: string;
  source_rule_id?: string;
};

export type ChecklistV2 = {
  id: string;
  estimate_id?: string;
  company_id?: string;
  event_name: string;
  event_date: string;
  items: ChecklistItemV2[];
  notes?: string;
  created_at?: string;
  updated_at?: string;
  
  // Прогресс сканирования
  loaded_count?: number;
  unloaded_count?: number;
  total_count?: number;
};

// Комплект/кофр оборудования
export type EquipmentKit = {
  id: string;
  company_id?: string;
  name: string; // Например "Кофр звук #1"
  qr_code?: string;
  description?: string;
  items?: KitItem[];
  created_at?: string;
  updated_at?: string;
};

// Позиция в комплекте
export type KitItem = {
  id?: string;
  kit_id?: string;
  inventory_id: string;
  inventory_name?: string; // Join с cable_inventory
  quantity: number;
  created_at?: string;
};

// Статистика по чек-листу
export type ChecklistStats = {
  total: number;
  loaded: number;
  unloaded: number;
  pending: number;
  by_category: Record<string, {
    total: number;
    loaded: number;
    unloaded: number;
  }>;
};

// Режим сканирования в чек-листе
export type ChecklistScanMode = 'load' | 'unload' | 'view';
