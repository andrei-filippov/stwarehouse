import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  Plus, 
  Trash2, 
  Save, 
  ChevronLeft,
  ChevronDown,
  FileText,
  Printer,
  FileSpreadsheet,
  Search,
  ArrowUpDown,
  GripVertical,
  Copy,
  X,
  CalendarIcon,
  ChevronUp
} from 'lucide-react';
import type { Equipment, Estimate, EstimateItem, Customer, PDFSettings } from '../types';
import { cn } from '../lib/utils';

interface EstimateBuilderProps {
  equipment: Equipment[];
  estimates: Estimate[];
  templates: any[];
  customers: Customer[];
  estimate: Estimate | null;
  selectedTemplate: any;
  pdfSettings: PDFSettings;
  equipmentCategories: string[];
  onSave: (estimate: any, items: any[], categoryOrder?: string[]) => void;
  onClose: () => void;
  onCreateEquipment?: (equipment: any) => Promise<{ error: any; data?: any }>;
}

export function EstimateBuilder({
  equipment,
  estimates,
  templates,
  customers,
  estimate,
  selectedTemplate,
  pdfSettings,
  equipmentCategories,
  onSave,
  onClose,
  onCreateEquipment,
}: EstimateBuilderProps) {
  const [eventName, setEventName] = useState(estimate?.event_name || '');
  const [venue, setVenue] = useState(estimate?.venue || '');
  const [eventDate, setEventDate] = useState(estimate?.event_date || '');
  const [customerId, setCustomerId] = useState(estimate?.customer_id || '');
  const [items, setItems] = useState<EstimateItem[]>(estimate?.items || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeMobileTab, setActiveMobileTab] = useState<'equipment' | 'estimate'>('equipment');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [categoryOrder, setCategoryOrder] = useState<string[]>(estimate?.category_order || equipmentCategories);
  const [showPreview, setShowPreview] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const selectedCustomer = useMemo(() => 
    customers.find(c => c.id === customerId),
    [customers, customerId]
  );

  const total = useMemo(() => 
    items.reduce((sum, item) => sum + (item.price * item.quantity * (item.coefficient || 1)), 0),
    [items]
  );

  const filteredEquipment = useMemo(() => {
    return equipment.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [equipment, searchQuery, selectedCategory]);

  const groupedItems = useMemo(() => {
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, EstimateItem[]>);

    // Сортируем категории согласно порядку
    const orderedCategories = categoryOrder.filter(cat => grouped[cat]);
    const remainingCategories = Object.keys(grouped).filter(cat => !categoryOrder.includes(cat));
    
    return [...orderedCategories, ...remainingCategories].map(category => [
      category,
      grouped[category]
    ] as [string, EstimateItem[]]);
  }, [items, categoryOrder]);

  const handleAddItem = (equipment: Equipment) => {
    const newItem: EstimateItem = {
      id: Math.random().toString(36).substr(2, 9),
      equipment_id: equipment.id,
      name: equipment.name,
      description: equipment.description || '',
      category: equipment.category,
      quantity: 1,
      price: equipment.price,
      unit: equipment.unit,
      coefficient: 1,
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleUpdateItem = (itemId: string, updates: Partial<EstimateItem>) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    ));
  };

  const handleDuplicateItem = (item: EstimateItem) => {
    const newItem: EstimateItem = {
      ...item,
      id: Math.random().toString(36).substr(2, 9),
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleSave = () => {
    const estimateData = {
      event_name: eventName,
      venue,
      event_date: eventDate,
      customer_id: customerId,
      total,
    };
    onSave(estimateData, items, categoryOrder);
  };

  // Drag and drop для категорий
  const handleDragStart = (category: string) => {
    setIsDragging(true);
    setDraggedCategory(category);
  };

  const handleDragOver = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    if (draggedCategory && draggedCategory !== category) {
      setDropTarget(category);
    }
  };

  const handleDrop = (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    if (draggedCategory && draggedCategory !== targetCategory) {
      const newOrder = [...categoryOrder];
      const draggedIndex = newOrder.indexOf(draggedCategory);
      const targetIndex = newOrder.indexOf(targetCategory);
      
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedCategory);
      
      setCategoryOrder(newOrder);
    }
    setIsDragging(false);
    setDraggedCategory(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedCategory(null);
    setDropTarget(null);
  };

  // Сортировка оборудования
  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  const sortedEquipment = useMemo(() => {
    if (!sortConfig) return filteredEquipment;
    
    return [...filteredEquipment].sort((a, b) => {
      const aValue = (a as any)[sortConfig.key];
      const bValue = (b as any)[sortConfig.key];
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEquipment, sortConfig]);

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Форматирование даты в dd.mm.yyyy
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Экспорт в Excel с поддержкой логотипа
  const exportExcel = useCallback(async () => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Смета');

    let currentRow = 1;

    // Добавляем логотип если есть
    if (pdfSettings.logo) {
      try {
        // Конвертируем base64 в буфер
        const base64Data = pdfSettings.logo.split(',')[1];
        if (base64Data) {
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          // Определяем тип изображения
          const imageType = pdfSettings.logo.includes('image/png') ? 'png' : 
                           pdfSettings.logo.includes('image/jpeg') ? 'jpeg' : 'png';
          
          const imageId = workbook.addImage({
            buffer: imageBuffer,
            extension: imageType as 'png' | 'jpeg',
          });

          worksheet.addImage(imageId, {
            tl: { col: 0, row: 0 },
            ext: { width: 200, height: 80 },
          });
          
          currentRow = 4; // Сдвигаем начало данных после логотипа
        }
      } catch (e) {
        console.error('Error adding logo:', e);
      }
    }

    // Шапка с настройками PDF
    if (pdfSettings.companyName) {
      worksheet.getCell(currentRow, 2).value = pdfSettings.companyName;
      worksheet.getCell(currentRow, 2).font = { bold: true, size: 14 };
      currentRow++;
    }
    
    if (pdfSettings.companyDetails) {
      pdfSettings.companyDetails.split('\n').forEach(line => {
        worksheet.getCell(currentRow, 2).value = line;
        worksheet.getCell(currentRow, 2).font = { size: 10 };
        currentRow++;
      });
    }
    
    if (pdfSettings.companyName || pdfSettings.companyDetails) {
      currentRow++; // Пустая строка
    }

    // Заголовок сметы
    worksheet.getCell(currentRow, 2).value = 'Коммерческое предложение:';
    worksheet.getCell(currentRow, 2).font = { bold: true, size: 12 };
    currentRow++;
    
    worksheet.getCell(currentRow, 2).value = `Заказчик: ${selectedCustomer?.name || 'не указан'}`;
    currentRow++;
    
    worksheet.getCell(currentRow, 2).value = `Дата и место проведения: ${formatDate(eventDate)}`;
    currentRow++;
    
    worksheet.getCell(currentRow, 2).value = `Место проведения: ${venue || 'не указано'}`;
    currentRow++;
    currentRow++; // Пустая строка

    // Шапка таблицы
    const headerRow = worksheet.getRow(currentRow);
    headerRow.values = ['№', 'Наименование', 'Ед. изм.', 'Кол-во', 'Цена, руб.', 'Коэфф.', 'Стоимость, руб.'];
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE3F2FD' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow++;

    const dataStartRow = currentRow;

    // Данные по категориям
    groupedItems.forEach(([category, categoryItems]) => {
      // Заголовок категории
      const categoryRow = worksheet.getRow(currentRow);
      categoryRow.values = ['', category, '', '', '', '', ''];
      categoryRow.font = { bold: true };
      categoryRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' }
      };
      currentRow++;

      // Позиции категории
      categoryItems.forEach((item, idx) => {
        const row = worksheet.getRow(currentRow);
        row.values = [
          idx + 1,
          item.description ? `${item.name} - ${item.description}` : item.name,
          item.unit || 'шт',
          item.quantity,
          item.price,
          item.coefficient || 1,
          { formula: `D${currentRow}*E${currentRow}*F${currentRow}` }
        ];
        
        // Форматирование ячеек
        row.getCell(4).numFmt = '#,##0'; // Кол-во
        row.getCell(5).numFmt = '#,##0.00" ₽"'; // Цена
        row.getCell(7).numFmt = '#,##0.00" ₽"'; // Стоимость
        
        currentRow++;
      });

      // Итого по категории
      if (categoryItems.length > 0) {
        const totalRow = worksheet.getRow(currentRow);
        totalRow.values = ['', '', '', '', '', 'Итого:', { formula: `SUM(G${currentRow - categoryItems.length}:G${currentRow - 1})` }];
        totalRow.font = { bold: true };
        totalRow.getCell(7).numFmt = '#,##0.00" ₽"';
        currentRow++;
      }
      
      currentRow++; // Пустая строка
    });

    // Общий итог
    const grandTotalRow = worksheet.getRow(currentRow);
    grandTotalRow.values = ['', '', '', '', '', 'ИТОГО:', total];
    grandTotalRow.font = { bold: true, size: 12 };
    grandTotalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF9C4' }
    };
    grandTotalRow.getCell(7).numFmt = '#,##0.00" ₽"';

    // Настройки ширины колонок
    worksheet.columns = [
      { width: 5 },   // №
      { width: 60 },  // Наименование
      { width: 12 },  // Ед. изм.
      { width: 10 },  // Кол-во
      { width: 15 },  // Цена
      { width: 10 },  // Коэфф.
      { width: 18 },  // Стоимость
    ];

    // Границы для всех ячеек с данными
    for (let row = dataStartRow - 1; row <= currentRow; row++) {
      for (let col = 1; col <= 7; col++) {
        const cell = worksheet.getCell(row, col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }

    // Имя файла
    const fileName = `Смета ${eventName || 'без названия'} ${eventDate || ''}.xlsx`.trim();
    
    // Сохранение файла
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [eventName, eventDate, groupedItems, total, items, customerId, customers, pdfSettings, venue]);

  // Печать через браузер
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Шапка */}
      <div className="border-b p-2 md:p-4 flex items-center justify-between bg-gray-50 print:hidden">
        <div className="flex items-center gap-2 md:gap-4">
          <Button variant="ghost" size="sm" onClick={handleClose} className="px-2">
            <ChevronLeft className="w-5 h-5 md:mr-2" />
            <span className="hidden md:inline">Назад</span>
          </Button>
          <h1 className="text-base md:text-xl font-bold truncate max-w-[150px] md:max-w-none">
            {estimate ? 'Редактирование' : 'Новая смета'}
          </h1>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} className="px-2 md:px-3 hidden sm:flex">
            <FileSpreadsheet className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Excel</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="px-2 md:px-3">
            <Printer className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Печать</span>
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!eventName || items.length === 0} className="px-2 md:px-3">
            <Save className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Сохранить</span>
          </Button>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="flex md:hidden border-b bg-white">
        <button
          className={`flex-1 py-3 text-sm font-medium ${activeMobileTab === 'equipment' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveMobileTab('equipment')}
        >
          Оборудование
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium ${activeMobileTab === 'estimate' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveMobileTab('estimate')}
        >
          Смета ({items.length})
        </button>
      </div>

      {/* Основной контент */}
      <div className="flex-1 flex overflow-hidden">
        {/* Левая панель - Оборудование */}
        <div className={`${activeMobileTab === 'equipment' ? 'flex' : 'hidden'} md:flex w-full md:w-1/2 flex-col border-r`}>
          <div className="p-2 md:p-4 border-b space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Поиск оборудования..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-32 md:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {equipmentCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 md:p-4 space-y-2">
              {sortedEquipment.map(item => (
                <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleAddItem(item)}>
                  <CardContent className="p-2 md:p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-sm md:text-base">{item.name}</h3>
                        <p className="text-xs md:text-sm text-gray-500">{item.category}</p>
                        {item.description && (
                          <p className="text-xs text-gray-400 mt-1">{item.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm md:text-base">{item.price.toLocaleString('ru-RU')} ₽</p>
                        <p className="text-xs text-gray-500">{item.quantity} {item.unit} в наличии</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Правая панель - Смета */}
        <div className={`${activeMobileTab === 'estimate' ? 'flex' : 'hidden'} md:flex w-full md:w-1/2 flex-col`}>
          <div className="p-2 md:p-4 border-b space-y-2 md:space-y-4 overflow-y-auto max-h-[40vh] md:max-h-none">
            <Input
              placeholder="Название мероприятия"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="font-medium"
            />
            
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {eventDate ? format(new Date(eventDate), 'dd.MM.yyyy') : 'Дата'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={eventDate ? new Date(eventDate) : undefined}
                    onSelect={(date) => date && setEventDate(date.toISOString())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Input
                placeholder="Место"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
              />
            </div>

            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите заказчика" />
              </SelectTrigger>
              <SelectContent>
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 md:p-4 space-y-4">
              {groupedItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>Добавьте оборудование из списка слева</p>
                </div>
              ) : (
                groupedItems.map(([category, categoryItems]) => (
                  <Card key={category} className={cn(
                    "transition-all",
                    isDragging && draggedCategory === category && "opacity-50",
                    isDragging && dropTarget === category && "ring-2 ring-blue-400"
                  )}>
                    <CardHeader 
                      className="p-2 md:p-3 cursor-move"
                      draggable
                      onDragStart={() => handleDragStart(category)}
                      onDragOver={(e) => handleDragOver(e, category)}
                      onDrop={(e) => handleDrop(e, category)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm md:text-base flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-gray-400" />
                          {category}
                          <Badge variant="secondary">{categoryItems.length}</Badge>
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCategory(category)}
                        >
                          {collapsedCategories.has(category) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    
                    {!collapsedCategories.has(category) && (
                      <CardContent className="p-0">
                        <div className="space-y-2 p-2 md:p-3">
                          {categoryItems.map((item, idx) => (
                            <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                              <span className="text-xs text-gray-400 w-6">{idx + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.name}</p>
                                <p className="text-xs text-gray-500">
                                  {(item.price * item.quantity * (item.coefficient || 1)).toLocaleString('ru-RU')} ₽
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                                  className="w-14 md:w-16 h-8 text-sm"
                                  min={1}
                                />
                                <Input
                                  type="number"
                                  value={item.coefficient || 1}
                                  onChange={(e) => handleUpdateItem(item.id, { coefficient: parseFloat(e.target.value) || 1 })}
                                  className="w-14 md:w-16 h-8 text-sm"
                                  step={0.1}
                                  min={0.1}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDuplicateItem(item)}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveItem(item.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="p-2 md:p-4 border-t bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-sm md:text-base text-gray-600">Итого:</span>
              <span className="text-xl md:text-2xl font-bold">{total.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
