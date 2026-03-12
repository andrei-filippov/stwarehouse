import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
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
  PackagePlus,
  Settings2
} from 'lucide-react';
import type { Equipment, Estimate, EstimateItem, Customer, PDFSettings } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

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
  
  // Состояние для сворачивания шапки сметы на мобильном
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);
  
  // Состояние для показа фильтра категорий
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  
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
    quantity: '' as string | number,
    price: '' as string | number,
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

  // Проверка пересечения дат
  const datesOverlap = (start1: string, end1: string, start2: string, end2: string) => {
    if (!start1 || !start2) return false;
    const s1 = new Date(start1).getTime();
    const e1 = end1 ? new Date(end1).getTime() : s1;
    const s2 = new Date(start2).getTime();
    const e2 = end2 ? new Date(end2).getTime() : s2;
    
    return s1 <= e2 && s2 <= e1;
  };
  
  // Подсчет использованного количества оборудования в смете
  const getUsedQuantity = (equipmentId: string) => {
    return items
      .filter(item => item.equipment_id === equipmentId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };
  
  // Подсчет занятого оборудования в других сметах на пересекающиеся даты
  const getBookedQuantity = (equipmentId: string) => {
    if (!eventStartDate && !eventEndDate) return 0;
    
    const currentEstimateId = estimate?.id;
    const currentStart = eventStartDate || eventEndDate;
    const currentEnd = eventEndDate || eventStartDate;
    
    return estimates
      .filter(e => e.id !== currentEstimateId && e.items)
      .filter(e => datesOverlap(currentStart!, currentEnd!, e.event_start_date || e.event_date, e.event_end_date || e.event_date))
      .reduce((total, e) => {
        const bookedInEstimate = (e.items || [])
          .filter((item: EstimateItem) => item.equipment_id === equipmentId)
          .reduce((sum: number, item: EstimateItem) => sum + (item.quantity || 0), 0);
        return total + bookedInEstimate;
      }, 0);
  };

  // Добавление позиции с проверкой доступного количества
  const handleAddItem = (equipment: Equipment) => {
    const usedInCurrent = getUsedQuantity(equipment.id);
    const bookedInOthers = getBookedQuantity(equipment.id);
    const totalBooked = usedInCurrent + bookedInOthers;
    const availableQuantity = equipment.quantity - totalBooked;
    
    if (availableQuantity <= 0) {
      const bookedMsg = bookedInOthers > 0 ? ` (${bookedInOthers} занято в других сметах)` : '';
      alert(`Все доступное оборудование "${equipment.name}" уже используется${bookedMsg}`);
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
    // event_date - обязательное поле для обратной совместимости
    const eventDate = eventStartDate || eventEndDate || new Date().toISOString();
    
    const estimateData = {
      event_name: eventName,
      venue: venue || null,
      event_date: eventDate,  // Обязательное поле
      event_start_date: eventStartDate || null,
      event_end_date: eventEndDate || null,
      customer_id: customerId || null,
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

  // Drag and drop для категорий (десктоп)
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

  // Touch drag & drop для мобильных (с авто-прокруткой)
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const scrollInterval = useRef<NodeJS.Timeout | null>(null);
  const touchItemRef = useRef<string | null>(null);

  const clearScrollInterval = () => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent, category: string) => {
    const touch = e.touches[0];
    touchStartY.current = touch.clientY;
    touchCurrentY.current = touch.clientY;
    touchItemRef.current = category;
    setDraggedCategory(category);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent, category: string) => {
    if (!isDragging || !draggedCategory) return;
    
    e.preventDefault(); // Предотвращаем скролл страницы при перетаскивании
    
    const touch = e.touches[0];
    touchCurrentY.current = touch.clientY;
    
    // Определяем направление для авто-прокрутки
    const scrollContainer = e.currentTarget.closest('.overflow-y-auto') as HTMLElement;
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const touchY = touch.clientY;
      const scrollThreshold = 80; // пикселей от края
      const scrollSpeed = 15; // скорость прокрутки
      
      clearScrollInterval();
      
      if (touchY < containerRect.top + scrollThreshold) {
        // Прокрутка вверх
        scrollInterval.current = setInterval(() => {
          scrollContainer.scrollTop -= scrollSpeed;
        }, 16);
      } else if (touchY > containerRect.bottom - scrollThreshold) {
        // Прокрутка вниз
        scrollInterval.current = setInterval(() => {
          scrollContainer.scrollTop += scrollSpeed;
        }, 16);
      }
    }
    
    // Находим элемент под пальцем для swap
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    const categoryHeader = targetElement?.closest('[data-category]');
    if (categoryHeader) {
      const targetCategory = categoryHeader.getAttribute('data-category');
      if (targetCategory && targetCategory !== draggedCategory) {
        setDropTarget(targetCategory);
      }
    }
  };

  const handleTouchEnd = () => {
    clearScrollInterval();
    
    if (draggedCategory && dropTarget && draggedCategory !== dropTarget) {
      const newOrder = [...categoryOrder];
      const draggedIndex = newOrder.indexOf(draggedCategory);
      const targetIndex = newOrder.indexOf(dropTarget);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedCategory);
        setCategoryOrder(newOrder);
      }
    }
    
    setIsDragging(false);
    setDraggedCategory(null);
    setDropTarget(null);
    touchItemRef.current = null;
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
      quantity: newEquipment.quantity === '' ? 0 : Number(newEquipment.quantity),
      price: newEquipment.price === '' ? 0 : Number(newEquipment.price),
      unit: newEquipment.unit,
      is_active: true
    });
    
    if (!result.error) {
      setShowCreateEquipment(false);
      setNewEquipment({
        name: '',
        description: '',
        category: equipmentCategories[0] || '',
        quantity: '',
        price: '',
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
    let headerEndRow = 5;
    if (pdfSettings.logo) {
      try {
        const base64Data = pdfSettings.logo.split(',')[1];
        if (base64Data) {
          // Конвертируем base64 в Uint8Array для браузера
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const imageType = pdfSettings.logo.includes('image/png') ? 'png' : 
                           pdfSettings.logo.includes('image/jpeg') ? 'jpeg' : 'png';
          
          const imageId = workbook.addImage({
            buffer: bytes,
            extension: imageType as 'png' | 'jpeg',
          });

          // Добавляем изображение с фиксированными размерами
          worksheet.addImage(imageId, {
            tl: { col: 0.2, row: 0.5 },
            ext: { width: 180, height: 60 },
            editAs: 'absolute',
          });
        }
      } catch (e) {
        console.error('Error adding logo:', e);
      }
    }

    // Объединяем ячейки для логотипа
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
      <div className="fixed inset-0 bg-white z-40 flex flex-col">
        {/* Шапка */}
        <div className="border-b p-1.5 md:p-3 flex items-center justify-between bg-gray-50 print:hidden shrink-0">
          <div className="flex items-center gap-1.5 md:gap-3">
            <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 md:w-auto p-0 md:px-2">
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden md:inline ml-2">Назад</span>
            </Button>
            <h1 className="text-sm md:text-xl font-bold truncate max-w-[120px] md:max-w-none">
              {estimate ? 'Редактирование' : 'Новая смета'}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {onCreateEquipment && (
              <Button variant="outline" size="sm" onClick={() => setShowCreateEquipment(true)} className="h-8 w-8 md:w-auto p-0 md:px-2" title="Новое оборудование">
                <PackagePlus className="w-4 h-4" />
                <span className="hidden md:inline ml-2">Новое</span>
              </Button>
            )}
            {/* Excel только на десктопе */}
            <Button variant="outline" size="sm" onClick={exportExcel} className="hidden md:flex h-8 px-2">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            {/* На мобильном только иконки */}
            <Button variant="outline" size="sm" onClick={exportPDF} className="h-8 w-8 md:w-auto p-0 md:px-2" title="PDF">
              <FileText className="w-4 h-4" />
              <span className="hidden md:inline ml-2">PDF</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="hidden md:flex h-8 px-2">
              <Printer className="w-4 h-4 mr-2" />
              Печать
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!eventName || items.length === 0} className="h-8 px-2 md:px-3">
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
        <div className="flex-1 relative overflow-hidden md:flex">
          
          {/* ==========================================
              МОБИЛЬНАЯ ВЕРСИЯ: Только одна панель в DOM
              ========================================== */}
          
          {/* Мобильная панель Оборудования */}
          {activeMobileTab === 'equipment' && (
            <div className="flex flex-col w-full h-full bg-white md:hidden">
              {/* Поиск и фильтр */}
              <div className="p-2 border-b space-y-2 shrink-0 bg-gray-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Поиск оборудования..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
                
                {/* Фильтр категорий - компактный select */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-10"
                >
                  <option value="all">Все категории</option>
                  {equipmentCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              {/* Список оборудования */}
              <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="p-2 space-y-2 pb-20">
                  {filteredEquipment.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p>Ничего не найдено</p>
                    </div>
                  ) : (
                    filteredEquipment.map(item => {
                      const usedQty = getUsedQuantity(item.id);
                      const bookedQty = getBookedQuantity(item.id);
                      const totalUsed = usedQty + bookedQty;
                      const availableQty = item.quantity - totalUsed;
                      
                      return (
                        <Card 
                          key={item.id} 
                          className={cn(
                            "transition-shadow",
                            availableQty > 0 ? "cursor-pointer active:scale-[0.98]" : "opacity-50"
                          )} 
                          onClick={() => availableQty > 0 && handleAddItem(item)}
                        >
                          <CardContent className="p-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0 mr-2">
                                <h3 className="font-medium text-sm truncate">{item.name}</h3>
                                <p className="text-xs text-gray-500">{item.category}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-bold text-sm">{item.price.toLocaleString('ru-RU')} ₽</p>
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
                    })
                  )}
                </div>
              </div>
              
              {/* Кнопка перехода к смете (плавающая) */}
              {items.length > 0 && (
                <div className="fixed bottom-20 left-4 right-4 z-30 md:hidden">
                  <Button 
                    className="w-full shadow-lg"
                    onClick={() => setActiveMobileTab('estimate')}
                  >
                    Перейти к смете ({items.length})
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {/* Мобильная панель Сметы */}
          {activeMobileTab === 'estimate' && (
            <div className="flex flex-col w-full h-full bg-white md:hidden">
              {/* Шапка сметы - сворачиваемая */}
              <div className="border-b shrink-0 bg-gray-50">
                {/* Всегда видимая часть - название и кнопка */}
                <div className="p-2 flex items-center gap-2">
                  <Input
                    placeholder="Название мероприятия"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    className="h-10 font-medium flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                    className="h-10 px-2 shrink-0"
                  >
                    {isHeaderCollapsed ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronUp className="w-5 h-5" />
                    )}
                  </Button>
                </div>
                
                {/* Скрываемая часть */}
                {!isHeaderCollapsed && (
                  <div className="px-2 pb-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={eventStartDate ? eventStartDate.split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value;
                          if (date) {
                            setEventStartDate(new Date(date).toISOString());
                            if (!eventEndDate || new Date(eventEndDate) < new Date(date)) {
                              setEventEndDate(new Date(date).toISOString());
                            }
                          } else {
                            setEventStartDate('');
                          }
                        }}
                        className="h-9 text-xs"
                      />
                      <Input
                        type="date"
                        value={eventEndDate ? eventEndDate.split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value;
                          if (date) {
                            const newEnd = new Date(date);
                            if (eventStartDate && newEnd < new Date(eventStartDate)) {
                              alert('Дата окончания не может быть раньше даты начала');
                              return;
                            }
                            setEventEndDate(newEnd.toISOString());
                          } else {
                            setEventEndDate('');
                          }
                        }}
                        className="h-9 text-xs"
                        min={eventStartDate ? eventStartDate.split('T')[0] : undefined}
                      />
                    </div>
                    
                    <Input
                      placeholder="Место проведения"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      className="h-9 text-sm"
                    />

                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm h-9 bg-white"
                    >
                      <option value="">Заказчик</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              
              {/* Список позиций сметы */}
              <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="p-2 space-y-3 pb-32">
                  {groupedItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p>Добавьте оборудование</p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => setActiveMobileTab('equipment')}
                      >
                        Перейти к оборудованию
                      </Button>
                    </div>
                  ) : (
                    groupedItems.map(([category, categoryItems]) => (
                      <Card key={category} className={cn(
                        "overflow-hidden transition-all",
                        isDragging && draggedCategory === category && "shadow-lg scale-[1.02] ring-2 ring-blue-400 z-10"
                      )}>
                        <CardHeader 
                          className={cn(
                            "p-2 cursor-move touch-manipulation transition-all",
                            isDragging && draggedCategory === category ? "bg-blue-100" : "bg-gray-50",
                            isDragging && dropTarget === category && "bg-blue-50 ring-2 ring-blue-300"
                          )}
                          data-category={category}
                          draggable
                          onDragStart={() => handleDragStart(category)}
                          onDragOver={(e) => handleDragOver(e, category)}
                          onDrop={(e) => handleDrop(e, category)}
                          onDragEnd={handleDragEnd}
                          onTouchStart={(e) => handleTouchStart(e, category)}
                          onTouchMove={(e) => handleTouchMove(e, category)}
                          onTouchEnd={handleTouchEnd}
                        >
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <GripVertical className="w-4 h-4 text-gray-400" />
                              {category}
                              <Badge variant="secondary" className="text-xs">{categoryItems.length}</Badge>
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleCategory(category)}
                              className="h-7 w-7 p-0"
                            >
                              {collapsedCategories.has(category) ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                            </Button>
                          </div>
                        </CardHeader>
                        
                        {!collapsedCategories.has(category) && (
                          <CardContent className="p-0">
                            <div className="divide-y">
                              {categoryItems.map((item, idx) => {
                                const itemTotal = item.price * item.quantity * (item.coefficient || 1);
                                
                                return (
                                  <div key={item.id} className="p-3 bg-white">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-xs text-gray-400 w-5">{idx + 1}</span>
                                      <p className="font-medium text-sm flex-1 truncate">{item.name}</p>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 pl-7">
                                      {/* Количество с кнопками +/- */}
                                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                                        <button
                                          onClick={() => handleUpdateItem(item.id, { quantity: Math.max(0, item.quantity - 1) })}
                                          className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-gray-600 active:bg-gray-50"
                                        >
                                          −
                                        </button>
                                        <input
                                          type="tel"
                                          value={item.quantity}
                                          onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            const num = val === '' ? 0 : parseInt(val);
                                            handleUpdateItem(item.id, { quantity: num });
                                          }}
                                          className="w-10 h-8 text-center bg-transparent text-sm font-medium outline-none"
                                        />
                                        <button
                                          onClick={() => {
                                            // Проверяем лимит оборудования
                                            if (item.equipment_id) {
                                              const usedQty = getUsedQuantity(item.equipment_id);
                                              const bookedQty = getBookedQuantity(item.equipment_id);
                                              const equipmentItem = equipment.find(e => e.id === item.equipment_id);
                                              const totalAvailable = equipmentItem ? equipmentItem.quantity : Infinity;
                                              const currentQty = item.quantity;
                                              
                                              // Сколько уже занято (включая текущую позицию)
                                              const otherUsed = usedQty - currentQty;
                                              const totalBooked = otherUsed + bookedQty;
                                              const available = totalAvailable - totalBooked;
                                              
                                              if (available > 0) {
                                                handleUpdateItem(item.id, { quantity: currentQty + 1 });
                                              } else {
                                                toast.warning(`Достигнут лимит`, {
                                                  description: `${equipmentItem?.name || 'Оборудование'}: в наличии ${totalAvailable} шт.`
                                                });
                                              }
                                            } else {
                                              // Для импортированного оборудования без equipment_id - без лимита
                                              handleUpdateItem(item.id, { quantity: item.quantity + 1 });
                                            }
                                          }}
                                          className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-gray-600 active:bg-gray-50"
                                        >
                                          +
                                        </button>
                                      </div>
                                      
                                      <span className="text-xs text-gray-400">×</span>
                                      
                                      {/* Коэффициент с кнопками +/- шаг 0.1 */}
                                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                                        <button
                                          onClick={() => {
                                            const current = item.coefficient || 1;
                                            const newVal = Math.max(0, Math.round((current - 0.1) * 10) / 10);
                                            handleUpdateItem(item.id, { coefficient: newVal });
                                          }}
                                          className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-gray-600 active:bg-gray-50"
                                        >
                                          −
                                        </button>
                                        <input
                                          type="tel"
                                          value={item.coefficient || 1}
                                          onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9.]/g, '');
                                            const num = val === '' ? 0 : parseFloat(val);
                                            if (!isNaN(num) && num >= 0) {
                                              handleUpdateItem(item.id, { coefficient: num });
                                            }
                                          }}
                                          className="w-12 h-8 text-center bg-transparent text-sm font-medium outline-none"
                                        />
                                        <button
                                          onClick={() => {
                                            const current = item.coefficient || 1;
                                            const newVal = Math.round((current + 0.1) * 10) / 10;
                                            handleUpdateItem(item.id, { coefficient: newVal });
                                          }}
                                          className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-gray-600 active:bg-gray-50"
                                        >
                                          +
                                        </button>
                                      </div>
                                      
                                      <div className="flex-1 text-right flex items-center justify-end gap-1">
                                        <input
                                          type="tel"
                                          value={Math.round(itemTotal)}
                                          onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            const num = val === '' ? 0 : parseInt(val);
                                            handleUpdateTotal(item.id, num);
                                          }}
                                          className="w-16 h-8 text-right text-sm font-medium bg-gray-50 rounded px-2 outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <span className="text-xs text-gray-500">₽</span>
                                      </div>
                                      
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="h-8 w-8 p-0 text-red-500"
                                      >
                                        <Trash2 className="w-4 h-4" />
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
              
              {/* Фиксированная панель с Итого */}
              <div className="fixed bottom-[72px] left-0 right-0 bg-white border-t p-2 shadow-lg z-30 md:hidden">
                <div className="flex items-center justify-center">
                  <span className="text-sm text-gray-500 mr-2">Итого:</span>
                  <span className="text-lg font-bold">{total.toLocaleString('ru-RU')} ₽</span>
                </div>
              </div>
            </div>
          )}
          
          {/* ==========================================
              ДЕСКТОПНАЯ ВЕРСИЯ: Обе панели side-by-side
              ========================================== */}
          
          <div className="hidden md:flex flex-1 overflow-hidden">
            {/* Левая панель - Оборудование (35%) */}
            <div 
              className={cn(
                "flex flex-col h-full border-r bg-white transition-all duration-300",
                expandedPanel === 'equipment' ? 'w-full' : expandedPanel === 'estimate' ? 'hidden' : 'w-[35%]'
              )}
            >
              {/* Заголовок панели */}
              <div className="p-3 border-b bg-gray-50 flex items-center justify-between shrink-0">
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

              <div className="p-3 border-b space-y-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Поиск..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                
                {/* Фильтр категорий - кнопки */}
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
                <div className="p-3 space-y-2">
                  {filteredEquipment.map(item => {
                    const usedQty = getUsedQuantity(item.id);
                    const bookedQty = getBookedQuantity(item.id);
                    const totalUsed = usedQty + bookedQty;
                    const availableQty = item.quantity - totalUsed;
                    
                    return (
                      <Card 
                        key={item.id} 
                        className={cn(
                          "transition-shadow",
                          availableQty > 0 ? "cursor-pointer hover:shadow-md" : "opacity-50 cursor-not-allowed"
                        )} 
                        onClick={() => availableQty > 0 && handleAddItem(item)}
                      >
                        <CardContent className="p-2.5">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 mr-2">
                              <h3 className="font-medium text-sm truncate">{item.name}</h3>
                              <p className="text-xs text-gray-500 truncate">{item.category}</p>
                              {item.description && (
                                <p className="text-xs text-gray-400 mt-1 truncate">{item.description}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-sm">{item.price.toLocaleString('ru-RU')} ₽</p>
                              <p className={cn(
                                "text-xs",
                                availableQty <= 0 ? "text-red-500 font-medium" : bookedQty > 0 ? "text-amber-600" : "text-gray-500"
                              )}>
                                {availableQty} свободно / {item.quantity} {item.unit}
                                {bookedQty > 0 && <span className="block text-[10px]">({bookedQty} в других сметах)</span>}
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

            {/* Правая панель - Смета (65%) */}
            <div 
              className={cn(
                "flex flex-col h-full bg-white transition-all duration-300",
                expandedPanel === 'estimate' ? 'w-full' : expandedPanel === 'equipment' ? 'hidden' : 'w-[65%]'
              )}
            >
              {/* Заголовок панели */}
              <div className="p-3 border-b bg-gray-50 flex items-center justify-between shrink-0">
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

              {/* Шапка сметы */}
              <div className="p-3 border-b space-y-3 shrink-0 bg-gray-50/50">
                <Input
                  placeholder="Название мероприятия"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="font-medium"
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Label className="text-[10px] text-gray-500 mb-1 block">Начало</Label>
                    <Input
                      type="date"
                      value={eventStartDate ? eventStartDate.split('T')[0] : ''}
                      onChange={(e) => {
                        const date = e.target.value;
                        if (date) {
                          setEventStartDate(new Date(date).toISOString());
                          if (!eventEndDate || new Date(eventEndDate) < new Date(date)) {
                            setEventEndDate(new Date(date).toISOString());
                          }
                        } else {
                          setEventStartDate('');
                        }
                      }}
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="relative">
                    <Label className="text-[10px] text-gray-500 mb-1 block">Окончание</Label>
                    <Input
                      type="date"
                      value={eventEndDate ? eventEndDate.split('T')[0] : ''}
                      onChange={(e) => {
                        const date = e.target.value;
                        if (date) {
                          const newEnd = new Date(date);
                          if (eventStartDate && newEnd < new Date(eventStartDate)) {
                            alert('Дата окончания не может быть раньше даты начала');
                            return;
                          }
                          setEventEndDate(newEnd.toISOString());
                        } else {
                          setEventEndDate('');
                        }
                      }}
                      className="text-sm"
                      min={eventStartDate ? eventStartDate.split('T')[0] : undefined}
                    />
                  </div>
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

              {/* Список позиций */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-3 space-y-4">
                  {groupedItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p>Добавьте оборудование из списка слева</p>
                    </div>
                  ) : (
                    groupedItems.map(([category, categoryItems]) => (
                      <Card key={category} className={cn(
                        "transition-all",
                        isDragging && draggedCategory === category && "shadow-lg scale-[1.01] ring-2 ring-blue-400 z-10",
                        isDragging && dropTarget === category && "ring-2 ring-blue-300"
                      )}>
                        <CardHeader 
                          className={cn(
                            "p-2.5 cursor-move touch-manipulation transition-all",
                            isDragging && draggedCategory === category ? "bg-blue-100" : "bg-gray-50",
                            isDragging && dropTarget === category && "bg-blue-50"
                          )}
                          data-category={category}
                          draggable
                          onDragStart={() => handleDragStart(category)}
                          onDragOver={(e) => handleDragOver(e, category)}
                          onDrop={(e) => handleDrop(e, category)}
                          onDragEnd={handleDragEnd}
                          onTouchStart={(e) => handleTouchStart(e, category)}
                          onTouchMove={(e) => handleTouchMove(e, category)}
                          onTouchEnd={handleTouchEnd}
                        >
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />
                              <span className="truncate">{category}</span>
                              <Badge variant="secondary" className="shrink-0 text-xs">{categoryItems.length}</Badge>
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleCategory(category)}
                              className="shrink-0 h-7 w-7 p-0"
                            >
                              {collapsedCategories.has(category) ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                            </Button>
                          </div>
                        </CardHeader>
                        
                        {!collapsedCategories.has(category) && (
                          <CardContent className="p-0">
                            <div className="space-y-2 p-2">
                              {categoryItems.map((item, idx) => {
                                const itemTotal = item.price * item.quantity * (item.coefficient || 1);
                                
                                return (
                                  <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                                    <span className="text-xs text-gray-400 w-5 shrink-0">{idx + 1}</span>
                                    <p className="font-medium text-sm flex-1 truncate">{item.name}</p>
                                    
                                    <div className="flex items-center gap-1 shrink-0">
                                      {/* Количество с кнопками +/- */}
                                      <div className="flex items-center bg-white rounded-lg border">
                                        <button
                                          onClick={() => handleUpdateItem(item.id, { quantity: Math.max(0, item.quantity - 1) })}
                                          className="w-7 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-l-lg transition-colors"
                                        >
                                          −
                                        </button>
                                        <input
                                          type="text"
                                          value={item.quantity}
                                          onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            const num = val === '' ? 0 : parseInt(val);
                                            handleUpdateItem(item.id, { quantity: num });
                                          }}
                                          className="w-10 h-8 text-center text-sm font-medium outline-none"
                                        />
                                        <button
                                          onClick={() => {
                                            // Проверяем лимит оборудования
                                            if (item.equipment_id) {
                                              const usedQty = getUsedQuantity(item.equipment_id);
                                              const bookedQty = getBookedQuantity(item.equipment_id);
                                              const equipmentItem = equipment.find(e => e.id === item.equipment_id);
                                              const totalAvailable = equipmentItem ? equipmentItem.quantity : Infinity;
                                              const currentQty = item.quantity;
                                              
                                              // Сколько уже занято (включая текущую позицию)
                                              const otherUsed = usedQty - currentQty;
                                              const totalBooked = otherUsed + bookedQty;
                                              const available = totalAvailable - totalBooked;
                                              
                                              if (available > 0) {
                                                handleUpdateItem(item.id, { quantity: currentQty + 1 });
                                              } else {
                                                toast.warning(`Достигнут лимит: ${equipmentItem?.name || 'оборудование'}`, {
                                                  description: `В наличии ${totalAvailable} шт., все занято`
                                                });
                                              }
                                            } else {
                                              // Для импортированного оборудования без equipment_id - без лимита
                                              handleUpdateItem(item.id, { quantity: item.quantity + 1 });
                                            }
                                          }}
                                          className="w-7 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-r-lg transition-colors"
                                        >
                                          +
                                        </button>
                                      </div>
                                      
                                      {/* Коэффициент с кнопками +/- шаг 0.1 */}
                                      <div className="flex items-center bg-white rounded-lg border ml-1">
                                        <button
                                          onClick={() => {
                                            const current = item.coefficient || 1;
                                            const newVal = Math.max(0, Math.round((current - 0.1) * 10) / 10);
                                            handleUpdateItem(item.id, { coefficient: newVal });
                                          }}
                                          className="w-7 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-l-lg transition-colors"
                                        >
                                          −
                                        </button>
                                        <input
                                          type="text"
                                          value={item.coefficient || 1}
                                          onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9.]/g, '');
                                            const num = val === '' ? 0 : parseFloat(val);
                                            if (!isNaN(num) && num >= 0) {
                                              handleUpdateItem(item.id, { coefficient: num });
                                            }
                                          }}
                                          className="w-10 h-8 text-center text-sm font-medium outline-none"
                                        />
                                        <button
                                          onClick={() => {
                                            const current = item.coefficient || 1;
                                            const newVal = Math.round((current + 0.1) * 10) / 10;
                                            handleUpdateItem(item.id, { coefficient: newVal });
                                          }}
                                          className="w-7 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-r-lg transition-colors"
                                        >
                                          +
                                        </button>
                                      </div>
                                      
                                      <input
                                        type="text"
                                        value={Math.round(itemTotal)}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(/\D/g, '');
                                          const num = val === '' ? 0 : parseInt(val);
                                          handleUpdateTotal(item.id, num);
                                        }}
                                        className="w-20 h-8 text-sm text-right font-medium bg-white rounded border px-2 outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                      
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDuplicateItem(item)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Copy className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="h-8 w-8 p-0"
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

              {/* Панель Итого */}
              <div className="border-t bg-gray-50 p-3 px-4 shrink-0">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Итого:</span>
                  <span className="text-2xl font-bold">{total.toLocaleString('ru-RU')} ₽</span>
                </div>
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
            <DialogDescription>
              У вас есть несохраненные изменения. Вы уверены, что хотите выйти без сохранения?
            </DialogDescription>
          </DialogHeader>
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
            <DialogDescription>
              Создайте новое оборудование и оно будет автоматически добавлено в смету.
            </DialogDescription>
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
                  onChange={(e) => setNewEquipment({...newEquipment, quantity: e.target.value === '' ? '' : parseInt(e.target.value) || 0})}
                  onFocus={(e) => {
                    if (e.target.value === '0') {
                      e.target.select();
                    }
                  }}
                  min={0}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Цена</Label>
                <Input
                  type="number"
                  value={newEquipment.price}
                  onChange={(e) => setNewEquipment({...newEquipment, price: e.target.value === '' ? '' : parseFloat(e.target.value) || 0})}
                  onFocus={(e) => {
                    if (e.target.value === '0') {
                      e.target.select();
                    }
                  }}
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
