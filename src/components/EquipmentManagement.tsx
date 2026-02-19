import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Plus, Upload, Download, Trash2, Edit, Search, FolderPlus, ChevronDown, ChevronUp } from 'lucide-react';
import type { Equipment } from '../types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface EquipmentManagerProps {
  equipment: Equipment[];
  categories: { id: string; name: string }[];
  userId: string | undefined;
  onAdd: (item: Omit<Equipment, 'id' | 'created_at' | 'updated_at'> & { user_id: string }) => Promise<{ error: any }>;
  onUpdate: (id: string, updates: Partial<Equipment>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
  onBulkInsert: (items: (Omit<Equipment, 'id' | 'created_at' | 'updated_at'> & { user_id: string })[]) => Promise<{ error: any; count?: number }>;
  onAddCategory: (name: string) => Promise<{ error: any; data?: any }>;
}

export function EquipmentManager({ 
  equipment, 
  categories, 
  userId,
  onAdd, 
  onUpdate, 
  onDelete,
  onBulkInsert,
  onAddCategory
}: EquipmentManagerProps) {
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Фильтрация оборудования
  const filteredEquipment = equipment.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(search.toLowerCase()))
  );

  // Группировка по категориям
  const groupedByCategory = filteredEquipment.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, Equipment[]>);

  // Сортировка категорий
  const sortedCategories = Object.keys(groupedByCategory).sort();

  // Переключение разворачивания категории
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Развернуть все
  const expandAll = () => {
    setExpandedCategories(new Set(sortedCategories));
  };

  // Свернуть все
  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = (event) => {
      const data = event.target?.result;
      
      if (file.name.endsWith('.csv')) {
        Papa.parse(data as string, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            processImportData(results.data);
          }
        });
      } else {
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        processImportData(jsonData);
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const processImportData = (data: any[]) => {
    const processed = data.map((row: any) => ({
      name: row.name || row.Название || row['Наименование'] || '',
      category: row.category || row.Категория || row['Категория'] || 'Общее',
      quantity: parseInt(row.quantity || row.Количество || row['Кол-во'] || 0),
      price: parseFloat(row.price || row.Цена || row['Стоимость'] || 0),
      description: row.description || row.Описание || '',
      unit: row.unit || row['Ед.изм'] || row['Единица'] || 'шт'
    })).filter(item => item.name);

    setImportData(processed);
    setImportPreview(true);
  };

  const handleImport = async () => {
    if (!userId) {
      console.error('userId is undefined');
      return;
    }
    const itemsWithUserId = importData.map(item => ({ ...item, user_id: userId }));
    const { error } = await onBulkInsert(itemsWithUserId);
    if (!error) {
      setIsImportDialogOpen(false);
      setImportPreview(false);
      setImportData([]);
    }
  };

  const exportToExcel = () => {
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
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <CardTitle className="text-lg md:text-xl">Оборудование</CardTitle>
            <div className="flex gap-1.5 md:gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={expandAll} className="text-xs md:text-sm px-2 md:px-3">
                <span className="hidden md:inline mr-2">Развернуть</span>
                <span className="md:hidden">+</span>
                <span className="hidden sm:inline">все</span>
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} className="text-xs md:text-sm px-2 md:px-3">
                <span className="hidden md:inline mr-2">Свернуть</span>
                <span className="md:hidden">-</span>
                <span className="hidden sm:inline">все</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)} className="px-2 md:px-3">
                <Upload className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Импорт</span>
              </Button>
              <Button variant="outline" size="sm" onClick={exportToExcel} className="px-2 md:px-3">
                <Download className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Excel</span>
              </Button>
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)} className="px-2 md:px-3">
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
              className="pl-10"
            />
          </div>

          {/* Группировка по категориям */}
          <div className="space-y-4">
            {sortedCategories.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Нет оборудования</p>
            ) : (
              sortedCategories.map(category => {
                const items = groupedByCategory[category];
                const isExpanded = expandedCategories.has(category);
                
                return (
                  <Card key={category} className="overflow-hidden">
                    <div 
                      className="bg-gray-50 p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleCategory(category)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                        <span className="font-semibold">{category}</span>
                        <Badge variant="secondary">{items.length}</Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        {items.reduce((sum, i) => sum + i.quantity, 0)} ед.
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="border-t">
                        {/* Desktop Table */}
                        <div className="hidden md:block">
                          <Table>
                            <TableHeader>
                              <TableRow>
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
                                <TableRow key={item.id}>
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
                                  <TableCell>{item.price.toLocaleString('ru-RU')} ₽</TableCell>
                                  <TableCell>
                                    <div className="flex justify-end gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => setEditingItem(item)}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => onDelete(item.id)}
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
                        <div className="md:hidden space-y-2 p-2">
                          {items.map((item) => (
                            <Card key={item.id} className="p-3">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{item.name}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">{item.description || '—'}</p>
                                </div>
                                <div className="flex gap-1 ml-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setEditingItem(item)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => onDelete(item.id)}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <div className="flex gap-3 text-gray-600">
                                  <span>{item.quantity} {item.unit || 'шт'}</span>
                                </div>
                                <span className="font-semibold">{item.price.toLocaleString('ru-RU')} ₽</span>
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

      {/* Диалог импорта */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-4xl" aria-describedby="import-dialog-desc">
          <DialogHeader>
            <DialogTitle>Импорт оборудования</DialogTitle>
            <DialogDescription id="import-dialog-desc">
              Загрузите файл Excel или CSV с данными оборудования
            </DialogDescription>
          </DialogHeader>
          
          {!importPreview ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Загрузите Excel или CSV файл со столбцами: Название, Категория, Количество, Ед.изм, Цена, Описание
              </p>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                ref={fileInputRef}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm">Найдено записей: {importData.length}</p>
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Категория</TableHead>
                      <TableHead>Кол-во</TableHead>
                      <TableHead>Ед.</TableHead>
                      <TableHead>Цена</TableHead>
                      <TableHead>Описание</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importData.slice(0, 10).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unit || 'шт'}</TableCell>
                        <TableCell>{item.price}</TableCell>
                        <TableCell>{item.description || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {importData.length > 10 && (
                  <p className="text-center text-sm text-gray-500 mt-2">
                    ... и ещё {importData.length - 10} записей
                  </p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setImportPreview(false);
                  setImportData([]);
                }}>
                  Отмена
                </Button>
                <Button onClick={handleImport}>
                  Импортировать {importData.length} записей
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог добавления/редактирования */}
      <Dialog open={isAddDialogOpen || !!editingItem} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingItem(null);
        }
      }}>
        <DialogContent className="max-w-lg" aria-describedby="equipment-dialog-desc">
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
            onSubmit={async (data) => {
              if (editingItem) {
                const { error } = await onUpdate(editingItem.id, data);
                if (!error) setEditingItem(null);
              } else {
                if (!userId) {
                  console.error('userId is undefined');
                  return;
                }
                const itemData = { ...data, user_id: userId };
                console.log('Adding equipment:', JSON.stringify(itemData, null, 2));
                const { error } = await onAdd(itemData);
                if (error) {
                  console.error('Error details:', error);
                }
                if (!error) setIsAddDialogOpen(false);
              }
            }}
            onAddCategory={onAddCategory}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Форма оборудования
interface EquipmentFormProps {
  categories: { id: string; name: string }[];
  userId: string | undefined;
  initialData?: Partial<Equipment> | null;
  onSubmit: (data: any) => Promise<void>;
  onAddCategory: (name: string) => Promise<{ error: any; data?: any }>;
}

function EquipmentForm({ categories, userId, initialData, onSubmit, onAddCategory }: EquipmentFormProps) {
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

  // Статический массив единиц измерения
  const UNIT_OPTIONS = ['шт', 'комплект', 'услуга', 'человек', 'п.м.'];

  // Обновляем formData при изменении initialData (для редактирования)
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
      // Проверяем, является ли единица измерения кастомной
      if (initialData.unit && !UNIT_OPTIONS.includes(initialData.unit)) {
        setIsCustomUnit(true);
        setCustomUnit(initialData.unit);
      } else {
        setIsCustomUnit(false);
        setCustomUnit('');
      }
    } else {
      // Сброс формы при добавлении нового
      setFormData({
        name: '',
        category: '',
        quantity: '',
        price: '',
        description: '',
        unit: 'шт'
      });
      setIsCustomUnit(false);
      setCustomUnit('');
      setIsAddingCategory(false);
      setNewCategoryName('');
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

  return (
    <form 
      onSubmit={(e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
          alert('Введите название оборудования');
          return;
        }
        if (!formData.category) {
          alert('Выберите категорию');
          return;
        }
        const finalUnit = isCustomUnit && customUnit.trim() ? customUnit.trim() : (formData.unit || 'шт');
        const data = {
          name: formData.name.trim(),
          category: formData.category,
          quantity: parseInt(formData.quantity) || 0,
          price: parseFloat(formData.price) || 0,
          description: formData.description || '',
          unit: finalUnit
        };
        console.log('Form submitting:', JSON.stringify(data, null, 2));
        onSubmit(data);
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>Название *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Например: Микшер Yamaha MG16"
          required
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
            />
            <Button type="button" onClick={handleAddCategory}>
              Добавить
            </Button>
          </div>
        ) : (
          <select
            className="w-full border rounded-md p-2"
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (customUnit.trim()) {
                      setFormData(prev => ({ ...prev, unit: customUnit.trim() }));
                    }
                    setIsCustomUnit(false);
                  }
                }}
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
              >
                OK
              </Button>
            </div>
          ) : (
            <select
              className="w-full border rounded-md p-2"
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
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Описание</Label>
        <textarea
          className="w-full border rounded-md p-2 min-h-[80px] resize-y"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Технические характеристики, примечания..."
        />
      </div>

      <Button type="submit" className="w-full">
        {initialData ? 'Сохранить' : 'Добавить'}
      </Button>
    </form>
  );
}
