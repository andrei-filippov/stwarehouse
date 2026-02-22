import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Spinner } from './ui/spinner';
import { Plus, Upload, Download, Trash2, Edit, Search, FolderPlus, ChevronDown, ChevronUp, Package } from 'lucide-react';
import type { Equipment } from '../types';
import { EquipmentImportDialog } from './EquipmentImportDialog';

interface EquipmentManagerProps {
  equipment: Equipment[];
  categories: { id: string; name: string }[];
  userId: string | undefined;
  onAdd: (item: Omit<Equipment, 'id' | 'created_at' | 'updated_at'> & { user_id: string }) => Promise<{ error: any }>;
  onUpdate: (id: string, updates: Partial<Equipment>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
  onBulkInsert: (items: (Omit<Equipment, 'id' | 'created_at' | 'updated_at'> & { user_id: string })[]) => Promise<{ error: any; count?: number }>;
  onAddCategory: (name: string) => Promise<{ error: any; data?: any }>;
  onDeleteCategory: (id: string) => Promise<{ error: any }>;
  loading?: boolean;
}

export const EquipmentManager = memo(function EquipmentManager({ 
  equipment, 
  categories, 
  userId,
  onAdd, 
  onUpdate, 
  onDelete,
  onBulkInsert,
  onAddCategory,
  onDeleteCategory,
  loading
}: EquipmentManagerProps) {
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Мемоизация фильтрации и группировки
  const filteredEquipment = useMemo(() => {
    if (!search.trim()) return equipment;
    const searchLower = search.toLowerCase();
    return equipment.filter(item =>
      item.name.toLowerCase().includes(searchLower) ||
      item.category.toLowerCase().includes(searchLower) ||
      (item.description && item.description.toLowerCase().includes(searchLower))
    );
  }, [equipment, search]);

  const groupedByCategory = useMemo(() => {
    return filteredEquipment.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, Equipment[]>);
  }, [filteredEquipment]);

  const sortedCategories = useMemo(() => Object.keys(groupedByCategory).sort(), [groupedByCategory]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(category)) {
        newExpanded.delete(category);
      } else {
        newExpanded.add(category);
      }
      return newExpanded;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedCategories(new Set(sortedCategories));
  }, [sortedCategories]);

  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);

  const handleImportSuccess = useCallback(() => {
    setIsImportDialogOpen(false);
  }, []);

  // Оптимизированный экспорт с динамическим импортом
  const exportToExcel = useCallback(async () => {
    const XLSX = await import('xlsx');
    
    const data = equipment.map(item => ({
      'Название': item.name,
      'Категория': item.category,
      'Количество': item.quantity,
      'Ед.изм': item.unit || 'шт',
      'Цена': item.price,
      'Описание': item.description
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Оборудование');
    XLSX.writeFile(wb, 'оборудование.xlsx');
  }, [equipment]);

  const handleSubmit = useCallback(async (data: any) => {
    setSubmitting(true);
    if (editingItem) {
      const { error } = await onUpdate(editingItem.id, data);
      if (!error) setEditingItem(null);
    } else {
      if (!userId) return;
      const itemData = { ...data, user_id: userId };
      const { error } = await onAdd(itemData);
      if (!error) setIsAddDialogOpen(false);
    }
    setSubmitting(false);
  }, [editingItem, userId, onUpdate, onAdd]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-sm hover:shadow-md transition-shadow rounded-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <CardTitle className="text-xl flex items-center gap-2">
              <Package className="w-5 h-5" />
              Оборудование
            </CardTitle>
            <div className="flex gap-1.5 md:gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={expandAll} className="rounded-lg shadow-sm hover:shadow-md transition-all">
                <span className="hidden md:inline mr-2">Развернуть все</span>
                <span className="md:hidden">+</span>
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} className="rounded-lg shadow-sm hover:shadow-md transition-all">
                <span className="hidden md:inline mr-2">Свернуть все</span>
                <span className="md:hidden">-</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)} className="rounded-lg shadow-sm hover:shadow-md transition-all">
                <Upload className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Импорт</span>
              </Button>
              <Button variant="outline" size="sm" onClick={exportToExcel} className="rounded-lg shadow-sm hover:shadow-md transition-all">
                <Download className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Excel</span>
              </Button>
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)} className="rounded-lg shadow-sm hover:shadow-md transition-all">
                <Plus className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Добавить</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Поиск оборудования..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-lg"
            />
          </div>

          <div className="space-y-3">
            {sortedCategories.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Нет оборудования</p>
            ) : (
              sortedCategories.map(category => {
                const items = groupedByCategory[category];
                const isExpanded = expandedCategories.has(category);
                
                return (
                  <Card key={category} className="overflow-hidden shadow-sm hover:shadow-md transition-all rounded-xl border">
                    <div 
                      className="bg-gradient-to-r from-gray-50 to-gray-100 p-3 flex items-center justify-between cursor-pointer hover:from-gray-100 hover:to-gray-200 transition-all"
                      onClick={() => toggleCategory(category)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronUp className="w-5 h-5 text-gray-500" />}
                        <span className="font-semibold text-gray-800">{category}</span>
                        <Badge variant="secondary" className="rounded-md">{items.length}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-500">
                          {items.reduce((sum, i) => sum + i.quantity, 0)} ед.
                        </div>
                        {items.length === 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-lg hover:bg-red-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              const cat = categories.find(c => c.name === category);
                              if (cat && confirm(`Удалить категорию "${category}"?`)) {
                                onDeleteCategory(cat.id);
                              }
                            }}
                            title="Удалить пустую категорию"
                          >
                            <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="border-t">
                        {/* Desktop Table */}
                        <div className="hidden md:block">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50 hover:bg-gray-50">
                                <TableHead>Название</TableHead>
                                <TableHead>Описание</TableHead>
                                <TableHead className="w-24">Кол-во</TableHead>
                                <TableHead className="w-20">Ед.</TableHead>
                                <TableHead className="w-32">Цена</TableHead>
                                <TableHead className="w-24 text-right">Действия</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item) => (
                                <TableRow key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{item.name}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <p className="text-sm text-gray-600 max-w-xs truncate" title={item.description}>
                                      {item.description || '—'}
                                    </p>
                                  </TableCell>
                                  <TableCell>{item.quantity}</TableCell>
                                  <TableCell>{item.unit || 'шт'}</TableCell>
                                  <TableCell className="font-medium">{item.price.toLocaleString('ru-RU')} ₽</TableCell>
                                  <TableCell>
                                    <div className="flex justify-end gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => setEditingItem(item)}
                                        className="rounded-lg hover:bg-blue-100"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => onDelete(item.id)}
                                        className="rounded-lg hover:bg-red-100"
                                      >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        
                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-2 p-3">
                          {items.map((item) => (
                            <Card key={item.id} className="p-3 shadow-sm hover:shadow-md transition-all rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{item.name}</p>
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">{item.description || '—'}</p>
                                </div>
                                <div className="flex gap-1 ml-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-lg hover:bg-blue-100"
                                    onClick={() => setEditingItem(item)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-lg hover:bg-red-100"
                                    onClick={() => onDelete(item.id)}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-sm pt-2 border-t">
                                <div className="flex gap-3 text-gray-600">
                                  <span>{item.quantity} {item.unit || 'шт'}</span>
                                </div>
                                <span className="font-semibold text-green-700">{item.price.toLocaleString('ru-RU')} ₽</span>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <EquipmentImportDialog
        isOpen={isImportDialogOpen}
        onClose={handleImportSuccess}
        categories={categories}
        userId={userId}
        onBulkInsert={onBulkInsert}
        onAddCategory={onAddCategory}
      />

      <Dialog open={isAddDialogOpen || !!editingItem} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingItem(null);
        }
      }}>
        <DialogContent className="max-w-lg rounded-xl" aria-describedby="equipment-dialog-desc">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Редактировать оборудование' : 'Добавить оборудование'}
            </DialogTitle>
            <DialogDescription id="equipment-dialog-desc">
              {editingItem ? 'Измените данные оборудования' : 'Заполните данные нового оборудования'}
            </DialogDescription>
          </DialogHeader>
          <EquipmentForm 
            categories={categories}
            userId={userId}
            initialData={editingItem}
            onSubmit={handleSubmit}
            onAddCategory={onAddCategory}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface EquipmentFormProps {
  categories: { id: string; name: string }[];
  userId: string | undefined;
  initialData?: Partial<Equipment> | null;
  onSubmit: (data: any) => Promise<void>;
  onAddCategory: (name: string) => Promise<{ error: any; data?: any }>;
  submitting: boolean;
}

function EquipmentForm({ categories, userId, initialData, onSubmit, onAddCategory, submitting }: EquipmentFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: '',
    price: '',
    description: '',
    unit: 'шт'
  });
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [customUnit, setCustomUnit] = useState('');

  const UNIT_OPTIONS = ['шт', 'комплект', 'услуга', 'человек', 'п.м.'];

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        category: initialData.category || '',
        quantity: initialData.quantity?.toString() || '',
        price: initialData.price?.toString() || '',
        description: initialData.description || '',
        unit: initialData.unit || 'шт'
      });
      if (initialData.unit && !UNIT_OPTIONS.includes(initialData.unit)) {
        setIsCustomUnit(true);
        setCustomUnit(initialData.unit);
      } else {
        setIsCustomUnit(false);
        setCustomUnit('');
      }
    }
  }, [initialData?.id]);

  const handleNumberChange = (field: string, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const { error } = await onAddCategory(newCategoryName.trim());
    if (!error) {
      setFormData(prev => ({ ...prev, category: newCategoryName.trim() }));
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    if (!formData.category) return;
    const finalUnit = isCustomUnit && customUnit.trim() ? customUnit.trim() : (formData.unit || 'шт');
    const data = {
      name: formData.name.trim(),
      category: formData.category,
      quantity: parseInt(formData.quantity) || 0,
      price: parseFloat(formData.price) || 0,
      description: formData.description || '',
      unit: finalUnit
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmitForm} className="space-y-4">
      <div className="space-y-2">
        <Label>Название *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Например: Микшер Yamaha MG16"
          required
          className="rounded-lg"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Категория *</Label>
          <Button 
            type="button" 
            variant="ghost" 
            size="sm"
            onClick={() => setIsAddingCategory(!isAddingCategory)}
            className="rounded-lg"
          >
            <FolderPlus className="w-4 h-4 mr-1" />
            {isAddingCategory ? 'Отмена' : 'Новая категория'}
          </Button>
        </div>
        
        {isAddingCategory ? (
          <div className="flex gap-2">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Название новой категории"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
              className="rounded-lg"
            />
            <Button type="button" onClick={handleAddCategory} className="rounded-lg">
              Добавить
            </Button>
          </div>
        ) : (
          <select
            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            required
          >
            <option value="">Выберите категорию</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Количество</Label>
          <Input
            type="number"
            min="0"
            value={formData.quantity}
            onChange={(e) => handleNumberChange('quantity', e.target.value)}
            className="rounded-lg"
          />
        </div>
        <div className="space-y-2">
          <Label>Ед. изм.</Label>
          {isCustomUnit ? (
            <div className="flex gap-2">
              <Input
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                placeholder="Введите единицу"
                className="rounded-lg"
              />
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => {
                  if (customUnit.trim()) {
                    setFormData(prev => ({ ...prev, unit: customUnit.trim() }));
                  }
                  setIsCustomUnit(false);
                }}
                className="rounded-lg"
              >
                OK
              </Button>
            </div>
          ) : (
            <select
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={UNIT_OPTIONS.includes(formData.unit) ? formData.unit : 'custom'}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setIsCustomUnit(true);
                  setCustomUnit('');
                } else {
                  setFormData({ ...formData, unit: e.target.value });
                }
              }}
            >
              {UNIT_OPTIONS.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
              <option value="custom">+ Своя единица</option>
            </select>
          )}
        </div>
        <div className="space-y-2">
          <Label>Цена (₽)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formData.price}
            onChange={(e) => handleNumberChange('price', e.target.value)}
            className="rounded-lg"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Описание</Label>
        <textarea
          className="w-full border rounded-lg p-2 min-h-[80px] resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Технические характеристики, примечания..."
        />
      </div>

      <Button type="submit" className="w-full rounded-lg" disabled={submitting}>
        {submitting && <Spinner className="w-4 h-4 mr-2" />}
        {initialData ? 'Сохранить' : 'Добавить'}
      </Button>
    </form>
  );
}
