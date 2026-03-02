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

    // Шапка в стиле "Sound Technology" - логотип слева, реквизиты справа
    const logoWidth = 300;
    const logoHeight = 100;
    const headerEndRow = 6; // Логотип и реквизиты занимают строки 1-6

    // Добавляем логотип слева (объединённые ячейки A-D, строки 1-6)
    if (pdfSettings.logo) {
      try {
        const base64Data = pdfSettings.logo.split(',')[1];
        if (base64Data) {
          const imageBuffer = Buffer.from(base64Data, 'base64');
          const imageType = pdfSettings.logo.includes('image/png') ? 'png' : 
                           pdfSettings.logo.includes('image/jpeg') ? 'jpeg' : 'png';
          
          const imageId = workbook.addImage({
            buffer: imageBuffer,
            extension: imageType as 'png' | 'jpeg',
          });

          // Логотип в ячейках A1:D6 (большой, слева)
          worksheet.addImage(imageId, {
            tl: { col: 0, row: 0 },
            br: { col: 3, row: 5 },
            ext: { width: logoWidth, height: logoHeight },
            editAs: 'oneCell',
          });
        }
      } catch (e) {
        console.error('Error adding logo:', e);
      }
    }

    // Объединяем ячейки для логотипа слева (A1:D6)
    worksheet.mergeCells('A1:D6');

    // Реквизиты справа в столбцах E-G, выравнивание по правому краю
    const detailsStartRow = 1;
    let detailsRow = detailsStartRow;

    // Название компании (крупным шрифтом)
    if (pdfSettings.companyName) {
      worksheet.mergeCells(`E${detailsRow}:G${detailsRow}`);
      worksheet.getCell(detailsRow, 5).value = pdfSettings.companyName;
      worksheet.getCell(detailsRow, 5).font = { bold: true, size: 14 };
      worksheet.getCell(detailsRow, 5).alignment = { horizontal: 'right', vertical: 'center' };
      detailsRow++;
    }

    // Реквизиты компании
    if (pdfSettings.companyDetails) {
      const lines = pdfSettings.companyDetails.split('\n');
      lines.forEach((line, index) => {
        if (detailsRow <= headerEndRow) {
          worksheet.mergeCells(`E${detailsRow}:G${detailsRow}`);
          worksheet.getCell(detailsRow, 5).value = line;
          worksheet.getCell(detailsRow, 5).font = { size: 10 };
          worksheet.getCell(detailsRow, 5).alignment = { horizontal: 'right', vertical: 'center', wrapText: true };
          detailsRow++;
        }
      });
    }

    // Устанавливаем высоту строк для шапки
    for (let i = 1; i <= headerEndRow; i++) {
      worksheet.getRow(i).height = 18;
    }

    currentRow = headerEndRow + 1; // Начинаем данные после шапки
    currentRow++; // Пустая строка для отступа

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

    // Шапка таблицы (начинаем с колонки E)
    const headerRow = worksheet.getRow(currentRow);
    headerRow.values = ['', '', '', '', '№', 'Наименование', 'Ед. изм.', 'Кол-во', 'Цена, руб.', 'Коэфф.', 'Стоимость, руб.'];
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE3F2FD' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Применяем стиль только к колонкам с данными (E-K)
    for (let col = 5; col <= 11; col++) {
      headerRow.getCell(col).font = { bold: true };
      headerRow.getCell(col).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE3F2FD' }
      };
      headerRow.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
    }
    currentRow++;

    const dataStartRow = currentRow;

    // Данные по категориям
    let rowIndex = currentRow; // Для формул Excel
    
    groupedItems.forEach(([category, categoryItems]) => {
      // Заголовок категории (начинаем с колонки F)
      const categoryRow = worksheet.getRow(currentRow);
      categoryRow.values = ['', '', '', '', '', category, '', '', '', '', ''];
      categoryRow.font = { bold: true };
      categoryRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' }
      };
      // Объединяем ячейки для названия категории
      worksheet.mergeCells(`F${currentRow}:K${currentRow}`);
      categoryRow.getCell(6).alignment = { horizontal: 'left' };
      currentRow++;
      rowIndex++;

      // Позиции категории
      const categoryStartRow = currentRow;
      categoryItems.forEach((item, idx) => {
        const row = worksheet.getRow(currentRow);
        // Заполняем начиная с колонки E (№)
        row.values = [
          '', // A
          '', // B
          '', // C
          '', // D
          idx + 1, // E - №
          item.description ? `${item.name} - ${item.description}` : item.name, // F
          item.unit || 'шт', // G
          item.quantity, // H
          item.price, // I
          item.coefficient || 1, // J
          { formula: `H${currentRow}*I${currentRow}*J${currentRow}` } // K
        ];
        
        // Форматирование ячеек
        row.getCell(8).numFmt = '#,##0'; // Кол-во (H)
        row.getCell(9).numFmt = '#,##0.00" ₽"'; // Цена (I)
        row.getCell(11).numFmt = '#,##0.00" ₽"'; // Стоимость (K)
        
        currentRow++;
        rowIndex++;
      });

      // Итого по категории
      if (categoryItems.length > 0) {
        const totalRow = worksheet.getRow(currentRow);
        totalRow.values = ['', '', '', '', '', '', '', '', '', 'Итого:', { formula: `SUM(K${categoryStartRow}:K${currentRow - 1})` }];
        totalRow.font = { bold: true };
        totalRow.getCell(10).alignment = { horizontal: 'right' };
        totalRow.getCell(11).numFmt = '#,##0.00" ₽"';
        currentRow++;
        rowIndex++;
      }
      
      currentRow++; // Пустая строка
      rowIndex++;
    });

    // Общий итог
    const grandTotalRow = worksheet.getRow(currentRow);
    grandTotalRow.values = ['', '', '', '', '', '', '', '', '', 'ИТОГО:', total];
    grandTotalRow.font = { bold: true, size: 12 };
    grandTotalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF9C4' }
    };
    grandTotalRow.getCell(10).alignment = { horizontal: 'right', vertical: 'center' };
    grandTotalRow.getCell(11).numFmt = '#,##0.00" ₽"';

    // Настройки ширины колонок
    // A-D для логотипа (широкие), E-G для реквизитов и данных
    worksheet.columns = [
      { width: 15 },  // A - часть логотипа
      { width: 15 },  // B - часть логотипа
      { width: 15 },  // C - часть логотипа
      { width: 15 },  // D - часть логотипа
      { width: 25 },  // E - реквизиты/№
      { width: 35 },  // F - Наименование (шире)
      { width: 12 },  // G - Ед. изм.
      { width: 10 },  // H - Кол-во
      { width: 15 },  // I - Цена
      { width: 10 },  // J - Коэфф.
      { width: 18 },  // K - Стоимость
    ];

    // Границы для всех ячеек с данными (только колонки E-K)
    for (let row = dataStartRow - 1; row <= currentRow; row++) {
      for (let col = 5; col <= 11; col++) {
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
