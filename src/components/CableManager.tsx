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
  Package,
  User,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Cable
} from 'lucide-react';
import type { CableCategory, CableInventory, CableMovement } from '../types/cable';
import { CABLE_COLORS } from '../types/cable';
import { Spinner } from './ui/spinner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface SelectedItem {
  inventory_id: string;
  category_id: string;
  length: number;
  available: number;
  quantity: number;
}

interface CableManagerProps {
  categories: CableCategory[];
  inventory: CableInventory[];
  movements: CableMovement[];
  stats: Record<string, { totalLength: number; totalQty: number; issuedQty: number }>;
  loading?: boolean;
  onAddCategory: (data: Omit<CableCategory, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<{ error: any }>;
  onUpdateCategory: (id: string, updates: Partial<CableCategory>) => Promise<{ error: any }>;
  onDeleteCategory: (id: string) => Promise<{ error: any }>;
  onUpsertInventory: (data: Omit<CableInventory, 'id' | 'created_at' | 'updated_at'>) => Promise<{ error: any }>;
  onUpdateInventoryQty?: (id: string, quantity: number) => Promise<{ error: any }>;
  onDeleteInventory: (id: string) => Promise<{ error: any }>;
  onIssueCable: (data: {
    category_id: string;
    inventory_id: string;
    length: number;
    quantity: number;
    issued_to: string;
    contact?: string;
  }) => Promise<{ error: any }>;
  onReturnCable: (movementId: string) => Promise<{ error: any }>;
  fabAction?: number;
}

export const CableManager = memo(function CableManager({
  categories,
  inventory,
  movements,
  stats,
  loading,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onUpsertInventory,
  onUpdateInventoryQty,
  onDeleteInventory,
  onIssueCable,
  onReturnCable,
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', color: '#3b82f6', parent_id: '' as string | undefined });
  const [inventoryForm, setInventoryForm] = useState({ category_id: '', length: '', quantity: '', min_quantity: '0', notes: '' });
  

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
      length: parseFloat(inventoryForm.length),
      quantity: parseInt(inventoryForm.quantity),
      min_quantity: isNaN(minQty) ? 0 : minQty,
      notes: inventoryForm.notes || undefined,
    });
    if (!error) {
      setIsInventoryDialogOpen(false);
      setInventoryForm({ category_id: '', length: '', quantity: '', min_quantity: '0', notes: '' });
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
      toast.error('Укажите, кому выдается кабель');
      return;
    }

    let hasError = false;
    
    for (const item of bulkIssueForm.items) {
      if (item.quantity <= 0 || item.quantity > item.available) {
        toast.error(`Некорректное количество для ${item.length}м`);
        hasError = true;
        break;
      }
      
      const { error } = await onIssueCable({
        category_id: item.category_id,
        inventory_id: item.inventory_id,
        length: item.length,
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
      toast.success('Кабель успешно выдан');
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
    setInventoryForm({ category_id: categoryId, length: '', quantity: '', min_quantity: '0', notes: '' });
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
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Cable className="w-7 h-7 text-blue-600" />
          Учет оборудования
        </h1>
        <Button onClick={() => {
          setEditingCategory(null);
          setCategoryForm({ name: '', description: '', color: '#3b82f6' });
          setIsCategoryDialogOpen(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Категория
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="warehouse">На складе</TabsTrigger>
          <TabsTrigger value="issued">
            Выдано
            {movements.length > 0 && (
              <Badge variant="secondary" className="ml-2">{movements.length}</Badge>
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
              stats={stats}
              selectedItems={selectedItems}
              expandedCategories={expandedCategories}
              onToggleCategory={toggleCategory}
              onToggleItem={toggleItemSelection}
              onUpdateInventoryQty={handleUpdateInventoryQty}
              onDeleteInventory={onDeleteInventory}
              onAddInventory={openInventoryAdd}
              onEditCategory={openCategoryEdit}
              onDeleteCategory={onDeleteCategory}
            />
          )}
          
          {/* Плавающая панель выдачи */}
          {selectedItems.length > 0 && (
            <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50">
              <Card className="bg-blue-600 text-white shadow-lg border-0">
                <CardContent className="p-3 flex items-center gap-4">
                  <span className="text-sm font-medium">
                    Выбрано: {selectedItems.length} позиций
                  </span>
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={openBulkIssueDialog}
                  >
                    Выдать
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="text-white hover:text-white/80"
                    onClick={() => setSelectedItems([])}
                  >
                    Отмена
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Вкладка Выдано */}
        <TabsContent value="issued">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Выданная коммутация
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movements.filter(m => !m.is_returned).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Всё на складе</p>
                  <p className="text-sm">Нет выданных позиций</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {movements.filter(m => !m.is_returned).map(movement => {
                    const category = categories.find(c => c.id === movement.category_id);
                    return (
                      <div 
                        key={movement.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={false}
                            onCheckedChange={() => onReturnCable(movement.id)}
                            className="w-5 h-5"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: category?.color || '#ccc' }}
                              />
                              <span className="font-medium">{category?.name || 'Неизвестно'}</span>
                              <span className="text-gray-600">{movement.length} м</span>
                              <span className="text-gray-600">× {movement.quantity} шт</span>
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              <User className="w-3 h-3 inline mr-1" />
                              {movement.issued_to}
                              {movement.contact && ` • ${movement.contact}`}
                            </div>
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
      </Tabs>

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

      {/* Диалог добавления позиции */}
      <Dialog open={isInventoryDialogOpen} onOpenChange={setIsInventoryDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6" aria-describedby="inventory-dialog-desc">
          <DialogHeader>
            <DialogTitle>Добавить позицию</DialogTitle>
            <DialogDescription id="inventory-dialog-desc">
              Укажите длину и количество
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Длина (м) *</label>
              <Input
                type="number"
                step="0.5"
                value={inventoryForm.length}
                onChange={(e) => setInventoryForm({ ...inventoryForm, length: e.target.value })}
                placeholder="Например: 1.5"
              />
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
                onClick={handleAddInventory}
                disabled={!inventoryForm.length || !inventoryForm.quantity}
              >
                Добавить
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

// Рекурсивный компонент для отображения категорий с подкатегориями
interface CategoryListProps {
  categories: (CableCategory & { children?: CableCategory[]; level?: number })[];
  inventory: CableInventory[];
  movements: CableMovement[];
  stats: Record<string, { totalLength: number; totalQty: number; issuedQty: number }>;
  selectedItems: SelectedItem[];
  expandedCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  onToggleItem: (item: CableInventory) => void;
  onUpdateInventoryQty: (id: string, newQty: number, length: number) => void;
  onDeleteInventory: (id: string) => Promise<{ error: any }>;
  onAddInventory: (categoryId: string) => void;
  onEditCategory: (cat: CableCategory) => void;
  onDeleteCategory: (id: string) => Promise<{ error: any }>;
  level?: number;
}

function CategoryList({
  categories,
  inventory,
  movements,
  stats,
  selectedItems,
  expandedCategories,
  onToggleCategory,
  onToggleItem,
  onUpdateInventoryQty,
  onDeleteInventory,
  onAddInventory,
  onEditCategory,
  onDeleteCategory,
  level = 0,
}: CategoryListProps) {
  // Подсчет выданного по конкретной позиции (по category_id и length)
  const getIssuedQtyForItem = (categoryId: string, length: number) => {
    return movements
      .filter(m => !m.is_returned && m.category_id === categoryId && m.length === length)
      .reduce((sum, m) => sum + m.quantity, 0);
  };
  return (
    <>
      {categories.map(category => {
        const catInventory = inventory.filter(i => i.category_id === category.id).sort((a, b) => a.length - b.length);
        const catStats = stats[category.id] || { totalLength: 0, totalQty: 0, issuedQty: 0 };
        const isExpanded = expandedCategories.has(category.id);
        const hasLowStock = catInventory.some(i => (i.min_quantity ?? 0) > 0 && i.quantity < (i.min_quantity ?? 0));
        const hasChildren = category.children && category.children.length > 0;

        return (
          <div key={category.id} style={{ marginLeft: level > 0 ? `${level * 24}px` : 0 }}>
            <Card className={hasLowStock ? 'border-orange-300' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    {level > 0 && <span className="text-gray-400">└</span>}
                    <CardTitle className={`${level > 0 ? 'text-base' : 'text-lg'}`}>
                      {category.name}
                    </CardTitle>
                    {hasLowStock && (
                      <AlertCircle className="w-5 h-5 text-orange-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onAddInventory(category.id)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onEditCategory(category)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onDeleteCategory(category.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleCategory(category.id)}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {category.description && (
                  <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                )}
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-gray-600">
                    Общий метраж: <strong>{catStats.totalLength.toFixed(1)} м</strong>
                  </span>
                  <span className="text-gray-600">
                    На складе: <strong>{catStats.totalQty} шт</strong>
                  </span>
                  {catStats.issuedQty > 0 && (
                    <span className="text-orange-600">
                      Выдано: <strong>{catStats.issuedQty} шт</strong>
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
                        const issuedQty = getIssuedQtyForItem(category.id, item.length);
                        const actualQty = item.quantity - issuedQty;
                        const isLow = minQty > 0 && actualQty < minQty;
                        
                        return (
                          <div 
                            key={item.id}
                            className={`flex items-center justify-between p-2 rounded ${
                              isSelected ? 'bg-blue-50 border border-blue-200' : 
                              isLow ? 'bg-orange-50' : 'bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Чекбокс выбора */}
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => actualQty > 0 && onToggleItem(item)}
                                disabled={actualQty <= 0}
                              />
                              
                              <span className="font-medium w-16">{item.length} м</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => onUpdateInventoryQty(item.id!, item.quantity - 1, item.length)}
                                  disabled={item.quantity <= 0}
                                >
                                  -
                                </Button>
                                <span className={`text-sm w-10 text-center ${isLow ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                                  {actualQty}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => onUpdateInventoryQty(item.id!, item.quantity + 1, item.length)}
                                >
                                  +
                                </Button>
                              </div>
                              {issuedQty > 0 && (
                                <span className="text-xs text-orange-500">({item.quantity} всего)</span>
                              )}
                              {isLow && (
                                <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
                              )}
                              {item.notes && (
                                <span className="text-sm text-gray-500 truncate max-w-[150px]" title={item.notes}>
                                  {item.notes}
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDeleteInventory(item.id!)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
            
            {/* Рекурсивный рендеринг подкатегорий */}
            {hasChildren && isExpanded && (
              <div className="mt-2 space-y-2">
                <CategoryList
                  categories={category.children!}
                  inventory={inventory}
                  movements={movements}
                  stats={stats}
                  selectedItems={selectedItems}
                  expandedCategories={expandedCategories}
                  onToggleCategory={onToggleCategory}
                  onToggleItem={onToggleItem}
                  onUpdateInventoryQty={onUpdateInventoryQty}
                  onDeleteInventory={onDeleteInventory}
                  onAddInventory={onAddInventory}
                  onEditCategory={onEditCategory}
                  onDeleteCategory={onDeleteCategory}
                  level={level + 1}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export default CableManager;

