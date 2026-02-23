import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Plus, Upload, Download, Trash2, Edit, Search, FolderPlus, ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Equipment } from '../types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface EquipmentManagerProps {
  equipment: Equipment[];
  categories: { id: string; name: string }[];
  userId?: string;
  onAdd: (item: Omit<Equipment, 'id' | 'created_at' | 'updated_at'> & { user_id: string }) => Promise<{ error: any }>;
  onUpdate: (id: string, updates: Partial<Equipment>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
  onBulkInsert: (items: (Omit<Equipment, 'id' | 'created_at' | 'updated_at'> & { user_id: string })[]) => Promise<{ error: any; count?: number }>;
  onAddCategory: (name: string) => Promise<{ error: any; data?: any }>;
  onDeleteCategory?: (id: string) => Promise<{ error: any }>;
  loading?: boolean;
}

export function EquipmentManager({ 
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
  const [importData, setImportData] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState(false);
  const [selectedImportItems, setSelectedImportItems] = useState<Set<number>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Фильтрация оборудования (мемоизировано)
  const filteredEquipment = useMemo(() =>
    equipment.filter(item =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase()))
    ),
    [equipment, search]
  );

  // Группировка по категориям (мемоизировано)
  const groupedByCategory = useMemo(() =>
    filteredEquipment.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, Equipment[]>),
    [filteredEquipment]
  );

  // Получаем все категории из БД + категории из оборудования
  const sortedCategories = useMemo(() => {
    const allCategoryNames = new Set([
      ...categories.map(c => c.name),
      ...Object.keys(groupedByCategory)
    ]);
    return Array.from(allCategoryNames).sort();
  }, [categories, groupedByCategory]);

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
        
        // Читаем все строки как массивы (без заголовков)
        const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
        
        // Ищем строку с заголовками (где есть "№" или "Наименование")
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rawData.length, 20); i++) {
          const row = rawData[i];
          if (!row) continue;
          const rowStr = row.map(cell => String(cell || '').toLowerCase()).join(' ');
          if (rowStr.includes('наименование') || rowStr.includes('название') || rowStr.includes('товар') || rowStr.includes('№')) {
            headerRowIndex = i;
            break;
          }
        }
        
        if (headerRowIndex === -1) {
          toast.error('Не удалось найти заголовки в файле');
          return;
        }
        
        // Извлекаем заголовки и данные
        const headers = rawData[headerRowIndex].map(h => String(h || '').trim());
        const dataRows = rawData.slice(headerRowIndex + 1).filter(row => 
          row && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
        );
        
        // Преобразуем в объекты
        const jsonData = dataRows.map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((header, index) => {
            if (header) {
              obj[header] = row[index] !== undefined ? row[index] : null;
            }
          });
          return obj;
        });
        
        console.log('Headers found:', headers);
        console.log('Data rows:', jsonData.slice(0, 3));
        
        // Определяем какие позиции уже существуют
        const existingNames = new Set(equipment.map(e => e.name.toLowerCase().trim()));
        const processed = processImportData(jsonData);
        
        // Выбираем только новые позиции по умолчанию
        const newItemsIndexes = new Set<number>();
        processed.forEach((item, index) => {
          if (!existingNames.has(item.name.toLowerCase().trim())) {
            newItemsIndexes.add(index);
          }
        });
        setSelectedImportItems(newItemsIndexes);
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const processImportData = (data: any[]): any[] => {
    console.log('Import data rows:', data.slice(0, 5));
    if (data.length > 0) {
      console.log('First row keys:', Object.keys(data[0]));
      console.log('First row values:', data[0]);
    }
    
    const processed = data.map((row: any) => {
      // Получаем ключи строки в нижнем регистре для поиска
      const keys = Object.keys(row);
      const getValue = (...possibleNames: string[]) => {
        for (const name of possibleNames) {
          // Ищем точное совпадение
          if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
            return row[name];
          }
          // Ищем без учета регистра
          const key = keys.find(k => k.toLowerCase().trim() === name.toLowerCase().trim());
          if (key && row[key] !== undefined && row[key] !== null && row[key] !== '') {
            return row[key];
          }
        }
        return undefined;
      };
      
      // Расширенный список возможных названий колонок
      const name = getValue('name', 'Название', 'Наименование', 'название', 'наименование', 'Товар', 'товар', 'Оборудование', 'оборудование', 'Item', 'item', 'Product', 'product');
      const category = getValue('category', 'Категория', 'категория', 'Группа', 'группа', 'Type', 'type', 'Тип', 'тип', 'Раздел', 'раздел');
      const quantity = getValue('quantity', 'Количество', 'количество', 'Кол-во', 'кол-во', 'Кол.', 'кол.', 'Кол', 'кол', 'Qty', 'qty', 'Count', 'count');
      const price = getValue('price', 'Цена', 'цена', 'Стоимость', 'стоимость', 'Price', 'price', 'Сумма', 'сумма', 'Cost', 'cost');
      const description = getValue('description', 'Описание', 'описание', 'Desc', 'desc', 'Примечание', 'примечание', 'Комментарий', 'комментарий');
      const unit = getValue('unit', 'Ед. Изм.', 'Ед.Изм.', 'Ед. изм.', 'Ед.изм.', 'Ед.изм', 'ед.изм', 'Единица', 'единица', 'Ед', 'ед', 'Unit', 'unit', 'Изм', 'изм');
      
      return {
        name: name || '',
        category: category || 'Общее',
        quantity: parseInt(quantity) || 0,
        price: parseFloat(price) || 0,
        description: description || '',
        unit: unit || 'шт'
      };
    }).filter(item => item.name && item.name.trim() !== '');

    console.log('Processed items:', processed.length, processed.slice(0, 3));
    
    setImportData(processed);
    setImportPreview(true);
    return processed;
  };

  const handleImport = async () => {
    if (!userId) {
      toast.error('Ошибка: пользователь не авторизован');
      return;
    }
    
    if (selectedImportItems.size === 0) {
      toast.error('Выберите хотя бы одну позицию для импорта');
      return;
    }
    
    // Фильтруем только выбранные позиции
    const selectedData = importData.filter((_, index) => selectedImportItems.has(index));
    
    // Добавляем user_id к каждому элементу
    const dataWithUserId = selectedData.map(item => ({
      ...item,
      user_id: userId
    }));
    
    const { error } = await onBulkInsert(dataWithUserId);
    if (!error) {
      setIsImportDialogOpen(false);
      setImportPreview(false);
      setImportData([]);
      setSelectedImportItems(new Set());
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
                const items = groupedByCategory[category] || [];
                const isExpanded = expandedCategories.has(category);
                
                // Проверяем, используется ли категория
                const categoryObj = categories.find(c => c.name === category);
                const isCategoryUsed = items.length > 0;
                
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
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-500">
                          {items.reduce((sum, i) => sum + i.quantity, 0)} ед.
                        </div>
                        {categoryObj && onDeleteCategory && !isCategoryUsed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Удалить категорию "${category}"?`)) {
                                onDeleteCategory(categoryObj.id);
                              }
                            }}
                            title="Удалить категорию"
                          >
                            <X className="w-4 h-4" />
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
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Импорт оборудования</DialogTitle>
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
            <div className="space-y-4 flex flex-col min-h-0">
              <div className="flex items-center justify-between">
                <p className="text-sm">Найдено записей: <strong>{importData.length}</strong></p>
                {importData.length > 10 && (
                  <p className="text-xs text-gray-500">Показано первые 10</p>
                )}
              </div>
              
              {/* Статистика и управление выбором */}
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="text-sm">Всего: <strong>{importData.length}</strong></span>
                  <span className="text-sm text-green-600">Выбрано: <strong>{selectedImportItems.size}</strong></span>
                  {importData.length > 0 && (
                    <span className="text-xs text-gray-500">
                      ({importData.filter((_, i) => !selectedImportItems.has(i)).length} уже на складе)
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const allIndexes = new Set(importData.map((_, i) => i));
                      setSelectedImportItems(allIndexes);
                    }}
                  >
                    Выбрать все
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedImportItems(new Set())}
                  >
                    Снять все
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const existingNames = new Set(equipment.map(e => e.name.toLowerCase().trim()));
                      const newIndexes = new Set<number>();
                      importData.forEach((item, index) => {
                        if (!existingNames.has(item.name.toLowerCase().trim())) {
                          newIndexes.add(index);
                        }
                      });
                      setSelectedImportItems(newIndexes);
                    }}
                  >
                    Только новые
                  </Button>
                </div>
              </div>
              
              {/* Таблица с прокруткой */}
              <div className="overflow-auto border rounded-lg flex-1 max-h-[50vh]">
                <Table>
                  <TableHeader className="bg-gray-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <input
                          type="checkbox"
                          checked={selectedImportItems.size === importData.length && importData.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedImportItems(new Set(importData.map((_, i) => i)));
                            } else {
                              setSelectedImportItems(new Set());
                            }
                          }}
                          className="w-4 h-4"
                        />
                      </TableHead>
                      <TableHead className="w-12 text-center">№</TableHead>
                      <TableHead className="min-w-[250px]">Название</TableHead>
                      <TableHead className="w-[150px]">Категория</TableHead>
                      <TableHead className="w-20 text-center">Кол-во</TableHead>
                      <TableHead className="w-20 text-center">Ед.</TableHead>
                      <TableHead className="w-28 text-right">Цена</TableHead>
                      <TableHead className="w-24 text-center">Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importData.map((item, idx) => {
                      const isExisting = !selectedImportItems.has(idx) && 
                        equipment.some(e => e.name.toLowerCase().trim() === item.name.toLowerCase().trim());
                      
                      return (
                        <TableRow 
                          key={idx} 
                          className={isExisting ? 'bg-gray-50' : ''}
                        >
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={selectedImportItems.has(idx)}
                              onChange={(e) => {
                                const newSet = new Set(selectedImportItems);
                                if (e.target.checked) {
                                  newSet.add(idx);
                                } else {
                                  newSet.delete(idx);
                                }
                                setSelectedImportItems(newSet);
                              }}
                              className="w-4 h-4"
                            />
                          </TableCell>
                          <TableCell className="text-center text-sm text-gray-500">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium" title={item.name}>
                              {item.name}
                            </div>
                            {item.description && (
                              <div className="text-xs text-gray-500 truncate max-w-[300px]" title={item.description}>
                                {item.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{item.category}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-center text-sm text-gray-600">{item.unit || 'шт'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {item.price ? `${parseFloat(item.price).toLocaleString('ru-RU')} ₽` : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {isExisting ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-700">
                                На складе
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                                Новое
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex gap-2 justify-end pt-2 border-t mt-auto">
                <Button variant="outline" onClick={() => {
                  setImportPreview(false);
                  setImportData([]);
                  setSelectedImportItems(new Set());
                }}>
                  Отмена
                </Button>
                <Button onClick={handleImport} disabled={selectedImportItems.size === 0}>
                  Импортировать {selectedImportItems.size} позиций
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Редактировать оборудование' : 'Добавить оборудование'}
            </DialogTitle>
          </DialogHeader>
          <EquipmentForm 
            categories={categories}
            initialData={editingItem}
            onSubmit={async (data) => {
              if (editingItem) {
                const { error } = await onUpdate(editingItem.id, data);
                if (!error) setEditingItem(null);
              } else {
                const { error } = await onAdd(data);
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
  initialData?: Partial<Equipment> | null;
  onSubmit: (data: any) => Promise<void>;
  onAddCategory: (name: string) => Promise<{ error: any; data?: any }>;
}

function EquipmentForm({ categories, initialData, onSubmit, onAddCategory }: EquipmentFormProps) {
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
        onSubmit({
          ...formData,
          quantity: parseInt(formData.quantity) || 0,
          price: parseFloat(formData.price) || 0
        });
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
