import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { SortableCategories } from './SortableCategories';
import { toast } from 'sonner';
import { 
  Trash2, 
  Save, 
  ChevronLeft,
  FileText,
  Package,
  Printer,
  Layout,
  FileSpreadsheet,
  Plus
} from 'lucide-react';
import type { Customer, Equipment, Estimate, EstimateItem, PDFSettings, Template } from '../types';
// XLSX загружается динамически при необходимости

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
  customers: Customer[];
  estimate?: Estimate | null;
  selectedTemplate?: Template | null;
  pdfSettings: PDFSettings;
  onSave: (estimate: any, items: any[], categoryOrder?: string[]) => Promise<void>;
  onClose: () => void;
  onCreateEquipment?: (equipment: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>) => Promise<{ error: any; data?: any }>;
  equipmentCategories?: string[];
}

export function EstimateBuilder({ 
  equipment, 
  estimates,
  templates,
  customers,
  estimate, 
  selectedTemplate,
  pdfSettings, 
  onSave, 
  onClose,
  onCreateEquipment,
  equipmentCategories
}: EstimateBuilderProps) {
  // Защита от undefined
  const categoriesList = equipmentCategories || [];
  const [eventName, setEventName] = useState('');
  const [venue, setVenue] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
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
      setEventStartDate(estimate.event_start_date || estimate.event_date || '');
      setEventEndDate(estimate.event_end_date || estimate.event_date || '');
      setCustomerId(estimate.customer_id || '');
      setItems(estimate.items || []);
      // Загружаем порядок категорий из сметы
      if (estimate.category_order && estimate.category_order.length > 0) {
        setCategoryOrder(estimate.category_order);
      } else {
        setCategoryOrder([]);
      }
    } else if (selectedTemplate && equipment?.length > 0) {
      // Автоматически применяем выбранный шаблон только когда оборудование загружено
      setEventName(selectedTemplate.name || '');
      setVenue('');
      setEventDate('');
      setEventStartDate('');
      setEventEndDate('');
      // Применяем шаблон сразу (без проверки доступности, так как дата не выбрана)
      applyTemplateDirect(selectedTemplate);
    } else if (selectedTemplate && (!equipment || equipment.length === 0)) {
      // Оборудование еще не загружено - ждем
      setEventName(selectedTemplate.name || '');
      setVenue('');
      setEventDate('');
      setEventStartDate('');
      setEventEndDate('');
      setItems([]);
    } else {
      setEventName('');
      setVenue('');
      setEventDate('');
      setEventStartDate('');
      setEventEndDate('');
      setItems([]);
    }
  }, [estimate?.id, selectedTemplate?.id, equipment?.length]);

  // Прямое применение шаблона без проверки доступности
  const applyTemplateDirect = (template: Template) => {
    if (!template.items || template.items.length === 0 || !equipment || equipment.length === 0) return;
    
    const newItems: EstimateItem[] = [];
    
    template.items.forEach((templateItem, index) => {
      // Ищем оборудование по ID (если есть) или по имени
      let matchingEquipment = null;
      
      // Сначала пробуем найти по ID (если шаблон был создан с equipment_id)
      if (templateItem.equipment_id) {
        matchingEquipment = equipment?.find(eq => eq.id === templateItem.equipment_id);
      }
      
      // Если не нашли по ID, ищем по имени (точное совпадение)
      if (!matchingEquipment && templateItem.equipment_name) {
        matchingEquipment = equipment?.find(eq => 
          eq.name.toLowerCase().trim() === templateItem.equipment_name.toLowerCase().trim()
        );
      }
      
      // Если всё ещё не нашли, ищем по категории (но пропускаем если уже добавляли из этой категории)
      if (!matchingEquipment && templateItem.category) {
        // Для категорийного поиска берем оборудование по индексу, если возможно
        const categoryEquipment = (equipment || []).filter(eq => 
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

  // Проверка пересечения двух периодов дат
  const isDateRangeOverlapping = useCallback((start1: string, end1: string, start2: string, end2: string) => {
    const s1 = new Date(start1);
    const e1 = new Date(end1);
    const s2 = new Date(start2);
    const e2 = new Date(end2);
    return s1 <= e2 && s2 <= e1;
  }, []);

  // Расчёт занятости оборудования на выбранный период
  const equipmentAvailability = useMemo<EquipmentAvailability[]>(() => {
    // Защита от undefined
    if (!equipment || equipment.length === 0) return [];
    
    const startDate = eventStartDate || eventDate;
    const endDate = eventEndDate || eventDate;
    
    if (!startDate) {
      return equipment.map(eq => ({
        equipment: eq,
        totalQuantity: eq.quantity,
        occupiedQuantity: 0,
        availableQuantity: eq.quantity,
        isFullyBooked: false
      }));
    }

    // Находим все сметы, пересекающиеся с выбранным периодом (исключая текущую редактируемую)
    const overlappingEstimates = estimates.filter(e => {
      if (e.id === estimate?.id) return false;
      
      const estStart = e.event_start_date || e.event_date;
      const estEnd = e.event_end_date || e.event_date;
      
      if (!estStart || !estEnd) return false;
      
      return isDateRangeOverlapping(startDate, endDate || startDate, estStart, estEnd);
    });

    // Считаем занятость по каждому оборудованию
    const occupiedMap = new Map<string, number>();
    overlappingEstimates.forEach(est => {
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
  }, [equipment, estimates, eventDate, eventStartDate, eventEndDate, estimate?.id, isDateRangeOverlapping]);

  // Категории для фильтра
  const categories = ['all', ...new Set((equipment || []).map(e => e.category))];

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
      alert(`Нельзя добавить больше. Доступно: ${eqAvailability.availableQuantity} шт.`);
      return; // Нельзя добавить больше чем доступно
    }
    
    if (existingItem) {
      setItems(items.map(i => 
        i.equipment_id === equipmentItem.id 
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      // Проверяем, можно ли добавить новый item (хотя бы 1 штука)
      if (eqAvailability.availableQuantity <= 0) {
        alert(`Нет доступного оборудования. Всего: ${eqAvailability.totalQuantity}, занято: ${eqAvailability.occupiedQuantity}`);
        return;
      }
      
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

  // Обновление количества с проверкой доступности
  const updateQuantity = (index: number, quantity: number) => {
    const item = items[index];
    if (!item) return;
    
    // Находим оборудование для получения общего количества на складе
    const equipmentItem = (equipment || []).find(eq => eq.id === item.equipment_id);
    const totalOnWarehouse = equipmentItem?.quantity || 0;
    
    // Если уменьшаем количество - всегда разрешаем
    if (quantity <= item.quantity) {
      const newItems = [...items];
      newItems[index].quantity = Math.max(0, quantity);
      if (newItems[index].quantity === 0) {
        newItems.splice(index, 1);
      }
      setItems(newItems);
      return;
    }
    
    // Если увеличиваем - проверяем доступность
    const eqAvailability = equipmentAvailability.find(
      ea => ea.equipment.id === item.equipment_id
    );
    
    if (eqAvailability) {
      // Максимум = доступно + уже в смете, но не больше чем есть на складе всего
      const maxAllowed = Math.min(
        eqAvailability.availableQuantity + item.quantity,
        totalOnWarehouse
      );
      if (quantity > maxAllowed) {
        const availableOnWarehouse = eqAvailability.availableQuantity;
        const alreadyInEstimate = item.quantity;
        alert(`Нельзя добавить больше ${maxAllowed} шт. (уже в смете: ${alreadyInEstimate}, доступно на складе: ${availableOnWarehouse}, всего на складе: ${totalOnWarehouse})`);
        return;
      }
    } else {
      // Если нет данных о доступности - проверяем по общему количеству
      if (quantity > totalOnWarehouse) {
        alert(`Нельзя добавить больше ${totalOnWarehouse} шт. (всего на складе)`);
        return;
      }
    }
    
    const newItems = [...items];
    newItems[index].quantity = quantity;
    setItems(newItems);
  };

  // Обновление коэффициента
  const updateCoefficient = (index: number, coefficient: number) => {
    const newItems = [...items];
    newItems[index].coefficient = Math.max(0.01, coefficient);
    setItems(newItems);
  };

  // Обновление цены
  const updatePrice = (index: number, price: number) => {
    const newItems = [...items];
    newItems[index].price = Math.max(0, price);
    setItems(newItems);
  };

  // Удаление позиции
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Применение шаблона (при клике на кнопку шаблона)
  const applyTemplate = (template: Template) => {
    if (!template.items || template.items.length === 0 || !equipment || equipment.length === 0) return;
    
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

  // Подсчет итого с учетом коэффициента (мемоизировано)
  const total = useMemo(() =>
    items.reduce((sum, item) => sum + (item.price * item.quantity * (item.coefficient || 1)), 0),
    [items]
  );
  const totalQuantity = useMemo(() =>
    items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  // Состояние для порядка категорий
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  
  // Состояние для создания оборудования
  const [isCreatingEquipment, setIsCreatingEquipment] = useState(false);
  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [newEquipmentCategory, setNewEquipmentCategory] = useState('');
  const [newEquipmentPrice, setNewEquipmentPrice] = useState('');
  const [newEquipmentQuantity, setNewEquipmentQuantity] = useState('1');
  const [newEquipmentUnit, setNewEquipmentUnit] = useState('шт');
  const [newEquipmentDescription, setNewEquipmentDescription] = useState('');

  // Группировка по категориям
  const groupedItems = useMemo(() => {
    // Защита от undefined
    const safeItems = items || [];
    const grouped = safeItems.reduce((acc, item) => {
      const category = item.category || 'Без категории';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, EstimateItem[]>);
    
    const entries = Object.entries(grouped);
    
    // Если порядок задан - используем его
    if (categoryOrder.length > 0) {
      return entries.sort(([a], [b]) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }
    
    // Иначе сортируем по приоритету
    const categoryPriority: Record<string, number> = {
      'Звуковое оборудование (PA)': 1,
      'Звуковое оборудование (Mixing console)': 2,
      'Радиосистемы': 3,
      'Звуковое оборудование (Backline)': 4,
      'Световое оборудование': 5,
      'Сценическое оборудование': 6,
      'Видео оборудование': 7,
      'Услуги специалистов и транспорт': 999,
    };
    
    return entries.sort(([a], [b]) => {
      const priorityA = categoryPriority[a] || 100;
      const priorityB = categoryPriority[b] || 100;
      return priorityA - priorityB;
    });
  }, [items, categoryOrder]);

  // Обработка изменения порядка категорий
  const handleReorderCategories = (newGroupedItems: [string, EstimateItem[]][]) => {
    const newOrder = newGroupedItems.map(([category]) => category);
    setCategoryOrder(newOrder);
  };

  // Расчет суммы по категории (мемоизировано)
  const getCategoryTotal = useCallback((categoryItems: EstimateItem[]) => {
    return categoryItems.reduce((sum, item) => sum + (item.price * item.quantity * (item.coefficient || 1)), 0);
  }, []);

  // Выбранный заказчик (мемоизировано)
  const selectedCustomer = useMemo(() =>
    (customers || []).find(c => c.id === customerId),
    [customers, customerId]
  );

  // Сохранение
  const handleSave = async () => {
    const startDate = eventStartDate || eventDate;
    const endDate = eventEndDate || eventStartDate || eventDate;
    
    const estimateData: any = {
      event_name: eventName,
      venue: venue || null,
      event_date: startDate, // Для обратной совместимости
      total,
      customer_id: customerId || null,
      customer_name: selectedCustomer?.name || null
    };
    
    // Добавляем новые поля только если есть значения (не пустые строки)
    if (startDate) {
      estimateData.event_start_date = startDate;
    }
    if (endDate) {
      estimateData.event_end_date = endDate;
    }
    
    // Передаем порядок категорий при сохранении
    await onSave(estimateData, items, categoryOrder);
    // Показываем уведомление об успешном сохранении
    toast.success(estimate ? 'Смета сохранена' : 'Смета создана', {
      description: eventName
    });
    // Не закрываем смету после сохранения
  };
  
  // Создание нового оборудования
  const handleCreateEquipment = async () => {
    if (!onCreateEquipment) return;
    if (!newEquipmentName.trim() || !newEquipmentCategory) {
      alert('Введите название и выберите категорию оборудования');
      return;
    }
    
    const price = parseFloat(newEquipmentPrice) || 0;
    const quantity = parseInt(newEquipmentQuantity) || 1;
    
    const { error } = await onCreateEquipment({
      name: newEquipmentName.trim(),
      category: newEquipmentCategory,
      price,
      quantity,
      unit: newEquipmentUnit,
      description: newEquipmentDescription.trim()
    });
    
    if (error) {
      alert('Ошибка при создании оборудования: ' + error.message);
    } else {
      // Очищаем форму
      setNewEquipmentName('');
      setNewEquipmentPrice('');
      setNewEquipmentQuantity('1');
      setNewEquipmentDescription('');
      setIsCreatingEquipment(false);
    }
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
  // Форматирование даты в dd.mm.yyyy
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Экспорт в Excel в стиле файла сметы
  const exportExcel = useCallback(async () => {
    // Создаем массив строк для Excel (AOA - array of arrays)
    const wsData: any[][] = [];
    
    // Заголовок сметы
    wsData.push(['', 'Коммерческое предложение:', '', '', '', '', '', '', '']);
    wsData.push(['', `Заказчик: ${selectedCustomer?.name || 'не указан'}`, '', '', '', '', '', '', '']);
    wsData.push(['', `Дата и место проведения: ${formatDate(eventDate)}`, '', '', '', '', '', '', '']);
    wsData.push(['', `Место проведения: ${venue || 'не указано'}`, '', '', '', '', '', '', '']);
    wsData.push(['', '', '', '', '', '', '', '', '']);
    
    // Шапка таблицы
    wsData.push(['№', 'Наименование', 'Ед. изм.', 'Кол-во', 'Цена, руб.', 'Коэфф.', 'Стоимость, руб.', '', '']);
    
    let rowIndex = 7; // Начало данных (для формул Excel - 1-based)
    
    groupedItems.forEach(([category, categoryItems]) => {
      // Заголовок категории
      wsData.push(['', category, '', '', '', '', '', '', '']);
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
    
    // Общий итог (используем уже посчитанное значение)
    wsData.push(['', '', '', '', '', 'ИТОГО:', total, '', '']);
    
    // Динамический импорт XLSX
    const XLSX = await import('xlsx');
    
    // Создаем worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Стиль для границ
    const borderStyle = { style: 'thin', color: { rgb: '000000' } };
    const allBorders = {
      top: borderStyle,
      bottom: borderStyle,
      left: borderStyle,
      right: borderStyle
    };
    
    // Применяем границы ко всем ячейкам с данными
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellRef]) continue;
        if (!ws[cellRef].s) ws[cellRef].s = {};
        ws[cellRef].s.border = allBorders;
        
        // Жирный шрифт для заголовка таблицы (строка 6 - индекс 5)
        if (R === 5) {
          ws[cellRef].s.font = { bold: true };
          ws[cellRef].s.fill = { patternType: 'solid', fgColor: { rgb: 'E3F2FD' } };
        }
      }
    }
    
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
  }, [eventName, eventDate, groupedItems, total, items, customerId, customers]);

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
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2 text-sm md:text-base">
                <Package className="w-4 h-4 md:w-5 md:h-5" />
                Доступное оборудование
              </h2>
              {onCreateEquipment && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsCreatingEquipment(!isCreatingEquipment)}
                  className="text-xs"
                >
                  {isCreatingEquipment ? 'Отмена' : '+ Добавить'}
                </Button>
              )}
            </div>
            
            {/* Форма создания оборудования */}
            {isCreatingEquipment && onCreateEquipment && (
              <div className="bg-blue-50 border rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-blue-700">Новое оборудование</p>
                <Input
                  placeholder="Название *"
                  value={newEquipmentName}
                  onChange={(e) => setNewEquipmentName(e.target.value)}
                  className="text-sm"
                />
                <select
                  className="w-full border rounded-md p-2 text-sm"
                  value={newEquipmentCategory}
                  onChange={(e) => setNewEquipmentCategory(e.target.value)}
                >
                  <option value="">Выберите категорию *</option>
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Цена"
                    type="number"
                    value={newEquipmentPrice}
                    onChange={(e) => setNewEquipmentPrice(e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    placeholder="Кол-во"
                    type="number"
                    value={newEquipmentQuantity}
                    onChange={(e) => setNewEquipmentQuantity(e.target.value)}
                    className="text-sm"
                  />
                  <select
                    className="border rounded-md p-2 text-sm"
                    value={newEquipmentUnit}
                    onChange={(e) => setNewEquipmentUnit(e.target.value)}
                  >
                    <option value="шт">шт</option>
                    <option value="комплект">комплект</option>
                    <option value="услуга">услуга</option>
                    <option value="человек">человек</option>
                    <option value="п.м.">п.м.</option>
                  </select>
                </div>
                <Input
                  placeholder="Описание (необязательно)"
                  value={newEquipmentDescription}
                  onChange={(e) => setNewEquipmentDescription(e.target.value)}
                  className="text-sm"
                />
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={handleCreateEquipment}
                  disabled={!newEquipmentName.trim() || !newEquipmentCategory}
                >
                  Создать и добавить в базу
                </Button>
              </div>
            )}
            
            <Input
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm"
            />
            <div className="flex gap-1.5 md:gap-2 flex-wrap">
              {['all', ...new Set((equipment || []).map(e => e.category))].slice(0, 6).map(cat => (
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
                  {['all', ...new Set((equipment || []).map(e => e.category))].slice(6).map(cat => (
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
                        // Не переключаем вкладку автоматически, позволяем добавлять несколько позиций
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
        <div className={`${activeMobileTab === 'estimate' ? 'flex' : 'hidden'} md:flex w-full md:w-1/2 flex-col print:w-full h-full overflow-auto md:overflow-hidden`}>
          <div className="p-3 md:p-4 border-b space-y-3 md:space-y-4 print:hidden shrink-0">
            <h2 className="font-semibold flex items-center gap-2 text-sm md:text-base">
              <FileText className="w-4 h-4 md:w-5 md:h-5" />
              Позиции сметы
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs md:text-sm">
                {items.length} поз.
              </span>
            </h2>
            
            <div className="space-y-2">
              <select
                className="w-full border rounded-md p-2 text-sm"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Выберите заказчика</option>
                {(customers || []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Input
                placeholder="Название мероприятия *"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="text-sm"
              />
              <Input
                placeholder="Площадка"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Начало мероприятия *</label>
                  <Input
                    type="date"
                    value={eventStartDate}
                    onChange={(e) => {
                      setEventStartDate(e.target.value);
                      setEventDate(e.target.value);
                    }}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Окончание мероприятия *</label>
                  <Input
                    type="date"
                    value={eventEndDate}
                    onChange={(e) => setEventEndDate(e.target.value)}
                    min={eventStartDate}
                    className="text-sm"
                  />
                </div>
              </div>
              
              {/* Предупреждение о занятости */}
              {(eventStartDate || eventDate) && equipmentAvailability.some(eq => eq.occupiedQuantity > 0) && (
                <Alert className="bg-amber-50 border-amber-200 p-2 md:p-3">
                  <AlertDescription className="text-xs md:text-sm">
                    <strong>Внимание!</strong> На период с {new Date(eventStartDate || eventDate).toLocaleDateString('ru-RU')} по {new Date(eventEndDate || eventStartDate || eventDate).toLocaleDateString('ru-RU')} есть другие мероприятия ({equipmentAvailability.filter(eq => eq.occupiedQuantity > 0).length} типов оборудования занято).
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
                    {(templates || []).slice(0, 3).map(template => (
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
                        {(templates || []).slice(3).map(t => (
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

          <div className="flex-1 md:overflow-auto p-4 print:hidden">
            {items.length === 0 ? (
              <div className="text-center text-gray-400 mt-10">
                <p>Добавьте оборудование из списка слева</p>
              </div>
            ) : (
              <SortableCategories
                groupedItems={groupedItems}
                items={items}
                equipmentAvailability={equipmentAvailability}
                onReorder={handleReorderCategories}
                onRemoveItem={removeItem}
                onUpdateQuantity={updateQuantity}
                onUpdateCoefficient={updateCoefficient}
                onUpdatePrice={updatePrice}
                getCategoryTotal={getCategoryTotal}
              />
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
