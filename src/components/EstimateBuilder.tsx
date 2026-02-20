import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Trash2, 
  Save, 
  ChevronLeft,
  FileText,
  Package,
  Printer,
  Layout,
  FileSpreadsheet
} from 'lucide-react';
import type { Equipment, Estimate, EstimateItem, PDFSettings, Template } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface EquipmentAvailability {
  equipment: Equipment;
  totalQuantity: number;
  occupiedQuantity: number;
  availableQuantity: number;
  isFullyBooked: boolean;
}

interface EstimateBuilderProps {
  equipment: Equipment[];
  estimates: Estimate[];
  templates: Template[];
  estimate?: Estimate | null;
  selectedTemplate?: Template | null;
  pdfSettings: PDFSettings;
  onSave: (estimate: any, items: any[]) => Promise<void>;
  onClose: () => void;
}

export function EstimateBuilder({ 
  equipment, 
  estimates,
  templates,
  estimate, 
  selectedTemplate,
  pdfSettings, 
  onSave, 
  onClose 
}: EstimateBuilderProps) {
  const [eventName, setEventName] = useState('');
  const [venue, setVenue] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeMobileTab, setActiveMobileTab] = useState<'equipment' | 'estimate'>('equipment');
  const printRef = useRef<HTMLDivElement>(null);

  // Обновляем состояние при открытии сметы для редактирования
  useEffect(() => {
    if (estimate) {
      setEventName(estimate.event_name || '');
      setVenue(estimate.venue || '');
      setEventDate(estimate.event_date || '');
      setItems(estimate.items || []);
    } else if (selectedTemplate && equipment.length > 0) {
      // Автоматически применяем выбранный шаблон только когда оборудование загружено
      setEventName(selectedTemplate.name || '');
      setVenue('');
      setEventDate('');
      // Применяем шаблон сразу (без проверки доступности, так как дата не выбрана)
      applyTemplateDirect(selectedTemplate);
    } else if (selectedTemplate && equipment.length === 0) {
      // Оборудование еще не загружено - ждем
      setEventName(selectedTemplate.name || '');
      setVenue('');
      setEventDate('');
      setItems([]);
    } else {
      setEventName('');
      setVenue('');
      setEventDate('');
      setItems([]);
    }
  }, [estimate?.id, selectedTemplate?.id, equipment.length]);

  // Прямое применение шаблона без проверки доступности
  const applyTemplateDirect = (template: Template) => {
    if (!template.items || template.items.length === 0 || equipment.length === 0) return;
    
    const newItems: EstimateItem[] = [];
    
    template.items.forEach((templateItem, index) => {
      // Ищем оборудование по ID (если есть) или по имени
      let matchingEquipment = null;
      
      // Сначала пробуем найти по ID (если шаблон был создан с equipment_id)
      if (templateItem.equipment_id) {
        matchingEquipment = equipment.find(eq => eq.id === templateItem.equipment_id);
      }
      
      // Если не нашли по ID, ищем по имени (точное совпадение)
      if (!matchingEquipment && templateItem.equipment_name) {
        matchingEquipment = equipment.find(eq => 
          eq.name.toLowerCase().trim() === templateItem.equipment_name.toLowerCase().trim()
        );
      }
      
      // Если всё ещё не нашли, ищем по категории (но пропускаем если уже добавляли из этой категории)
      if (!matchingEquipment && templateItem.category) {
        // Для категорийного поиска берем оборудование по индексу, если возможно
        const categoryEquipment = equipment.filter(eq => 
          eq.category.toLowerCase() === templateItem.category.toLowerCase()
        );
        if (categoryEquipment.length > 0) {
          // Берем оборудование из категории по индексу позиции в шаблоне
          // или первое неиспользованное
          for (const eq of categoryEquipment) {
            if (!newItems.find(item => item.equipment_id === eq.id)) {
              matchingEquipment = eq;
              break;
            }
          }
          // Если все уже использованы, берем первое
          if (!matchingEquipment) {
            matchingEquipment = categoryEquipment[0];
          }
        }
      }
      
      if (matchingEquipment) {
        // Без проверки доступности - просто берем запрошенное количество
        const quantity = templateItem.default_quantity || 1;
        
        // Проверяем, не добавили ли уже это оборудование (избегаем дубликатов)
        const existingIndex = newItems.findIndex(i => i.equipment_id === matchingEquipment!.id);
        if (existingIndex >= 0) {
          // Если уже есть - увеличиваем количество
          newItems[existingIndex].quantity += quantity;
        } else {
          // Добавляем новую позицию
          newItems.push({
            equipment_id: matchingEquipment.id,
            name: matchingEquipment.name,
            description: matchingEquipment.description,
            category: matchingEquipment.category,
            quantity: quantity,
            price: matchingEquipment.price,
            unit: matchingEquipment.unit || 'шт',
            coefficient: 1
          });
        }
      }
    });
    
    setItems(newItems);
  };

  // Расчёт занятости оборудования на выбранную дату
  const equipmentAvailability = useMemo<EquipmentAvailability[]>(() => {
    if (!eventDate) {
      return equipment.map(eq => ({
        equipment: eq,
        totalQuantity: eq.quantity,
        occupiedQuantity: 0,
        availableQuantity: eq.quantity,
        isFullyBooked: false
      }));
    }

    // Находим все сметы на эту дату (исключая текущую редактируемую)
    const otherEstimatesOnDate = estimates.filter(e => 
      e.event_date === eventDate && 
      e.id !== estimate?.id
    );

    // Считаем занятость по каждому оборудованию
    const occupiedMap = new Map<string, number>();
    otherEstimatesOnDate.forEach(est => {
      est.items?.forEach(item => {
        const current = occupiedMap.get(item.equipment_id) || 0;
        occupiedMap.set(item.equipment_id, current + item.quantity);
      });
    });

    return equipment.map(eq => {
      const occupied = occupiedMap.get(eq.id) || 0;
      const available = Math.max(0, eq.quantity - occupied);
      return {
        equipment: eq,
        totalQuantity: eq.quantity,
        occupiedQuantity: occupied,
        availableQuantity: available,
        isFullyBooked: available === 0
      };
    });
  }, [equipment, estimates, eventDate, estimate?.id]);

  // Категории для фильтра
  const categories = ['all', ...new Set(equipment.map(e => e.category))];

  // Фильтр оборудования
  const filteredEquipment = equipmentAvailability.filter(item => {
    const matchesSearch = item.equipment.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.equipment.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Добавление позиции с проверкой доступности
  const addItem = (eqAvailability: EquipmentAvailability) => {
    const equipmentItem = eqAvailability.equipment;
    const existingItem = items.find(i => i.equipment_id === equipmentItem.id);
    
    // Проверяем, не превышаем ли доступное количество
    const currentQtyInEstimate = existingItem?.quantity || 0;
    if (currentQtyInEstimate >= eqAvailability.availableQuantity) {
      return; // Нельзя добавить больше чем доступно
    }
    
    if (existingItem) {
      setItems(items.map(i => 
        i.equipment_id === equipmentItem.id 
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      const newItem: EstimateItem = {
        equipment_id: equipmentItem.id,
        name: equipmentItem.name,
        description: equipmentItem.description,
        category: equipmentItem.category,
        quantity: 1,
        price: equipmentItem.price,
        unit: equipmentItem.unit || 'шт',
        coefficient: 1
      };
      setItems([...items, newItem]);
    }
  };

  // Обновление количества
  const updateQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = Math.max(0, quantity);
    if (newItems[index].quantity === 0) {
      newItems.splice(index, 1);
    }
    setItems(newItems);
  };

  // Обновление коэффициента
  const updateCoefficient = (index: number, coefficient: number) => {
    const newItems = [...items];
    newItems[index].coefficient = Math.max(0.01, coefficient);
    setItems(newItems);
  };

  // Удаление позиции
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Применение шаблона (при клике на кнопку шаблона)
  const applyTemplate = (template: Template) => {
    if (!template.items || template.items.length === 0 || equipment.length === 0) return;
    
    const newItems: EstimateItem[] = [];
    const usedEquipmentIds = new Set<string>(); // Отслеживаем уже использованное оборудование
    
    template.items.forEach((templateItem, index) => {
      // Ищем оборудование по ID (если есть) или по имени
      let matchingEquipment = null;
      
      // Сначала пробуем найти по ID
      if (templateItem.equipment_id) {
        matchingEquipment = equipment.find(eq => eq.id === templateItem.equipment_id);
      }
      
      // Если не нашли по ID, ищем по имени (точное совпадение)
      if (!matchingEquipment && templateItem.equipment_name) {
        matchingEquipment = equipment.find(eq => 
          eq.name.toLowerCase().trim() === templateItem.equipment_name.toLowerCase().trim()
        );
      }
      
      // Если всё ещё не нашли, ищем по категории (берем первое неиспользованное)
      if (!matchingEquipment && templateItem.category) {
        const categoryEquipment = equipment.filter(eq => 
          eq.category.toLowerCase() === templateItem.category.toLowerCase() &&
          !usedEquipmentIds.has(eq.id) // Исключаем уже использованное
        );
        if (categoryEquipment.length > 0) {
          matchingEquipment = categoryEquipment[0];
        }
      }
      
      if (matchingEquipment) {
        // Проверяем доступность
        const eqAvail = equipmentAvailability.find(ea => ea.equipment.id === matchingEquipment!.id);
        const maxAvailable = eqAvail?.availableQuantity || 0;
        
        if (maxAvailable > 0) {
          const quantity = Math.min(templateItem.default_quantity || 1, maxAvailable);
          
          // Проверяем, не добавили ли уже это оборудование в текущую смету
          const existingIndex = items.findIndex(i => i.equipment_id === matchingEquipment!.id);
          const newItemIndex = newItems.findIndex(i => i.equipment_id === matchingEquipment!.id);
          
          if (existingIndex >= 0) {
            // Уже есть в смете - увеличиваем количество
            setItems(prev => prev.map((item, idx) => 
              idx === existingIndex 
                ? { ...item, quantity: item.quantity + quantity }
                : item
            ));
          } else if (newItemIndex >= 0) {
            // Уже добавили в этом шаблоне - увеличиваем количество
            newItems[newItemIndex].quantity += quantity;
          } else {
            // Новое оборудование
            newItems.push({
              equipment_id: matchingEquipment.id,
              name: matchingEquipment.name,
              description: matchingEquipment.description,
              category: matchingEquipment.category,
              quantity: quantity,
              price: matchingEquipment.price,
              unit: matchingEquipment.unit || 'шт',
              coefficient: 1
            });
            usedEquipmentIds.add(matchingEquipment.id);
          }
        }
      }
    });
    
    setItems(prev => [...prev, ...newItems]);
  };

  // Подсчет итого с учетом коэффициента
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity * (item.coefficient || 1)), 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  // Группировка по категориям
  const groupedItems = useMemo(() => {
    const grouped = items.reduce((acc, item) => {
      const category = item.category || 'Без категории';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, EstimateItem[]>);
    
    // Сортируем категории по алфавиту
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  // Расчет суммы по категории
  const getCategoryTotal = (categoryItems: EstimateItem[]) => {
    return categoryItems.reduce((sum, item) => sum + (item.price * item.quantity * (item.coefficient || 1)), 0);
  };

  // Сохранение
  const handleSave = async () => {
    const estimateData = {
      event_name: eventName,
      venue,
      event_date: eventDate,
      total
    };
    await onSave(estimateData, items);
    onClose();
  };

  // Экспорт PDF с поддержкой кириллицы через HTML
  const exportPDF = () => {
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
          .signature-section { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
          .signature-left { width: 45%; }
          .signature-right { width: 45%; text-align: right; }
          .signature-line { border-top: 1px solid #333; margin-top: 30px; padding-top: 5px; font-size: 10px; }
          .signature-img { max-height: 40px; margin-top: 10px; }
          .stamp-img { max-height: 60px; }
        </style>
      </head>
      <body>
        <!-- Шапка с логотипом и реквизитами -->
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
          <p><strong>Дата:</strong> ${eventDate ? new Date(eventDate).toLocaleDateString('ru-RU') : '-'}</p>
        </div>
        
        ${groupedItems.map(([category, categoryItems], catIdx) => {
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
        
        <!-- Подпись и печать -->
        ${(pdfSettings.personName || pdfSettings.position) ? `
          <div class="signature-section">
            <div class="signature-left">
              <div class="signature-line">
                ${pdfSettings.position || ''}${pdfSettings.position && pdfSettings.personName ? '<br/>' : ''}
                ${pdfSettings.personName || ''}
              </div>
              ${pdfSettings.signature ? `<img src="${pdfSettings.signature}" alt="Подпись" class="signature-img" />` : ''}
            </div>
            <div class="signature-right">
              ${pdfSettings.stamp ? `<img src="${pdfSettings.stamp}" alt="Печать" class="stamp-img" />` : ''}
            </div>
          </div>
        ` : ''}
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Экспорт Excel с поддержкой кириллицы
  // Экспорт в Excel в стиле файла сметы
  const exportExcel = () => {
    // Создаем массив строк для Excel (AOA - array of arrays)
    const wsData: any[][] = [];
    
    // Заголовок сметы
    wsData.push(['', 'Коммерческое предложение:', '', '', '', '', '', '', '']);
    wsData.push(['', `Дата и место проведения: ${eventDate || 'не указана'}`, '', '', '', '', '', '', '']);
    wsData.push(['', `Место проведения: ${venue || 'не указано'}`, '', '', '', '', '', '', '']);
    wsData.push(['', '', '', '', '', '', '', '', '']);
    
    // Шапка таблицы
    wsData.push(['№', 'Наименование', 'Ед. изм.', 'Кол-во', 'Цена, руб.', 'Коэфф.', 'Стоимость, руб.', '', '']);
    
    let rowIndex = 6; // Начало данных (для формул Excel - 1-based)
    
    groupedItems.forEach(([category, categoryItems]) => {
      // Заголовок категории
      wsData.push([category, '', '', '', '', '', '', '', '']);
      rowIndex++;
      
      // Позиции категории
      const categoryStartRow = rowIndex;
      categoryItems.forEach((item, idx) => {
        const fullName = item.description 
          ? `${item.name} - ${item.description}` 
          : item.name;
        
        wsData.push([
          idx + 1,                              // №
          fullName,                             // Наименование (с описанием через " - ")
          item.unit || 'шт',                    // Ед. изм.
          item.quantity,                        // Кол-во
          item.price,                           // Цена
          item.coefficient || 1,                // Коэфф.
          { f: `D${rowIndex}*E${rowIndex}*F${rowIndex}` }, // Формула Excel
          '',
          ''
        ]);
        rowIndex++;
      });
      
      // Итого по категории
      if (categoryItems.length > 0) {
        wsData.push(['', '', '', '', '', 'Итого:', { f: `SUM(G${categoryStartRow}:G${rowIndex-1})` }, '', '']);
        rowIndex++;
      }
      
      // Пустая строка
      wsData.push(['', '', '', '', '', '', '', '', '']);
      rowIndex++;
    });
    
    // Общий итог (суммируем все строки с формулами)
    wsData.push(['', '', '', '', '', 'ИТОГО:', { f: `SUM(G6:G${rowIndex-1})` }, '', '']);
    
    // Создаем worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Настройки ширины колонок
    ws['!cols'] = [
      { wch: 5 },   // №
      { wch: 60 },  // Наименование
      { wch: 10 },  // Ед. изм.
      { wch: 10 },  // Кол-во
      { wch: 12 },  // Цена
      { wch: 10 },  // Коэфф.
      { wch: 15 },  // Стоимость
      { wch: 5 },
      { wch: 5 }
    ];
    
    // Создаем workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Смета');
    
    // Имя файла
    const fileName = `Смета ${eventName || 'без названия'} ${eventDate || ''}.xlsx`.trim();
    
    XLSX.writeFile(wb, fileName);
  };

  // Печать через браузер
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Шапка */}
      <div className="border-b p-2 md:p-4 flex items-center justify-between bg-gray-50 print:hidden">
        <div className="flex items-center gap-2 md:gap-4">
          <Button variant="ghost" size="sm" onClick={onClose} className="px-2">
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
      <div className="flex-1 flex overflow-hidden print:block">
        {/* Левая колонка - Оборудование */}
        <div className={`${activeMobileTab === 'equipment' ? 'flex' : 'hidden'} md:flex w-full md:w-1/2 border-r flex-col print:hidden`}>
          <div className="p-3 md:p-4 border-b space-y-3 md:space-y-4">
            <h2 className="font-semibold flex items-center gap-2 text-sm md:text-base">
              <Package className="w-4 h-4 md:w-5 md:h-5" />
              Доступное оборудование
            </h2>
            <Input
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm"
            />
            <div className="flex gap-1.5 md:gap-2 flex-wrap">
              {categories.slice(0, 6).map(cat => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="text-xs px-2 py-1 h-auto"
                >
                  {cat === 'all' ? 'Все' : cat}
                </Button>
              ))}
              {categories.length > 6 && (
                <select
                  className="text-xs border rounded px-2 py-1"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.slice(6).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-3 md:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredEquipment.map(item => {
                const isFullyBooked = item.isFullyBooked;
                const isInEstimate = items.find(i => i.equipment_id === item.equipment.id);
                const canAddMore = !isFullyBooked && (!isInEstimate || isInEstimate.quantity < item.availableQuantity);
                
                return (
                  <Card 
                    key={item.equipment.id} 
                    className={`transition-colors ${
                      isFullyBooked 
                        ? 'opacity-50 cursor-not-allowed bg-red-50' 
                        : canAddMore 
                          ? 'cursor-pointer hover:border-blue-500' 
                          : 'opacity-70 cursor-not-allowed bg-yellow-50'
                    }`}
                    onClick={() => {
                      if (canAddMore) {
                        addItem(item);
                        setActiveMobileTab('estimate');
                      }
                    }}
                  >
                    <CardContent className="p-2.5 md:p-3">
                      <p className="font-medium text-sm">{item.equipment.name}</p>
                      <p className="text-xs text-gray-500">{item.equipment.category}</p>
                      <p className="text-sm font-semibold mt-1">
                        {item.equipment.price.toLocaleString('ru-RU')} ₽
                      </p>
                      <p className={`text-xs ${
                        item.availableQuantity === 0 
                          ? 'text-red-600 font-semibold' 
                          : item.availableQuantity < item.totalQuantity * 0.2 
                            ? 'text-orange-600' 
                            : 'text-gray-400'
                      }`}>
                        {item.availableQuantity === 0 
                          ? 'Занято полностью' 
                          : `Доступно: ${item.availableQuantity} / ${item.totalQuantity}`}
                        {item.occupiedQuantity > 0 && ` (занято: ${item.occupiedQuantity})`}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Правая колонка - Смета */}
        <div className={`${activeMobileTab === 'estimate' ? 'flex' : 'hidden'} md:flex w-full md:w-1/2 flex-col print:w-full`}>
          <div className="p-3 md:p-4 border-b space-y-3 md:space-y-4 print:hidden">
            <h2 className="font-semibold flex items-center gap-2 text-sm md:text-base">
              <FileText className="w-4 h-4 md:w-5 md:h-5" />
              Позиции сметы
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs md:text-sm">
                {items.length} поз.
              </span>
            </h2>
            
            <div className="space-y-2">
              <Input
                placeholder="Название мероприятия *"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Площадка"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="text-sm"
                />
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              
              {/* Предупреждение о занятости */}
              {eventDate && equipmentAvailability.some(eq => eq.occupiedQuantity > 0) && (
                <Alert className="bg-amber-50 border-amber-200 p-2 md:p-3">
                  <AlertDescription className="text-xs md:text-sm">
                    <strong>Внимание!</strong> На {new Date(eventDate).toLocaleDateString('ru-RU')} есть другие мероприятия ({equipmentAvailability.filter(eq => eq.occupiedQuantity > 0).length} поз. занято).
                  </AlertDescription>
                </Alert>
              )}

              {/* Применение шаблона */}
              {!estimate && templates.length > 0 && (
                <div className="border rounded-lg p-2 md:p-3 bg-blue-50">
                  <p className="text-xs md:text-sm font-medium mb-2 flex items-center gap-2">
                    <Layout className="w-3 h-3 md:w-4 md:h-4" />
                    Применить шаблон
                  </p>
                  <div className="flex gap-1.5 md:gap-2 flex-wrap">
                    {templates.slice(0, 3).map(template => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        onClick={() => applyTemplate(template)}
                        className="bg-white text-xs px-2 py-1 h-auto"
                      >
                        {template.name}
                        <span className="ml-1 text-[10px] text-gray-500">
                          ({template.items?.length || 0})
                        </span>
                      </Button>
                    ))}
                    {templates.length > 3 && (
                      <select 
                        className="text-xs border rounded px-2 py-1"
                        onChange={(e) => {
                          const template = templates.find(t => t.id === e.target.value);
                          if (template) applyTemplate(template);
                          e.target.value = '';
                        }}
                      >
                        <option value="">Ещё...</option>
                        {templates.slice(3).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Версия для печати */}
          <div ref={printRef} className="hidden print:block p-8">
            {/* Шапка с логотипом и реквизитами */}
            <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
              <div className="w-1/2">
                {pdfSettings.logo && (
                  <img src={pdfSettings.logo} alt="Logo" className="h-20 object-contain" />
                )}
              </div>
              <div className="w-1/2 text-right text-xs">
                {pdfSettings.companyName && (
                  <h2 className="font-bold text-sm mb-1">{pdfSettings.companyName}</h2>
                )}
                {pdfSettings.companyDetails && (
                  <div className="text-gray-600">
                    {pdfSettings.companyDetails.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <h1 className="text-xl font-bold mb-4 text-center">Коммерческое предложение</h1>
            
            <div className="mb-4 text-sm">
              <p><strong>Мероприятие:</strong> {eventName}</p>
              <p><strong>Площадка:</strong> {venue || '-'}</p>
              <p><strong>Дата:</strong> {eventDate ? new Date(eventDate).toLocaleDateString('ru-RU') : '-'}</p>
            </div>

            {groupedItems.map(([category, categoryItems]) => {
              const catTotal = categoryItems.reduce((sum, item) => sum + (item.price * item.quantity * (item.coefficient || 1)), 0);
              return (
                <div key={category} className="mb-6">
                  <h3 className="font-bold text-sm bg-gray-100 p-2 border-t-2 border-b border-gray-300">
                    {category} ({categoryItems.length} поз.)
                  </h3>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 px-1 w-8 text-xs">№</th>
                        <th className="text-left py-1 px-1 text-xs">Наименование</th>
                        <th className="text-left py-1 px-1 text-xs">Описание</th>
                        <th className="text-center py-1 px-1 w-10 text-xs">Ед.</th>
                        <th className="text-center py-1 px-1 w-10 text-xs">Кол</th>
                        <th className="text-right py-1 px-1 w-16 text-xs">Цена</th>
                        <th className="text-center py-1 px-1 w-8 text-xs">Кф</th>
                        <th className="text-right py-1 px-1 w-20 text-xs">Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryItems.map((item, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-1 px-1">{idx + 1}</td>
                          <td className="py-1 px-1">{item.name}</td>
                          <td className="py-1 px-1 text-xs text-gray-600">{item.description || '-'}</td>
                          <td className="text-center py-1 px-1">{item.unit || 'шт'}</td>
                          <td className="text-center py-1 px-1">{item.quantity}</td>
                          <td className="text-right py-1 px-1 whitespace-nowrap text-xs">{item.price.toLocaleString('ru-RU')}₽</td>
                          <td className="text-center py-1 px-1">{item.coefficient || 1}</td>
                          <td className="text-right py-1 px-1 whitespace-nowrap">{(item.price * item.quantity * (item.coefficient || 1)).toLocaleString('ru-RU')}₽</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td colSpan={7} className="text-right py-2 px-2">Итого по категории:</td>
                        <td className="text-right py-2 px-1">{catTotal.toLocaleString('ru-RU')}₽</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}

            <div className="mt-4 text-right font-bold text-lg border-t-2 border-black pt-3">
              ИТОГО: {total.toLocaleString('ru-RU')}₽
            </div>

            {/* Подпись и печать */}
            {(pdfSettings.personName || pdfSettings.position) && (
              <div className="mt-12 flex justify-between items-end">
                <div className="w-1/2">
                  <div className="border-t border-black pt-2 text-sm">
                    {pdfSettings.position && <p>{pdfSettings.position}</p>}
                    {pdfSettings.personName && <p className="font-medium">{pdfSettings.personName}</p>}
                  </div>
                  {pdfSettings.signature && (
                    <img src={pdfSettings.signature} alt="Подпись" className="h-10 mt-2" />
                  )}
                </div>
                <div className="w-1/2 text-right">
                  {pdfSettings.stamp && (
                    <img src={pdfSettings.stamp} alt="Печать" className="h-16 inline-block" />
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4 print:hidden">
            {items.length === 0 ? (
              <div className="text-center text-gray-400 mt-10">
                <p>Добавьте оборудование из списка слева</p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedItems.map(([category, categoryItems]) => (
                  <div key={category} className="space-y-2">
                    {/* Заголовок категории */}
                    <div className="flex items-center justify-between bg-gray-100 p-2 rounded">
                      <h3 className="font-semibold text-gray-700">{category}</h3>
                      <span className="text-sm text-gray-500">{categoryItems.length} поз.</span>
                    </div>
                    
                    {/* Позиции категории */}
                    <div className="space-y-2">
                      {categoryItems.map((item, idx) => {
                        const originalIndex = items.findIndex(i => i === item);
                        return (
                          <Card key={idx} className="overflow-hidden">
                            <CardContent className="p-2.5 md:p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm md:text-base">{item.name}</p>
                                  {item.description && (
                                    <p className="text-xs text-gray-500 truncate hidden sm:block" title={item.description}>
                                      {item.description}
                                    </p>
                                  )}
                                  <p className="text-xs md:text-sm text-gray-600 mt-0.5">
                                    {item.price.toLocaleString('ru-RU')} ₽/{item.unit || 'шт'}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeItem(originalIndex)}
                                  className="shrink-0 h-8 w-8 p-0 -mr-1 -mt-1"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                              
                              <div className="flex items-center gap-2 md:gap-4 mt-2 md:mt-3">
                                {/* Количество */}
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 md:h-7 md:w-7 p-0 text-xs md:text-sm"
                                    onClick={() => updateQuantity(originalIndex, item.quantity - 1)}
                                  >
                                    -
                                  </Button>
                                  <span className="w-10 text-center font-medium text-xs md:text-sm">
                                    {item.quantity}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 md:h-7 md:w-7 p-0 text-xs md:text-sm"
                                    onClick={() => updateQuantity(originalIndex, item.quantity + 1)}
                                  >
                                    +
                                  </Button>
                                </div>
                                
                                {/* Коэффициент - скрыт на очень маленьких экранах */}
                                <div className="hidden sm:flex items-center gap-1">
                                  <span className="text-xs text-gray-500">Кф:</span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0.01"
                                    value={item.coefficient || 1}
                                    onChange={(e) => updateCoefficient(originalIndex, parseFloat(e.target.value) || 1)}
                                    className="w-12 md:w-14 h-6 md:h-7 text-center border rounded text-xs md:text-sm"
                                  />
                                </div>
                                
                                {/* Сумма */}
                                <div className="ml-auto text-right">
                                  <span className="font-semibold text-xs md:text-sm">
                                    {(item.price * item.quantity * (item.coefficient || 1)).toLocaleString('ru-RU')} ₽
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    
                    {/* Подытог по категории */}
                    <div className="flex justify-end items-center py-2 px-2 md:px-3 bg-blue-50 rounded">
                      <span className="text-xs md:text-sm text-gray-600 mr-2">Итого по категории:</span>
                      <span className="font-semibold text-blue-700 text-sm md:text-base">
                        {getCategoryTotal(categoryItems).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Итого */}
          <div className="border-t p-3 md:p-4 bg-gray-50 print:hidden">
            <div className="flex justify-between items-center text-lg md:text-xl font-bold">
              <span>ИТОГО:</span>
              <span>{total.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
