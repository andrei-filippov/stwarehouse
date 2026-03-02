import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
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
  GripVertical,
  Copy,
  CalendarIcon,
  ChevronUp,
  Maximize2,
  Minimize2,
  X,
  AlertTriangle,
  PackagePlus
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
  const [eventStartDate, setEventStartDate] = useState(estimate?.event_start_date || '');
  const [eventEndDate, setEventEndDate] = useState(estimate?.event_end_date || '');
  const [customerId, setCustomerId] = useState(estimate?.customer_id || '');
  const [items, setItems] = useState<EstimateItem[]>(estimate?.items || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeMobileTab, setActiveMobileTab] = useState<'equipment' | 'estimate'>('equipment');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [categoryOrder, setCategoryOrder] = useState<string[]>(estimate?.category_order || equipmentCategories);
  
  // Состояние для разворачивания панелей
  const [expandedPanel, setExpandedPanel] = useState<'none' | 'equipment' | 'estimate'>('none');
  
  // Состояние для подтверждения выхода
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Состояние для создания оборудования
  const [showCreateEquipment, setShowCreateEquipment] = useState(false);
  const [newEquipment, setNewEquipment] = useState({
    name: '',
    description: '',
    category: equipmentCategories[0] || '',
    quantity: 1,
    price: 0,
    unit: 'шт'
  });
  
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
  
  // Отслеживаем изменения для подтверждения выхода
  useEffect(() => {
    if (eventName || items.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [eventName, items, venue, eventStartDate, eventEndDate, customerId]);

  // Предупреждение при закрытии страницы
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Фильтрация оборудования
  const filteredEquipment = useMemo(() => {
    return equipment.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [equipment, searchQuery, selectedCategory]);

  // Группировка позиций сметы (суммируем одинаковые)
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

  // Подсчет использованного количества оборудования в смете
  const getUsedQuantity = (equipmentId: string) => {
    return items
      .filter(item => item.equipment_id === equipmentId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Добавление позиции с проверкой доступного количества
  const handleAddItem = (equipment: Equipment) => {
    const usedQuantity = getUsedQuantity(equipment.id);
    const availableQuantity = equipment.quantity - usedQuantity;
    
    if (availableQuantity <= 0) {
      alert(`Все доступное оборудование "${equipment.name}" уже добавлено в смету`);
      return;
    }
    
    const existingIndex = items.findIndex(
      item => item.equipment_id === equipment.id && item.price === equipment.price && (item.coefficient || 1) === 1
    );
    
    if (existingIndex >= 0) {
      // Увеличиваем количество существующей позиции
      const currentQty = items[existingIndex].quantity;
      if (currentQty >= equipment.quantity) {
        alert(`Достигнуто максимальное количество оборудования "${equipment.name}" на складе (${equipment.quantity})`);
        return;
      }
      
      const updatedItems = [...items];
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        quantity: Math.min(currentQty + 1, equipment.quantity)
      };
      setItems(updatedItems);
    } else {
      // Добавляем новую позицию
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
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleUpdateItem = (itemId: string, updates: Partial<EstimateItem>) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    ));
  };
  
  // Обновление общей суммы позиции (пересчитываем цену)
  const handleUpdateTotal = (itemId: string, newTotal: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        // Пересчитываем цену: total = price * qty * coef => price = total / (qty * coef)
        const newPrice = newTotal / (item.quantity * (item.coefficient || 1));
        return { ...item, price: Math.round(newPrice * 100) / 100 };
      }
      return item;
    }));
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
      event_start_date: eventStartDate,
      event_end_date: eventEndDate,
      customer_id: customerId,
      total,
    };
    setHasUnsavedChanges(false);
    onSave(estimateData, items, categoryOrder);
  };
  
  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };
  
  const confirmExit = () => {
    setShowExitConfirm(false);
    setHasUnsavedChanges(false);
    onClose();
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

  // Форматирование даты
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Создание нового оборудования
  const handleCreateEquipment = async () => {
    if (!newEquipment.name || !onCreateEquipment) return;
    
    const result = await onCreateEquipment({
      name: newEquipment.name,
      description: newEquipment.description,
      category: newEquipment.category,
      quantity: newEquipment.quantity,
      price: newEquipment.price,
      unit: newEquipment.unit,
      is_active: true
    });
    
    if (!result.error) {
      setShowCreateEquipment(false);
      setNewEquipment({
        name: '',
        description: '',
        category: equipmentCategories[0] || '',
        quantity: 1,
        price: 0,
        unit: 'шт'
      });
      // Добавляем созданное оборудование в смету
      if (result.data) {
        handleAddItem(result.data);
      }
    }
  };

  // Экспорт PDF
  const exportPDF = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Смета - ${eventName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .logo-section { width: 45%; }
          .logo-section img { max-height: 80px; max-width: 100%; }
          .company-section { width: 50%; text-align: right; font-size: 11px; }
          .company-section h2 { margin: 0 0 5px 0; font-size: 14px; }
          .company-section p { margin: 3px 0; }
          h1 { text-align: center; font-size: 18px; margin: 15px 0; }
          .info { margin-bottom: 15px; font-size: 12px; }
          .info p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }
          th { background: #2980b9; color: white; padding: 6px 4px; text-align: left; }
          td { padding: 5px 4px; border-bottom: 1px solid #ddd; }
          tr:nth-child(even) { background: #f5f5f5; }
          .nowrap { white-space: nowrap; }
          .total { margin-top: 15px; font-size: 14px; font-weight: bold; text-align: right; }
          @media print { body { margin: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-section">
            ${pdfSettings.logo ? `<img src="${pdfSettings.logo}" alt="Логотип" />` : '<p>&nbsp;</p>'}
          </div>
          <div class="company-section">
            ${pdfSettings.companyName ? `<h2>${pdfSettings.companyName}</h2>` : ''}
            ${pdfSettings.companyDetails ? pdfSettings.companyDetails.split('\n').map(line => `<p>${line}</p>`).join('') : ''}
          </div>
        </div>

        <h1>Коммерческое предложение</h1>
        
        <div class="info">
          <p><strong>Мероприятие:</strong> ${eventName}</p>
          <p><strong>Площадка:</strong> ${venue || '-'}</p>
          <p><strong>Дата начала:</strong> ${eventStartDate ? new Date(eventStartDate).toLocaleDateString('ru-RU') : '-'}</p>
          <p><strong>Дата окончания:</strong> ${eventEndDate ? new Date(eventEndDate).toLocaleDateString('ru-RU') : '-'}</p>
        </div>
        
        ${groupedItems.map(([category, categoryItems]) => {
          const catTotal = categoryItems.reduce((sum, item) => sum + (item.price * item.quantity * (item.coefficient || 1)), 0);
          return `
          <table>
            <thead>
              <tr style="background:#e3f2fd;">
                <th colspan="8" style="text-align:left;padding:8px;font-size:13px;">
                  ${category} (${categoryItems.length} поз.)
                </th>
              </tr>
              <tr>
                <th style="width:5%">№</th>
                <th style="width:25%">Наименование</th>
                <th style="width:20%">Описание</th>
                <th style="width:8%">Ед.</th>
                <th style="width:8%">Кол-во</th>
                <th style="width:10%">Цена</th>
                <th style="width:8%">Коэф.</th>
                <th style="width:10%">Сумма</th>
              </tr>
            </thead>
            <tbody>
              ${categoryItems.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${item.name}</td>
                  <td>${item.description || '-'}</td>
                  <td>${item.unit || 'шт'}</td>
                  <td>${item.quantity}</td>
                  <td class="nowrap">${item.price.toLocaleString('ru-RU')}₽</td>
                  <td>${item.coefficient || 1}</td>
                  <td class="nowrap">${(item.price * item.quantity * (item.coefficient || 1)).toLocaleString('ru-RU')}₽</td>
                </tr>
              `).join('')}
              <tr style="background:#f5f5f5;font-weight:bold;">
                <td colspan="7" style="text-align:right;padding:8px;">Итого по категории:</td>
                <td style="text-align:right;padding:8px;" class="nowrap">${catTotal.toLocaleString('ru-RU')}₽</td>
              </tr>
            </tbody>
          </table>
          <div style="height:10px;"></div>
          `;
        }).join('')}
        
        <div class="total">
          ИТОГО: ${total.toLocaleString('ru-RU')}₽
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }, [eventName, venue, eventStartDate, eventEndDate, groupedItems, total, pdfSettings]);

  // Экспорт Excel
  const exportExcel = useCallback(async () => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Смета');

    let currentRow = 1;

    // Шапка с логотипом
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

          worksheet.addImage(imageId, {
            tl: { col: 0, row: 0 },
            br: { col: 2, row: 4 },
            ext: { width: 200, height: 80 },
            editAs: 'oneCell',
          });
        }
      } catch (e) {
        console.error('Error adding logo:', e);
      }
    }

    worksheet.mergeCells('A1:C5');

    // Реквизиты справа
    let detailsRow = 1;
    if (pdfSettings.companyName) {
      worksheet.mergeCells(`D${detailsRow}:F${detailsRow}`);
      worksheet.getCell(detailsRow, 4).value = pdfSettings.companyName;
      worksheet.getCell(detailsRow, 4).font = { bold: true, size: 14 };
      worksheet.getCell(detailsRow, 4).alignment = { horizontal: 'right', vertical: 'center' };
      detailsRow++;
    }

    if (pdfSettings.companyDetails) {
      pdfSettings.companyDetails.split('\n').forEach((line) => {
        if (detailsRow <= 5) {
          worksheet.mergeCells(`D${detailsRow}:F${detailsRow}`);
          worksheet.getCell(detailsRow, 4).value = line;
          worksheet.getCell(detailsRow, 4).font = { size: 10 };
          worksheet.getCell(detailsRow, 4).alignment = { horizontal: 'right', vertical: 'center', wrapText: true };
          detailsRow++;
        }
      });
    }

    for (let i = 1; i <= 5; i++) {
      worksheet.getRow(i).height = 16;
    }

    currentRow = 7;
    worksheet.getCell(currentRow, 1).value = 'Коммерческое предложение:';
    worksheet.getCell(currentRow, 1).font = { bold: true, size: 12 };
    currentRow++;
    
    worksheet.getCell(currentRow, 1).value = `Заказчик: ${selectedCustomer?.name || 'не указан'}`;
    currentRow++;
    
    worksheet.getCell(currentRow, 1).value = `Дата начала: ${formatDate(eventStartDate)}`;
    currentRow++;
    
    worksheet.getCell(currentRow, 1).value = `Дата окончания: ${formatDate(eventEndDate)}`;
    currentRow++;
    
    worksheet.getCell(currentRow, 1).value = `Место: ${venue || 'не указано'}`;
    currentRow++;
    currentRow++;

    // Шапка таблицы
    const headerRow = worksheet.getRow(currentRow);
    headerRow.values = ['№', 'Наименование', 'Ед. изм.', 'Кол-во', 'Цена, руб.', 'Коэфф.', 'Стоимость, руб.'];
    
    for (let col = 1; col <= 7; col++) {
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

    // Данные
    groupedItems.forEach(([category, categoryItems]) => {
      const categoryRow = worksheet.getRow(currentRow);
      categoryRow.values = [category, '', '', '', '', '', ''];
      categoryRow.font = { bold: true };
      categoryRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' }
      };
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
      categoryRow.getCell(1).alignment = { horizontal: 'left' };
      currentRow++;

      const categoryStartRow = currentRow;
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
        
        row.getCell(4).numFmt = '#,##0';
        row.getCell(5).numFmt = '#,##0.00" ₽"';
        row.getCell(7).numFmt = '#,##0.00" ₽"';
        
        currentRow++;
      });

      if (categoryItems.length > 0) {
        const totalRow = worksheet.getRow(currentRow);
        totalRow.values = ['', '', '', '', '', 'Итого:', { formula: `SUM(G${categoryStartRow}:G${currentRow - 1})` }];
        totalRow.font = { bold: true };
        totalRow.getCell(6).alignment = { horizontal: 'right' };
        totalRow.getCell(7).numFmt = '#,##0.00" ₽"';
        currentRow++;
      }
      
      currentRow++;
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
    grandTotalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'center' };
    grandTotalRow.getCell(7).numFmt = '#,##0.00" ₽"';

    worksheet.columns = [
      { width: 6 },
      { width: 50 },
      { width: 12 },
      { width: 10 },
      { width: 15 },
      { width: 10 },
      { width: 18 },
    ];

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

    const fileName = `Смета ${eventName || 'без названия'} ${eventStartDate || ''}.xlsx`.trim();
    
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
  }, [eventName, eventStartDate, eventEndDate, groupedItems, total, customerId, customers, pdfSettings, venue]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
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
            {onCreateEquipment && (
              <Button variant="outline" size="sm" onClick={() => setShowCreateEquipment(true)} className="px-2 md:px-3">
                <PackagePlus className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Новое</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportExcel} className="px-2 md:px-3 hidden sm:flex">
              <FileSpreadsheet className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Excel</span>
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF} className="px-2 md:px-3">
              <FileText className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">PDF</span>
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
          {/* Левая панель - Оборудование (30%) */}
          <div 
            className={cn(
              "flex-col border-r bg-white transition-all duration-300",
              activeMobileTab === 'equipment' ? 'flex' : 'hidden md:flex',
              expandedPanel === 'equipment' ? 'w-full' : expandedPanel === 'estimate' ? 'hidden' : 'w-[35%]'
            )}
          >
            {/* Заголовок панели с кнопкой разворачивания */}
            <div className="p-2 md:p-3 border-b bg-gray-50 flex items-center justify-between shrink-0">
              <span className="font-medium text-sm">Оборудование</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedPanel(expandedPanel === 'equipment' ? 'none' : 'equipment')}
                className="h-8 w-8 p-0"
              >
                {expandedPanel === 'equipment' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>

            <div className="p-2 md:p-4 border-b space-y-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Поиск оборудования..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Фильтр категорий - кнопками для видимости */}
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    "px-2 py-1 text-xs rounded border transition-colors",
                    selectedCategory === 'all' 
                      ? "bg-blue-600 text-white border-blue-600" 
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  )}
                >
                  Все
                </button>
                {equipmentCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-2 py-1 text-xs rounded border transition-colors truncate max-w-[120px]",
                      selectedCategory === cat 
                        ? "bg-blue-600 text-white border-blue-600" 
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    )}
                    title={cat}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-2 md:p-4 space-y-2">
                {filteredEquipment.map(item => {
                  const usedQty = getUsedQuantity(item.id);
                  const availableQty = item.quantity - usedQty;
                  
                  return (
                    <Card 
                      key={item.id} 
                      className={cn(
                        "transition-shadow",
                        availableQty > 0 ? "cursor-pointer hover:shadow-md" : "opacity-50 cursor-not-allowed"
                      )} 
                      onClick={() => availableQty > 0 && handleAddItem(item)}
                    >
                      <CardContent className="p-2 md:p-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0 mr-2">
                            <h3 className="font-medium text-sm md:text-base truncate">{item.name}</h3>
                            <p className="text-xs text-gray-500 truncate">{item.category}</p>
                            {item.description && (
                              <p className="text-xs text-gray-400 mt-1 truncate">{item.description}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm md:text-base">{item.price.toLocaleString('ru-RU')} ₽</p>
                            <p className={cn(
                              "text-xs",
                              availableQty <= 0 ? "text-red-500 font-medium" : "text-gray-500"
                            )}>
                              {availableQty} / {item.quantity} {item.unit}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Правая панель - Смета (70%) */}
          <div 
            className={cn(
              "flex-col bg-white transition-all duration-300",
              activeMobileTab === 'estimate' ? 'flex' : 'hidden md:flex',
              expandedPanel === 'estimate' ? 'w-full' : expandedPanel === 'equipment' ? 'hidden' : 'w-[65%]'
            )}
          >
            {/* Заголовок панели с кнопкой разворачивания */}
            <div className="p-2 md:p-3 border-b bg-gray-50 flex items-center justify-between shrink-0">
              <span className="font-medium text-sm">Смета</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedPanel(expandedPanel === 'estimate' ? 'none' : 'estimate')}
                className="h-8 w-8 p-0"
              >
                {expandedPanel === 'estimate' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>

            <div className="p-2 md:p-4 border-b space-y-3 shrink-0">
              <Input
                placeholder="Название мероприятия"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="font-medium"
              />
              
              {/* Две даты - начало и окончание */}
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal text-xs">
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {eventStartDate ? format(new Date(eventStartDate), 'dd.MM.yyyy') : 'Начало'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={eventStartDate ? new Date(eventStartDate) : undefined}
                      onSelect={(date) => date && setEventStartDate(date.toISOString())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal text-xs">
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {eventEndDate ? format(new Date(eventEndDate), 'dd.MM.yyyy') : 'Окончание'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={eventEndDate ? new Date(eventEndDate) : undefined}
                      onSelect={(date) => date && setEventEndDate(date.toISOString())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <Input
                placeholder="Место проведения"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
              />

              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Выберите заказчика</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto">
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
                            <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="truncate">{category}</span>
                            <Badge variant="secondary" className="shrink-0">{categoryItems.length}</Badge>
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCategory(category)}
                            className="shrink-0"
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
                            {categoryItems.map((item, idx) => {
                              const itemTotal = item.price * item.quantity * (item.coefficient || 1);
                              
                              return (
                                <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                                  <span className="text-xs text-gray-400 w-6 shrink-0">{idx + 1}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{item.name}</p>
                                  </div>
                                  
                                  {/* Поля ввода с подписями */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* Количество */}
                                    <div className="flex flex-col items-center">
                                      <Label className="text-[9px] text-gray-500 mb-0.5">Кол-во</Label>
                                      <Input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => {
                                          const val = e.target.value === '' ? '' : parseInt(e.target.value);
                                          if (val === '' || !isNaN(val)) {
                                            handleUpdateItem(item.id, { quantity: val === '' ? 1 : Math.max(1, val) });
                                          }
                                        }}
                                        className="w-14 md:w-16 h-8 text-sm text-center"
                                        min={1}
                                      />
                                    </div>
                                    
                                    {/* Коэффициент */}
                                    <div className="flex flex-col items-center">
                                      <Label className="text-[9px] text-gray-500 mb-0.5">Коэф.</Label>
                                      <Input
                                        type="number"
                                        value={item.coefficient || 1}
                                        onChange={(e) => {
                                          const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                          if (val === '' || !isNaN(val)) {
                                            handleUpdateItem(item.id, { coefficient: val === '' ? 1 : Math.max(0.1, val) });
                                          }
                                        }}
                                        className="w-14 md:w-16 h-8 text-sm text-center"
                                        step={0.1}
                                        min={0.1}
                                      />
                                    </div>
                                    
                                    {/* Сумма (ручной ввод) */}
                                    <div className="flex flex-col items-center">
                                      <Label className="text-[9px] text-gray-500 mb-0.5">Сумма</Label>
                                      <Input
                                        type="number"
                                        value={Math.round(itemTotal)}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value);
                                          if (!isNaN(val) && val >= 0) {
                                            handleUpdateTotal(item.id, val);
                                          }
                                        }}
                                        className="w-20 md:w-24 h-8 text-sm text-right font-medium"
                                        min={0}
                                      />
                                    </div>
                                    
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDuplicateItem(item)}
                                      className="ml-1"
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
                              );
                            })}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </div>

            <div className="p-2 md:p-4 border-t bg-gray-50 shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-sm md:text-base text-gray-600">Итого:</span>
                <span className="text-xl md:text-2xl font-bold">{total.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Диалог подтверждения выхода */}
      <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Несохраненные изменения
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            У вас есть несохраненные изменения. Вы уверены, что хотите выйти без сохранения?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowExitConfirm(false)}>
              Остаться
            </Button>
            <Button variant="destructive" onClick={confirmExit}>
              Выйти без сохранения
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог создания оборудования */}
      <Dialog open={showCreateEquipment} onOpenChange={setShowCreateEquipment}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новое оборудование</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input
                value={newEquipment.name}
                onChange={(e) => setNewEquipment({...newEquipment, name: e.target.value})}
                placeholder="Название оборудования"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Описание</Label>
              <Input
                value={newEquipment.description}
                onChange={(e) => setNewEquipment({...newEquipment, description: e.target.value})}
                placeholder="Описание"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Категория *</Label>
              <select
                value={newEquipment.category}
                onChange={(e) => setNewEquipment({...newEquipment, category: e.target.value})}
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {equipmentCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Количество</Label>
                <Input
                  type="number"
                  value={newEquipment.quantity}
                  onChange={(e) => setNewEquipment({...newEquipment, quantity: parseInt(e.target.value) || 0})}
                  min={0}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Цена</Label>
                <Input
                  type="number"
                  value={newEquipment.price}
                  onChange={(e) => setNewEquipment({...newEquipment, price: parseFloat(e.target.value) || 0})}
                  min={0}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Ед. изм.</Label>
                <Input
                  value={newEquipment.unit}
                  onChange={(e) => setNewEquipment({...newEquipment, unit: e.target.value})}
                  placeholder="шт"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreateEquipment(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleCreateEquipment}
              disabled={!newEquipment.name || !newEquipment.category}
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать и добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
