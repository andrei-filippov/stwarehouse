import type { CableCategory, CableInventory, CableMovement, EquipmentRepair } from '../../types';
import type { InventoryItem } from '../../types/inventoryItem';
import type { EquipmentKit } from '../../types/checklist';

export interface SelectedItem {
  inventory_id: string;
  category_id: string;
  length: number;
  name?: string;
  available: number;
  quantity: number;
}

export interface CableManagerProps {
  categories: CableCategory[];
  inventory: CableInventory[];
  movements: CableMovement[];
  repairs: EquipmentRepair[];
  inventoryItems?: InventoryItem[];
  stats: Record<string, { totalLength: number; totalQty: number; issuedQty: number; repairQty: number }>;
  loading?: boolean;
  onAddCategory: (data: Omit<CableCategory, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<{ error: any }>;
  onUpdateCategory: (id: string, updates: Partial<CableCategory>) => Promise<{ error: any }>;
  onDeleteCategory: (id: string) => Promise<{ error: any }>;
  onReorderCategories?: (categoryIds: string[]) => Promise<{ error: any }>;
  onImportFromEquipment?: () => Promise<{ error: any }>;
  onUpsertInventory: (data: Omit<CableInventory, 'id' | 'created_at' | 'updated_at'>) => Promise<{ error: any }>;
  onUpdateInventoryQty?: (id: string, quantity: number) => Promise<{ error: any }>;
  onDeleteInventory: (id: string) => Promise<{ error: any }>;
  onIssueCable: (data: {
    category_id: string;
    inventory_id: string;
    length?: number;
    equipment_name?: string;
    quantity: number;
    issued_to: string;
    contact?: string;
    item_id?: string;
  }) => Promise<{ error: any }>;
  onReturnCable: (movementId: string) => Promise<{ error: any }>;
  onSendToRepair?: (repair: Partial<EquipmentRepair>) => Promise<{ error: any }>;
  onUpdateRepairStatus?: (repairId: string, status: EquipmentRepair['status'], returnedDate?: string) => Promise<{ error: any }>;
  onDeleteRepair?: (repairId: string) => Promise<{ error: any }>;
  onRefresh?: () => void;
  fabAction?: number;
  onTransferToEquipment?: (items: {
    name: string;
    description: string;
    quantity: number;
    category: string;
    price: number;
    unit: string;
  }[]) => Promise<{ error: any }>;
  targetEquipmentCategories?: { id: string; name: string }[];
  existingEquipment?: { name: string; category: string }[];
  kits?: EquipmentKit[];
  companyId?: string;
}

export interface SortableCategoryItemProps {
  category: CableCategory & { children?: CableCategory[] };
  inventory: CableInventory[];
  movements: CableMovement[];
  repairs: EquipmentRepair[];
  stats: Record<string, { totalLength: number; totalQty: number; issuedQty: number; repairQty: number }>;
  selectedItems: SelectedItem[];
  expandedCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  onToggleItem: (item: CableInventory) => void;
  onUpdateInventoryQty: (id: string, newQty: number, length: number) => void;
  onDeleteInventory: (id: string) => Promise<{ error: any }>;
  onAddInventory: (categoryId: string) => void;
  onEditInventory: (item: CableInventory, categoryName: string) => void;
  onEditCategory: (cat: CableCategory) => void;
  onDeleteCategory: (id: string) => Promise<{ error: any }>;
  onSendToRepair?: (categoryId: string, item: CableInventory, categoryName: string) => void;
  onShowQRCode?: (item: CableInventory) => void;
  categoryName?: string;
  level?: number;
  isSortable?: boolean;
  selectionMode?: boolean;
  selectedInventoryIds?: Set<string>;
  onSelectInventory?: (id: string, selected: boolean) => void;
  onSelectAllInCategory?: (categoryId: string, selected: boolean) => void;
  expandedInventory?: string | null;
  onToggleInventoryItems: (id: string) => void;
  companyId?: string;
  onRefresh?: () => void;
  inventoryItems?: InventoryItem[];
}

export interface CategoryItemProps {
  category: CableCategory & { children?: CableCategory[] };
  inventory: CableInventory[];
  movements: CableMovement[];
  repairs: EquipmentRepair[];
  stats: Record<string, { totalLength: number; totalQty: number; issuedQty: number; repairQty: number }>;
  selectedItems: SelectedItem[];
  expandedCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  onToggleItem: (item: CableInventory) => void;
  onUpdateInventoryQty: (id: string, newQty: number, length: number) => void;
  onDeleteInventory: (id: string) => Promise<{ error: any }>;
  onAddInventory: (categoryId: string) => void;
  onEditInventory: (item: CableInventory, categoryName: string) => void;
  onEditCategory: (cat: CableCategory) => void;
  onDeleteCategory: (id: string) => Promise<{ error: any }>;
  onSendToRepair?: (categoryId: string, item: CableInventory, categoryName: string) => void;
  onShowQRCode?: (item: CableInventory) => void;
  categoryName?: string;
  level?: number;
  dragHandleProps?: any;
  selectionMode?: boolean;
  selectedInventoryIds?: Set<string>;
  onSelectInventory?: (id: string, selected: boolean) => void;
  onSelectAllInCategory?: (categoryId: string, selected: boolean) => void;
  expandedInventory?: string | null;
  onToggleInventoryItems: (id: string) => void;
  companyId?: string;
  onRefresh?: () => void;
  inventoryItems?: InventoryItem[];
}

export interface CategoryListProps {
  categories: (CableCategory & { children?: CableCategory[]; level?: number })[];
  inventory: CableInventory[];
  movements: CableMovement[];
  repairs: EquipmentRepair[];
  stats: Record<string, { totalLength: number; totalQty: number; issuedQty: number; repairQty: number }>;
  selectedItems: SelectedItem[];
  expandedCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  onToggleItem: (item: CableInventory) => void;
  onUpdateInventoryQty: (id: string, newQty: number, length: number) => void;
  onDeleteInventory: (id: string) => Promise<{ error: any }>;
  onAddInventory: (categoryId: string) => void;
  onEditInventory: (item: CableInventory, categoryName: string) => void;
  onEditCategory: (cat: CableCategory) => void;
  onDeleteCategory: (id: string) => Promise<{ error: any }>;
  onSendToRepair?: (categoryId: string, item: CableInventory, categoryName: string) => void;
  onShowQRCode?: (item: CableInventory) => void;
  onReorderCategories?: (categoryIds: string[]) => Promise<{ error: any }>;
  categoryName?: string;
  level?: number;
  selectionMode?: boolean;
  selectedInventoryIds?: Set<string>;
  onSelectInventory?: (id: string, selected: boolean) => void;
  onSelectAllInCategory?: (categoryId: string, selected: boolean) => void;
  inventoryItems?: InventoryItem[];
}
