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
  onDeleteInventory,
  onIssueCable,
  onReturnCable,
  fabAction,
}: CableManagerProps) {
  const [activeTab, setActiveTab] = useState('warehouse');
  
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
      } else if (activeTab === 'issue') {
        setIssueForm({
          category_id: '',
          inventory_id: '',
          length: 0,
          availableQty: 0,
          quantity: '',
          issued_to: '',
          contact: '',
        });
        setIsIssueDialogOpen(true);
      }
    }
  }, [fabAction]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isInventoryDialogOpen, setIsInventoryDialogOpen] = useState(false);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CableCategory | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', color: '#3b82f6' });
  const [inventoryForm, setInventoryForm] = useState({ category_id: '', length: '', quantity: '', min_quantity: '0', notes: '' });
  const [issueForm, setIssueForm] = useState({
    category_id: '',
    inventory_id: '',
    length: 0,
    availableQty: 0,
    quantity: '',
    issued_to: '',
    contact: '',
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
      sort_order: categories.length,
    });
    if (!error) {
      setIsCategoryDialogOpen(false);
      setCategoryForm({ name: '', description: '', color: '#3b82f6' });
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    const { error } = await onUpdateCategory(editingCategory.id, categoryForm);
    if (!error) {
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', color: '#3b82f6' });
    }
  };

  const handleAddInventory = async () => {
    const { error } = await onUpsertInventory({
      category_id: inventoryForm.category_id,
      length: parseFloat(inventoryForm.length),
      quantity: parseInt(inventoryForm.quantity),
      min_quantity: parseInt(inventoryForm.min_quantity) || 5,
      notes: inventoryForm.notes || undefined,
    });
    if (!error) {
      setIsInventoryDialogOpen(false);
      setInventoryForm({ category_id: '', length: '', quantity: '', min_quantity: '5', notes: '' });
    }
  };

  // Обновление количества напрямую
  const handleUpdateInventoryQty = async (id: string, newQty: number, length: number) => {
    if (newQty < 0) return;
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
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

  const handleIssue = async () => {
    const qty = parseInt(issueForm.quantity);
    if (qty > issueForm.availableQty) {
      alert('Недостаточно на складе!');
      return;
    }
    const { error } = await onIssueCable({
      category_id: issueForm.category_id,
      inventory_id: issueForm.inventory_id,
      length: issueForm.length,
      quantity: qty,
      issued_to: issueForm.issued_to,
      contact: issueForm.contact || undefined,
    });
    if (!error) {
      setIsIssueDialogOpen(false);
      setIssueForm({
        category_id: '',
        inventory_id: '',
        length: 0,
        availableQty: 0,
        quantity: '',
        issued_to: '',
        contact: '',
      });
    }
  };

  const openIssueDialog = (categoryId: string, invId: string, length: number, available: number) => {
    setIssueForm({
      category_id: categoryId,
      inventory_id: invId,
      length,
      availableQty: available,
      quantity: '',
      issued_to: '',
      contact: '',
    });
    setIsIssueDialogOpen(true);
  };

  const openCategoryEdit = (cat: CableCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      description: cat.description || '',
      color: cat.color?.toLowerCase() || '#3b82f6',
    });
    setIsCategoryDialogOpen(true);
  };

  const openInventoryAdd = (categoryId: string) => {
    setInventoryForm({ category_id: categoryId, length: '', quantity: '', min_quantity: '0', notes: '' });
    setIsInventoryDialogOpen(true);
  };

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
          Коммутация
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
          <TabsTrigger value="warehouse">Склад</TabsTrigger>
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
            categories.map(category => {
              const catInventory = inventory.filter(i => i.category_id === category.id).sort((a, b) => a.length - b.length);
              const catStats = stats[category.id] || { totalLength: 0, totalQty: 0, issuedQty: 0 };
              const isExpanded = expandedCategories.has(category.id);
              const hasLowStock = catInventory.some(i => i.quantity < i.min_quantity);

              return (
                <Card key={category.id} className={hasLowStock ? 'border-orange-300' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        {hasLowStock && (
                          <AlertCircle className="w-5 h-5 text-orange-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openInventoryAdd(category.id)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openCategoryEdit(category)}
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
                          onClick={() => toggleCategory(category.id)}
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
                          {catInventory.map(item => (
                            <div 
                              key={item.id}
                              className={`flex items-center justify-between p-2 rounded ${
                                item.quantity < item.min_quantity ? 'bg-orange-50' : 'bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-medium w-16">{item.length} м</span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleUpdateInventoryQty(item.id, item.quantity - 1, item.length)}
                                    disabled={item.quantity <= 0}
                                  >
                                    -
                                  </Button>
                                  <span className={`text-sm w-10 text-center ${item.quantity < item.min_quantity ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                                    {item.quantity}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleUpdateInventoryQty(item.id, item.quantity + 1, item.length)}
                                  >
                                    +
                                  </Button>
                                </div>
                                {item.quantity < item.min_quantity && (
                                  <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
                                )}
                                {item.notes && (
                                  <span className="text-sm text-gray-500 truncate max-w-[150px]" title={item.notes}>
                                    {item.notes}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {item.quantity > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openIssueDialog(category.id, item.id, item.length, item.quantity)}
                                  >
                                    Выдать
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onDeleteInventory(item.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })
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
              {movements.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Всё на складе</p>
                  <p className="text-sm">Нет выданных позиций</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {movements.map(movement => {
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
        <DialogContent className="max-w-md" aria-describedby="category-dialog-desc">
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
        <DialogContent className="max-w-md" aria-describedby="inventory-dialog-desc">
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

      {/* Диалог выдачи */}
      <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
        <DialogContent className="max-w-md" aria-describedby="issue-dialog-desc">
          <DialogHeader>
            <DialogTitle>Выдать кабель</DialogTitle>
            <DialogDescription id="issue-dialog-desc">
              Доступно: {issueForm.availableQty} шт × {issueForm.length} м
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Кому выдаётся *</label>
              <Input
                value={issueForm.issued_to}
                onChange={(e) => setIssueForm({ ...issueForm, issued_to: e.target.value })}
                placeholder="ФИО или название организации"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Контакт</label>
              <Input
                value={issueForm.contact}
                onChange={(e) => setIssueForm({ ...issueForm, contact: e.target.value })}
                placeholder="Телефон для связи"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Количество *</label>
              <Input
                type="number"
                max={issueForm.availableQty}
                value={issueForm.quantity}
                onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })}
                placeholder={`Максимум ${issueForm.availableQty}`}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsIssueDialogOpen(false)}>
                Отмена
              </Button>
              <Button 
                onClick={handleIssue}
                disabled={!issueForm.issued_to.trim() || !issueForm.quantity || parseInt(issueForm.quantity) > issueForm.availableQty}
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
