import { useState, useMemo, memo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Pencil,
  Package,
  User,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Cable,
  GripVertical
} from 'lucide-react';
import type { CableCategory, CableInventory, CableMovement, EquipmentRepair } from '../types';
import { REPAIR_STATUSES, getRepairStatusLabel, getRepairStatusColor } from '../types';
import { CABLE_COLORS } from '../types/cable';
import { Spinner } from './ui/spinner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SelectedItem {
  inventory_id: string;
  category_id: string;
  length: number;
  name?: string;
  available: number;
  quantity: number;
}

interface CableManagerProps {
  categories: CableCategory[];
  inventory: CableInventory[];
  movements: CableMovement[];
  repairs: EquipmentRepair[];
  stats: Record<string, { totalLength: number; totalQty: number; issuedQty: number; repairQty: number }>;
  loading?: boolean;
  onAddCategory: (data: Omit<CableCategory, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<{ error: any }>;
  onUpdateCategory: (id: string, updates: Partial<CableCategory>) => Promise<{ error: any }>;
  onDeleteCategory: (id: string) => Promise<{ error: any }>;
  onReorderCategories?: (categoryIds: string[]) => Promise<{ error: any }>;
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
  }) => Promise<{ error: any }>;
  onReturnCable: (movementId: string) => Promise<{ error: any }>;
  onSendToRepair?: (repair: Partial<EquipmentRepair>) => Promise<{ error: any }>;
  onUpdateRepairStatus?: (repairId: string, status: EquipmentRepair['status'], returnedDate?: string) => Promise<{ error: any }>;
  onDeleteRepair?: (repairId: string) => Promise<{ error: any }>;
  fabAction?: number;
}

export const CableManager = memo(function CableManager({
  categories,
  inventory,
  movements,
  repairs,
  stats,
  loading,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
  onUpsertInventory,
  onUpdateInventoryQty,
  onDeleteInventory,
  onIssueCable,
  onReturnCable,
  onSendToRepair,
  onUpdateRepairStatus,
  onDeleteRepair,
  fabAction,
}: CableManagerProps) {
  const [activeTab, setActiveTab] = useState('warehouse');
  
  // Выбранные позиции для массовой выдачи
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [isBulkIssueDialogOpen, setIsBulkIssueDialogOpen] = useState(false);
  const [bulkIssueForm, setBulkIssueForm] = useState({
    issued_to: '',
    contact: '',
    items: [] as SelectedItem[],
  });
  
  // Открываем добавление при нажатии FAB (пропускаем первый рендер)
  const isFirstRender = useRef(false);
  useEffect(() => {
    if (!isFirstRender.current) {
      isFirstRender.current = true;
      return;
    }
    if (fabAction && fabAction > 0) {
      if (activeTab === 'warehouse') {
        setEditingCategory(null);
        setCategoryForm({ name: '', description: '', color: '#3b82f6' });
        setIsCategoryDialogOpen(true);
      }
    }
  }, [fabAction]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isInventoryDialogOpen, setIsInventoryDialogOpen] = useState(false);
  
  const [editingCategory, setEditingCategory] = useState<CableCategory | null>(null);
  const [editingInventory, setEditingInventory] = useState<CableInventory | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', color: '#3b82f6', parent_id: '' as string | undefined });
  const [inventoryForm, setInventoryForm] = useState({ category_id: '', name: '', length: '', quantity: '', min_quantity: '0', notes: '' });
  
  // Repair dialog states
  const [isRepairDialogOpen, setIsRepairDialogOpen] = useState(false);
  const [repairForm, setRepairForm] = useState({
    category_id: '',
    inventory_id: '',
    equipment_name: '',
    length: 0,
    quantity: 1,
    reason: '',
    notes: '',
  });

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddCategory = async () => {
    const { error } = await onAddCategory({
      ...categoryForm,
      parent_id: categoryForm.parent_id || undefined,
      sort_order: categories.length,
    });
    if (!error) {
      setIsCategoryDialogOpen(false);
      setCategoryForm({ name: '', description: '', color: '#3b82f6', parent_id: undefined });
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    const { error } = await onUpdateCategory(editingCategory.id, {
      ...categoryForm,
      parent_id: categoryForm.parent_id || undefined,
    });
    if (!error) {
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', color: '#3b82f6', parent_id: undefined });
    }
  };

  const handleAddInventory = async () => {
    const minQty = parseInt(inventoryForm.min_quantity);
    const { error } = await onUpsertInventory({
      category_id: inventoryForm.category_id,
      name: inventoryForm.name || undefined,
      length: inventoryForm.length ? parseFloat(inventoryForm.length) : undefined,
      quantity: parseInt(inventoryForm.quantity),
      min_quantity: isNaN(minQty) ? 0 : minQty,
      notes: inventoryForm.notes || undefined,
    });
    if (!error) {
      setIsInventoryDialogOpen(false);
      setInventoryForm({ category_id: '', name: '', length: '', quantity: '', min_quantity: '0', notes: '' });
    }
  };

  // Редактирование позиции инвентаря
  const openInventoryEdit = (item: CableInventory, categoryName: string) => {
    setEditingInventory(item);
    setSelectedCategoryId(item.category_id);
    setInventoryForm({
      category_id: item.category_id,
      name: item.name || '',
      length: item.length?.toString() || '',
      quantity: item.quantity.toString(),
      min_quantity: item.min_quantity?.toString() || '0',
      notes: item.notes || '',
    });
    setIsInventoryDialogOpen(true);
  };

  const handleEditInventory = async () => {
    if (!editingInventory) return;
    
    const minQty = parseInt(inventoryForm.min_quantity);
    const { error } = await onUpsertInventory({
      id: editingInventory.id,
      category_id: inventoryForm.category_id,
      name: inventoryForm.name || undefined,
      length: inventoryForm.length ? parseFloat(inventoryForm.length) : undefined,
      quantity: parseInt(inventoryForm.quantity),
      min_quantity: isNaN(minQty) ? 0 : minQty,
      notes: inventoryForm.notes || undefined,
    });
    if (!error) {
      setIsInventoryDialogOpen(false);
      setEditingInventory(null);
      setInventoryForm({ category_id: '', name: '', length: '', quantity: '', min_quantity: '0', notes: '' });
    }
  };

  // Обновление количества напрямую
  const handleUpdateInventoryQty = async (id: string, newQty: number, length: number) => {
    if (newQty < 0) return;
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    // Если доступна функция обновления по ID - используем её (быстрее и надежнее)
    if (onUpdateInventoryQty) {
      const { error } = await onUpdateInventoryQty(id, newQty);
      if (error) {
        toast.error('Ошибка при обновлении', { description: error.message });
      }
      return;
    }
    
    // Fallback: используем upsert (может создать дубликат если есть несколько записей с одной длиной)
    const { error } = await onUpsertInventory({
      category_id: item.category_id,
      length: length,
      quantity: newQty,
      min_quantity: item.min_quantity,
      notes: item.notes,
    });
    
    if (error) {
      toast.error('Ошибка при обновлении', { description: error.message });
    }
  };

  // Обработка выбора позиции
  const toggleItemSelection = (item: CableInventory) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.inventory_id === item.id);
      if (exists) {
        return prev.filter(i => i.inventory_id !== item.id);
      }
      return [...prev, {
        inventory_id: item.id!,
        category_id: item.category_id,
        length: item.length,
        name: item.name,
        available: item.quantity,
        quantity: 1, // По умолчанию 1
      }];
    });
  };

  // Открытие диалога массовой выдачи
  const openBulkIssueDialog = () => {
    setBulkIssueForm({
      issued_to: '',
      contact: '',
      items: [...selectedItems],
    });
    setIsBulkIssueDialogOpen(true);
  };

  // Обработка массовой выдачи
  const handleBulkIssue = async () => {
    if (!bulkIssueForm.issued_to.trim()) {
      toast.error('Укажите, кому выдаётся оборудование');
      return;
    }

    let hasError = false;
    
    for (const item of bulkIssueForm.items) {
      if (item.quantity <= 0 || item.quantity > item.available) {
        toast.error(`Некорректное количество для позиции`);
        hasError = true;
        break;
      }
      
      const { error } = await onIssueCable({
        category_id: item.category_id,
        inventory_id: item.inventory_id,
        length: item.length,
        equipment_name: item.name,
        quantity: item.quantity,
        issued_to: bulkIssueForm.issued_to,
        contact: bulkIssueForm.contact || undefined,
      });
      
      if (error) {
        hasError = true;
        break;
      }
    }
    
    if (!hasError) {
      setIsBulkIssueDialogOpen(false);
      setSelectedItems([]);
      toast.success('Успешно выдано');
    }
  };

  // Обновление количества в форме массовой выдачи
  const updateBulkItemQuantity = (inventoryId: string, quantity: number) => {
    setBulkIssueForm(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.inventory_id === inventoryId 
          ? { ...item, quantity: Math.max(1, Math.min(quantity, item.available)) }
          : item
      ),
    }));
  };

  // Открыть диалог отправки в ремонт
  const openRepairDialog = (categoryId: string, item: CableInventory, categoryName: string) => {
    setRepairForm({
      category_id: categoryId,
      inventory_id: item.id!,
      equipment_name: item.name || `${categoryName} ${item.length}м`,
      length: item.length || 0,
      quantity: 1,
      reason: '',
      notes: '',
    });
    setIsRepairDialogOpen(true);
  };

  // Отправить в ремонт
  const handleSendToRepair = async () => {
    if (!repairForm.reason.trim()) {
      toast.error('Укажите причину поломки');
      return;
    }
    if (!onSendToRepair) {
      toast.error('Функция отправки в ремонт не доступна');
      return;
    }

    const { error } = await onSendToRepair(repairForm);
    if (!error) {
      setIsRepairDialogOpen(false);
      setRepairForm({
        category_id: '',
        inventory_id: '',
        equipment_name: '',
        length: 0,
        quantity: 1,
        reason: '',
        notes: '',
      });
    }
  };

  const openCategoryEdit = (cat: CableCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      description: cat.description || '',
      color: cat.color?.toLowerCase() || '#3b82f6',
      parent_id: cat.parent_id || undefined,
    });
    setIsCategoryDialogOpen(true);
  };

  const openInventoryAdd = (categoryId: string) => {
    setEditingInventory(null);
    setInventoryForm({ category_id: categoryId, name: '', length: '', quantity: '', min_quantity: '0', notes: '' });
    setIsInventoryDialogOpen(true);
  };

  // Построение дерева категорий
  const categoryTree = useMemo(() => {
    const map = new Map<string, CableCategory & { children: CableCategory[]; level: number }>();
    const roots: (CableCategory & { children: CableCategory[]; level: number })[] = [];
    
    // Сначала создаем все узлы
    categories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [], level: 0 });
    });
    
    // Затем строим иерархию
    categories.forEach(cat => {
      const node = map.get(cat.id)!;
      if (cat.parent_id && map.has(cat.parent_id)) {
        const parent = map.get(cat.parent_id)!;
        node.level = parent.level + 1;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });
    
    return roots;
  }, [categories]);

  // Получение плоского списка для селекта (с отступами)
  const flatCategoriesForSelect = useMemo(() => {
    const result: { id: string; name: string; level: number }[] = [];
    
    const traverse = (cats: CableCategory[], level: number) => {
      cats.forEach(cat => {
        result.push({ id: cat.id, name: cat.name, level });
        if (cat.children && cat.children.length > 0) {
          traverse(cat.children, level + 1);
        }
      });
    };
    
    traverse(categoryTree, 0);
    return result;
  }, [categoryTree]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Cable className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
          <span className="hidden sm:inline">Учет оборудования</span>
          <span className="sm:hidden">Оборудование</span>
        </h1>
        <Button 
          onClick={() => {
            setEditingCategory(null);
            setCategoryForm({ name: '', description: '', color: '#3b82f6' });
            setIsCategoryDialogOpen(true);
          }}
          size="sm"
          className="sm:size-default"
        >
          <Plus className="w-4 h-4 mr-0 sm:mr-2" />
          <span className="hidden sm:inline">Категория</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 h-9 sm:h-10">
          <TabsTrigger value="warehouse" className="text-xs sm:text-sm">Склад</TabsTrigger>
          <TabsTrigger value="issued" className="text-xs sm:text-sm">
            Выдано
            {movements.filter(m => m.is_returned !== true).length > 0 && (
              <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">{movements.filter(m => m.is_returned !== true).length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="repair" className="text-xs sm:text-sm">
            Ремонт
            {repairs.filter(r => r.status === 'in_repair').length > 0 && (
              <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">{repairs.filter(r => r.status === 'in_repair').length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Вкладка Склад */}
        <TabsContent value="warehouse" className="space-y-4">
          {categories.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Нет категорий</p>
                <p className="text-sm">Добавьте первую категорию кабелей</p>
              </CardContent>
            </Card>
          ) : (
            <CategoryList 
              categories={categoryTree}
              inventory={inventory}
              movements={movements}
              repairs={repairs}
              stats={stats}
              selectedItems={selectedItems}
              expandedCategories={expandedCategories}
              onToggleCategory={toggleCategory}
              onToggleItem={toggleItemSelection}
              onUpdateInventoryQty={handleUpdateInventoryQty}
              onDeleteInventory={onDeleteInventory}
              onAddInventory={openInventoryAdd}
              onEditInventory={openInventoryEdit}
              onEditCategory={openCategoryEdit}
              onDeleteCategory={onDeleteCategory}
              onSendToRepair={openRepairDialog}
            />
          )}
          
          {/* Плавающая панель выдачи */}
          {selectedItems.length > 0 && (
            <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm">
              <Card className="bg-blue-600 text-white shadow-lg border-0">
                <CardContent className="p-2 sm:p-3 flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-medium truncate">
                    Выбрано: {selectedItems.length}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={openBulkIssueDialog}
                      className="h-7 sm:h-8 text-xs sm:text-sm"
                    >
                      Выдать
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="text-white hover:text-white/80 h-7 sm:h-8 text-xs sm:text-sm px-2"
                      onClick={() => setSelectedItems([])}
                    >
                      Отмена
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Вкладка Выдано */}
        <TabsContent value="issued" className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <User className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Выданная коммутация</span>
                <span className="sm:hidden">Выдано</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movements.filter(m => m.is_returned !== true).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Всё на складе</p>
                  <p className="text-sm">Нет выданных позиций</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {movements.filter(m => m.is_returned !== true).map(movement => {
                    const category = categories.find(c => c.id === movement.category_id);
                    return (
                      <div 
                        key={movement.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg gap-2"
                      >
                        <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                          <Checkbox
                            checked={false}
                            onCheckedChange={() => onReturnCable(movement.id)}
                            className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 sm:mt-0 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm sm:text-base">
                              <div 
                                className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0"
                                style={{ backgroundColor: category?.color || '#ccc' }}
                              />
                              <span className="font-medium">{category?.name || 'Неизвестно'}</span>
                              {movement.equipment_name ? (
                                <span className="text-gray-600 text-sm">{movement.equipment_name}</span>
                              ) : (
                                <span className="text-gray-600 text-sm">{movement.length} м</span>
                              )}
                              <span className="text-gray-600 text-sm">× {movement.quantity} шт</span>
                            </div>
                            <div className="text-xs sm:text-sm text-gray-500 mt-1">
                              <User className="w-3 h-3 inline mr-1" />
                              {movement.issued_to}
                              {movement.contact && (
                                <span className="hidden sm:inline"> • {movement.contact}</span>
                              )}
                            </div>
                            {movement.contact && (
                              <div className="text-xs text-gray-400 sm:hidden">
                                {movement.contact}
                              </div>
                            )}
                            <div className="text-xs text-gray-400">
                              {format(new Date(movement.created_at || ''), 'dd.MM.yyyy HH:mm', { locale: ru })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка В ремонте */}
        <TabsContent value="repair" className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                🔧 <span className="hidden sm:inline">Оборудование в ремонте</span>
                <span className="sm:hidden">В ремонте</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {repairs.filter(r => r.status === 'in_repair').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm sm:text-base">Всё исправно</p>
                  <p className="text-xs sm:text-sm">Нет оборудования в ремонте</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {repairs.filter(r => r.status === 'in_repair').map(repair => {
                    const category = categories.find(c => c.id === repair.category_id);
                    return (
                      <div 
                        key={repair.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 bg-yellow-50 rounded-lg border border-yellow-200 gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm sm:text-base">
                            <div 
                              className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0"
                              style={{ backgroundColor: category?.color || '#ccc' }}
                            />
                            <span className="font-medium">{repair.equipment_name}</span>
                            <span className="text-gray-600 text-sm">× {repair.quantity} шт</span>
                            <Badge className={`${getRepairStatusColor(repair.status)} text-xs`}>
                              {getRepairStatusLabel(repair.status)}
                            </Badge>
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600 mt-1">
                            <span className="font-medium">Причина:</span> {repair.reason}
                          </div>
                          {repair.notes && (
                            <div className="text-xs sm:text-sm text-gray-500">
                              <span className="font-medium">Примечание:</span> {repair.notes}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            Отправлено: {format(new Date(repair.sent_date), 'dd.MM.yyyy')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 shrink-0 pt-1 sm:pt-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onUpdateRepairStatus?.(repair.id, 'repaired', new Date().toISOString())}
                            className="h-7 sm:h-8 px-2 text-xs sm:text-sm"
                          >
                            <span className="hidden sm:inline">✅ Отремонтировано</span>
                            <span className="sm:hidden">✅ Готово</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onUpdateRepairStatus?.(repair.id, 'written_off')}
                            className="h-7 sm:h-8 px-2 text-xs sm:text-sm text-red-600"
                          >
                            <span className="hidden sm:inline">🗑️ Списать</span>
                            <span className="sm:hidden">🗑️</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDeleteRepair?.(repair.id)}
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Диалог отправки в ремонт */}
      <Dialog open={isRepairDialogOpen} onOpenChange={setIsRepairDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6" aria-describedby="repair-dialog-desc">
          <DialogHeader>
            <DialogTitle>Отправить в ремонт</DialogTitle>
            <DialogDescription id="repair-dialog-desc">
              {repairForm.equipment_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Количество</label>
              <Input
                type="number"
                min={1}
                value={repairForm.quantity}
                onChange={(e) => setRepairForm({ ...repairForm, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Причина поломки *</label>
              <Input
                value={repairForm.reason}
                onChange={(e) => setRepairForm({ ...repairForm, reason: e.target.value })}
                placeholder="Например: Обрыв кабеля, неисправный разъем"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Примечание</label>
              <Input
                value={repairForm.notes}
                onChange={(e) => setRepairForm({ ...repairForm, notes: e.target.value })}
                placeholder="Дополнительная информация"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsRepairDialogOpen(false)}>
                Отмена
              </Button>
              <Button 
                onClick={handleSendToRepair}
                disabled={!repairForm.reason.trim()}
              >
                Отправить в ремонт
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог категории */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6" aria-describedby="category-dialog-desc">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Редактировать категорию' : 'Новая категория'}
            </DialogTitle>
            <DialogDescription id="category-dialog-desc">
              {editingCategory ? 'Измените данные категории' : 'Добавьте категорию кабелей'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Название *</label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Например: PowerCon Link"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Описание</label>
              <Input
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Опциональное описание"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Цвет</label>
              <div className="flex gap-2 flex-wrap mt-2 items-center">
                {CABLE_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategoryForm({ ...categoryForm, color: c.value })}
                    className={`w-8 h-8 rounded-full border-2 ${
                      categoryForm.color?.toLowerCase() === c.value.toLowerCase() ? 'border-gray-900 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
                <div className="flex items-center gap-2 ml-2">
                  <input
                    type="color"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                    title="Произвольный цвет"
                  />
                  <span className="text-xs text-gray-500">{categoryForm.color}</span>
                </div>
              </div>
            </div>
            
            {/* Выбор родительской категории */}
            <div>
              <label className="text-sm font-medium">Родительская категория</label>
              <select
                value={categoryForm.parent_id || ''}
                onChange={(e) => setCategoryForm({ ...categoryForm, parent_id: e.target.value || undefined })}
                className="w-full border rounded-md p-2 mt-1"
              >
                <option value="">— Корневая категория —</option>
                {flatCategoriesForSelect
                  .filter(cat => !editingCategory || cat.id !== editingCategory.id) // Нельзя выбрать себя
                  .map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {'  '.repeat(cat.level)}{cat.level > 0 ? '└ ' : ''}{cat.name}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Оставьте пустым для создания корневой категории
              </p>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                Отмена
              </Button>
              <Button 
                onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
                disabled={!categoryForm.name.trim()}
              >
                {editingCategory ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог добавления/редактирования позиции */}
      <Dialog open={isInventoryDialogOpen} onOpenChange={setIsInventoryDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6" aria-describedby="inventory-dialog-desc">
          <DialogHeader>
            <DialogTitle>{editingInventory ? 'Редактировать позицию' : 'Добавить позицию'}</DialogTitle>
            <DialogDescription id="inventory-dialog-desc">
              {editingInventory ? 'Измените данные позиции' : 'Укажите название (для оборудования) или длину (для кабелей) и количество'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Название позиции</label>
              <Input
                value={inventoryForm.name}
                onChange={(e) => setInventoryForm({ ...inventoryForm, name: e.target.value })}
                placeholder="Например: Микрофон Shure SM58 (для оборудования)"
              />
              <p className="text-xs text-gray-500 mt-1">Для кабелей оставьте пустым, укажите только длину</p>
            </div>
            <div>
              <label className="text-sm font-medium">Длина (м)</label>
              <Input
                type="number"
                step="0.5"
                value={inventoryForm.length}
                onChange={(e) => setInventoryForm({ ...inventoryForm, length: e.target.value })}
                placeholder="Например: 1.5 (для кабелей)"
              />
              <p className="text-xs text-gray-500 mt-1">Для оборудования без длины оставьте пустым</p>
            </div>
            <div>
              <label className="text-sm font-medium">Количество *</label>
              <Input
                type="number"
                value={inventoryForm.quantity}
                onChange={(e) => setInventoryForm({ ...inventoryForm, quantity: e.target.value })}
                placeholder="Сколько штук"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Минимальный остаток</label>
              <Input
                type="number"
                value={inventoryForm.min_quantity}
                onChange={(e) => setInventoryForm({ ...inventoryForm, min_quantity: e.target.value })}
                placeholder="При каком количестве предупреждать"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Комментарий</label>
              <Input
                value={inventoryForm.notes}
                onChange={(e) => setInventoryForm({ ...inventoryForm, notes: e.target.value })}
                placeholder="Например: в коробке по 10 шт, IP65"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsInventoryDialogOpen(false)}>
                Отмена
              </Button>
              <Button 
                onClick={editingInventory ? handleEditInventory : handleAddInventory}
                disabled={editingInventory 
                  ? (!inventoryForm.name && !inventoryForm.length)
                  : ((!inventoryForm.name && !inventoryForm.length) || !inventoryForm.quantity)
                }
              >
                {editingInventory ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* ������ �������� ������ */}
      <Dialog open={isBulkIssueDialogOpen} onOpenChange={setIsBulkIssueDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto" aria-describedby="bulk-issue-dialog-desc">
          <DialogHeader>
            <DialogTitle>Выдать кабель</DialogTitle>
            <DialogDescription id="bulk-issue-dialog-desc">
              Выбрано позиций: {bulkIssueForm.items.length}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Кому выдаётся *</label>
              <Input
                value={bulkIssueForm.issued_to}
                onChange={(e) => setBulkIssueForm({ ...bulkIssueForm, issued_to: e.target.value })}
                placeholder="ФИО или название организации"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Контакт</label>
              <Input
                value={bulkIssueForm.contact}
                onChange={(e) => setBulkIssueForm({ ...bulkIssueForm, contact: e.target.value })}
                placeholder="Телефон для связи"
              />
            </div>
            
            {/* Список выбранных позиций с редактированием количества */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Позиции:</label>
              {bulkIssueForm.items.map((item) => {
                const category = categories.find(c => c.id === item.category_id);
                return (
                  <div key={item.inventory_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category?.color || '#ccc' }} 
                      />
                      <span className="text-sm">{category?.name}</span>
                      <span className="text-sm text-gray-500">{item.length} м</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => updateBulkItemQuantity(item.inventory_id, item.quantity - 1)}
                      >
                        -
                      </Button>
                      <span className="text-sm w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => updateBulkItemQuantity(item.inventory_id, item.quantity + 1)}
                      >
                        +
                      </Button>
                      <span className="text-xs text-gray-400 ml-1">/ {item.available}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsBulkIssueDialogOpen(false)}>
                Отмена
              </Button>
              <Button 
                onClick={handleBulkIssue}
                disabled={!bulkIssueForm.issued_to.trim()}
              >
                Выдать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

// Компонент для сортируемой категории (drag-and-drop)
interface SortableCategoryItemProps {
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
  categoryName?: string;
  level?: number;
  isSortable?: boolean;
}

function SortableCategoryItem({
  category,
  inventory,
  movements,
  repairs,
  stats,
  selectedItems,
  expandedCategories,
  onToggleCategory,
  onToggleItem,
  onUpdateInventoryQty,
  onDeleteInventory,
  onAddInventory,
  onEditInventory,
  onEditCategory,
  onDeleteCategory,
  onSendToRepair,
  categoryName = '',
  level = 0,
  isSortable = false,
}: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id, disabled: !isSortable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Рендерим категорию через CategoryItem (вынесем в отдельный компонент)
  return (
    <div ref={setNodeRef} style={style} className={level > 0 ? 'ml-4 sm:ml-6' : ''}>
      <CategoryItem
        category={category}
        inventory={inventory}
        movements={movements}
        repairs={repairs}
        stats={stats}
        selectedItems={selectedItems}
        expandedCategories={expandedCategories}
        onToggleCategory={onToggleCategory}
        onToggleItem={onToggleItem}
        onUpdateInventoryQty={onUpdateInventoryQty}
        onDeleteInventory={onDeleteInventory}
        onAddInventory={onAddInventory}
        onEditInventory={onEditInventory}
        onEditCategory={onEditCategory}
        onDeleteCategory={onDeleteCategory}
        onSendToRepair={onSendToRepair}
        categoryName={categoryName}
        level={level}
        dragHandleProps={isSortable ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  );
}

// Компонент для отображения одной категории (без drag-and-drop логики)
interface CategoryItemProps {
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
  categoryName?: string;
  level?: number;
  dragHandleProps?: any;
}

function CategoryItem({
  category,
  inventory,
  movements,
  repairs,
  stats,
  selectedItems,
  expandedCategories,
  onToggleCategory,
  onToggleItem,
  onUpdateInventoryQty,
  onDeleteInventory,
  onAddInventory,
  onEditInventory,
  onEditCategory,
  onDeleteCategory,
  onSendToRepair,
  categoryName = '',
  level = 0,
  dragHandleProps,
}: CategoryItemProps) {
  const catInventory = inventory.filter(i => i.category_id === category.id).sort((a, b) => (a.length || 0) - (b.length || 0));
  const catStats = stats[category.id] || { totalLength: 0, totalQty: 0, issuedQty: 0, repairQty: 0 };
  const isExpanded = expandedCategories.has(category.id);
  const hasLowStock = catInventory.some(i => (i.min_quantity ?? 0) > 0 && i.quantity < (i.min_quantity ?? 0));
  const hasChildren = category.children && category.children.length > 0;
  
  // Подсчет выданного и в ремонте
  const getIssuedQtyForItem = (categoryId: string, length: number, name?: string) => {
    return movements
      .filter(m => !m.is_returned && m.category_id === categoryId)
      .filter(m => name ? m.equipment_name === name : m.length === length)
      .reduce((sum, m) => sum + m.quantity, 0);
  };

  const getRepairQtyForItem = (categoryId: string, length: number, name?: string) => {
    return repairs
      .filter(r => r.status === 'in_repair' && r.category_id === categoryId)
      .filter(r => name ? r.equipment_name === name : r.length === length)
      .reduce((sum, r) => sum + r.quantity, 0);
  };

  // Проверяем дочерние категории на low stock
  const checkChildrenLowStock = (cats: CableCategory[]): boolean => {
    return cats.some(cat => {
      const inv = inventory.filter(i => i.category_id === cat.id);
      const hasLow = inv.some(i => (i.min_quantity ?? 0) > 0 && i.quantity < (i.min_quantity ?? 0));
      return hasLow || (cat.children ? checkChildrenLowStock(cat.children) : false);
    });
  };
  const hasChildrenLowStock = category.children ? checkChildrenLowStock(category.children) : false;
  const showLowStock = hasLowStock || hasChildrenLowStock;

  return (
    <Card className={showLowStock ? 'border-orange-300' : ''}>
      <CardHeader className="pb-2">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => onToggleCategory(category.id)}
        >
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Drag handle */}
            {dragHandleProps && (
              <button
                {...dragHandleProps}
                className="p-1 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-4 h-4 text-gray-500" />
              </button>
            )}
            <div 
              className="w-3 h-3 sm:w-4 sm:h-4 rounded-full shrink-0"
              style={{ backgroundColor: category.color }}
            />
            {level > 0 && <span className="text-gray-400 text-xs sm:text-sm">└</span>}
            <CardTitle className={`${level > 0 ? 'text-sm sm:text-base' : 'text-base sm:text-lg'} truncate`}>
              {category.name}
            </CardTitle>
            {showLowStock && (
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-0 sm:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onAddInventory(category.id)}
              className="h-8 w-8 p-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onEditCategory(category)}
              className="h-8 w-8 p-0 hidden sm:flex"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onDeleteCategory(category.id)}
              className="h-8 w-8 p-0 hidden sm:flex"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleCategory(category.id)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        {category.description && (
          <p className="text-sm text-gray-500 mt-1">{category.description}</p>
        )}
        <div className="flex gap-2 sm:gap-4 mt-2 text-xs sm:text-sm flex-wrap">
          {catStats.totalLength > 0 && (
            <span className="text-gray-600">
              <span className="hidden sm:inline">Общий метраж: </span>
              <span className="sm:hidden">Метраж: </span>
              <strong>{catStats.totalLength.toFixed(1)} м</strong>
            </span>
          )}
          <span className="text-gray-600">
            <span className="hidden sm:inline">На складе: </span>
            <span className="sm:hidden">Склад: </span>
            <strong>{catStats.totalQty} шт</strong>
          </span>
          {catStats.issuedQty > 0 && (
            <span className="text-orange-600">
              <span className="hidden sm:inline">Выдано: </span>
              <span className="sm:hidden">Выд: </span>
              <strong>{catStats.issuedQty} шт</strong>
            </span>
          )}
          {catStats.repairQty > 0 && (
            <span className="text-yellow-600">
              <span className="hidden sm:inline">В ремонте: </span>
              <span className="sm:hidden">Рем: </span>
              <strong>{catStats.repairQty} шт</strong>
            </span>
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {catInventory.length === 0 ? (
            <p className="text-sm text-gray-500">Нет позиций</p>
          ) : (
            <div className="space-y-2">
              {catInventory.map(item => {
                const isSelected = selectedItems.some(i => i.inventory_id === item.id);
                const minQty = item.min_quantity ?? 0;
                const issuedQty = getIssuedQtyForItem(category.id, item.length || 0, item.name);
                const repairQty = getRepairQtyForItem(category.id, item.length || 0, item.name);
                const actualQty = item.quantity - issuedQty - repairQty;
                const isLow = minQty > 0 && actualQty < minQty;
                
                return (
                  <div 
                    key={item.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded gap-2 ${
                      isSelected ? 'bg-blue-50 border border-blue-200' : 
                      isLow ? 'bg-orange-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => actualQty > 0 && onToggleItem(item)}
                        disabled={actualQty <= 0}
                        className="shrink-0"
                      />
                      {item.name ? (
                        <span className="font-medium truncate text-sm sm:text-base" title={item.name}>{item.name}</span>
                      ) : (
                        <span className="font-medium w-14 sm:w-16 text-sm sm:text-base">{item.length} м</span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => onUpdateInventoryQty(item.id!, item.quantity - 1, item.length || 0)}
                          disabled={item.quantity <= 0}
                        >
                          -
                        </Button>
                        <span className={`text-sm w-8 sm:w-10 text-center ${isLow ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                          {actualQty}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => onUpdateInventoryQty(item.id!, item.quantity + 1, item.length || 0)}
                        >
                          +
                        </Button>
                      </div>
                      {issuedQty > 0 && (
                        <span className="text-xs text-orange-500 shrink-0 hidden sm:inline">({item.quantity} всего)</span>
                      )}
                      {repairQty > 0 && (
                        <span className="text-xs text-yellow-600 shrink-0" title="В ремонте">
                          🔧 {repairQty}
                        </span>
                      )}
                      {isLow && (
                        <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 hidden sm:block" />
                      )}
                      {item.notes && (
                        <span className="hidden sm:inline text-xs text-gray-500 truncate max-w-[200px]" title={item.notes}>
                          {item.notes}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-1 pl-6 sm:pl-0">
                      {item.notes && (
                        <span className="text-xs text-gray-500 truncate flex-1 sm:hidden" title={item.notes}>
                          {item.notes}
                        </span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSendToRepair?.(category.id, item, category.name)}
                          disabled={actualQty <= 0}
                          title="Отправить в ремонт"
                          className="h-7 w-7 sm:h-8 sm:w-auto sm:px-2 p-0"
                        >
                          <span className="hidden sm:inline">🔧</span>
                          <span className="sm:hidden text-xs">🔧</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditInventory(item, category.name)}
                          title="Редактировать"
                          className="h-7 w-7 sm:h-8 p-0"
                        >
                          <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDeleteInventory(item.id!)}
                          title="Удалить"
                          className="h-7 w-7 sm:h-8 p-0"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
      
      {/* Рекурсивный рендеринг подкатегорий */}
      {hasChildren && isExpanded && (
        <div className="mt-2 space-y-2">
          {category.children!.map(child => (
            <CategoryItem
              key={child.id}
              category={child}
              inventory={inventory}
              movements={movements}
              repairs={repairs}
              stats={stats}
              selectedItems={selectedItems}
              expandedCategories={expandedCategories}
              onToggleCategory={onToggleCategory}
              onToggleItem={onToggleItem}
              onUpdateInventoryQty={onUpdateInventoryQty}
              onDeleteInventory={onDeleteInventory}
              onAddInventory={onAddInventory}
              onEditInventory={onEditInventory}
              onEditCategory={onEditCategory}
              onDeleteCategory={onDeleteCategory}
              onSendToRepair={onSendToRepair}
              categoryName={category.name}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// Компонент для отображения списка категорий с поддержкой drag-and-drop
interface CategoryListProps {
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
  onReorderCategories?: (categoryIds: string[]) => Promise<{ error: any }>;
  categoryName?: string;
  level?: number;
}

function CategoryList({
  categories,
  inventory,
  movements,
  repairs,
  stats,
  selectedItems,
  expandedCategories,
  onToggleCategory,
  onToggleItem,
  onUpdateInventoryQty,
  onDeleteInventory,
  onAddInventory,
  onEditInventory,
  onEditCategory,
  onDeleteCategory,
  onSendToRepair,
  onReorderCategories,
  categoryName = '',
  level = 0,
}: CategoryListProps) {
  // Для корневого уровня используем DndContext если есть onReorderCategories
  const isRootLevel = level === 0;
  const canSort = isRootLevel && !!onReorderCategories && categories.length > 1;
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onReorderCategories) {
      const oldIndex = categories.findIndex(c => c.id === active.id);
      const newIndex = categories.findIndex(c => c.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const newCategories = arrayMove(categories, oldIndex, newIndex);
      const newCategoryIds = newCategories.map(c => c.id);
      
      // Вызываем callback для обновления порядка
      onReorderCategories(newCategoryIds);
    }
  };

  // Рендерим категорию
  const renderCategory = (category: CableCategory & { children?: CableCategory[] }) => {
    if (canSort) {
      return (
        <SortableCategoryItem
          key={category.id}
          category={category}
          inventory={inventory}
          movements={movements}
          repairs={repairs}
          stats={stats}
          selectedItems={selectedItems}
          expandedCategories={expandedCategories}
          onToggleCategory={onToggleCategory}
          onToggleItem={onToggleItem}
          onUpdateInventoryQty={onUpdateInventoryQty}
          onDeleteInventory={onDeleteInventory}
          onAddInventory={onAddInventory}
          onEditInventory={onEditInventory}
          onEditCategory={onEditCategory}
          onDeleteCategory={onDeleteCategory}
          onSendToRepair={onSendToRepair}
          categoryName={categoryName}
          level={level}
          isSortable={true}
        />
      );
    }
    
    return (
      <CategoryItem
        key={category.id}
        category={category}
        inventory={inventory}
        movements={movements}
        repairs={repairs}
        stats={stats}
        selectedItems={selectedItems}
        expandedCategories={expandedCategories}
        onToggleCategory={onToggleCategory}
        onToggleItem={onToggleItem}
        onUpdateInventoryQty={onUpdateInventoryQty}
        onDeleteInventory={onDeleteInventory}
        onAddInventory={onAddInventory}
        onEditInventory={onEditInventory}
        onEditCategory={onEditCategory}
        onDeleteCategory={onDeleteCategory}
        onSendToRepair={onSendToRepair}
        categoryName={categoryName}
        level={level}
      />
    );
  };

  if (canSort) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={categories.map(c => c.id)} 
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {categories.map(renderCategory)}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  return (
    <>
      {categories.map(renderCategory)}
    </>
  );
}

// Вспомогательная функция для подсчета статистики категории
function getCategoryStatsWithChildren(
  cat: CableCategory & { children?: CableCategory[] },
  inventory: CableInventory[],
  movements: CableMovement[],
  repairs: EquipmentRepair[]
) {
  const allIds = getAllCategoryIds(cat);
  const catInventory = inventory.filter(i => allIds.includes(i.category_id));
  
  const totalLength = catInventory.reduce((sum, i) => sum + ((i.length || 0) * i.quantity), 0);
  const totalQty = catInventory.reduce((sum, i) => sum + i.quantity, 0);
  const hasCables = catInventory.some(i => i.length && i.length > 0);
  const hasEquipment = catInventory.some(i => !i.length);
  
  const issuedQty = movements
    .filter(m => !m.is_returned && allIds.includes(m.category_id))
    .reduce((sum, m) => sum + m.quantity, 0);
  
  const repairQty = repairs
    .filter(r => r.status === 'in_repair' && allIds.includes(r.category_id))
    .reduce((sum, r) => sum + r.quantity, 0);
  
  return { totalLength, totalQty, issuedQty, repairQty, hasCables, hasEquipment };
}

function getAllCategoryIds(cat: CableCategory & { children?: CableCategory[] }): string[] {
  const ids = [cat.id];
  if (cat.children) {
    cat.children.forEach(child => {
      ids.push(...getAllCategoryIds(child));
    });
  }
  return ids;
}

export default CableManager;
