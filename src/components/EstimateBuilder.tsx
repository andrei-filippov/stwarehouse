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
  Layout
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
  pdfSettings: PDFSettings;
  onSave: (estimate: any, items: any[]) => Promise<void>;
  onClose: () => void;
}

export function EstimateBuilder({ 
  equipment, 
  estimates,
  templates,
  estimate, 
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
  const printRef = useRef<HTMLDivElement>(null);

  // Обновляем состояние при открытии сметы для редактирования
  useEffect(() => {
    if (estimate) {
      setEventName(estimate.event_name || '');
      setVenue(estimate.venue || '');
      setEventDate(estimate.event_date || '');
      setItems(estimate.items || []);
    } else {
      setEventName('');
      setVenue('');
      setEventDate('');
      setItems([]);
    }
  }, [estimate?.id]);

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
        quantity: 1,
        price: equipmentItem.price
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

  // Удаление позиции
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Применение шаблона
  const applyTemplate = (template: Template) => {
    if (!template.items || template.items.length === 0) return;
    
    const newItems: EstimateItem[] = [];
    
    template.items.forEach(templateItem => {
      // Ищем оборудование по имени
      const matchingEquipment = equipment.find(eq => 
        eq.name.toLowerCase() === templateItem.equipment_name.toLowerCase() ||
        eq.category.toLowerCase() === templateItem.category.toLowerCase()
      );
      
      if (matchingEquipment) {
        // Проверяем доступность
        const eqAvail = equipmentAvailability.find(ea => ea.equipment.id === matchingEquipment.id);
        const maxAvailable = eqAvail?.availableQuantity || 0;
        
        if (maxAvailable > 0) {
          const quantity = Math.min(templateItem.default_quantity, maxAvailable);
          
          // Проверяем, не добавили ли уже это оборудование
          const existingIndex = newItems.findIndex(i => i.equipment_id === matchingEquipment.id);
          if (existingIndex >= 0) {
            newItems[existingIndex].quantity += quantity;
          } else {
            newItems.push({
              equipment_id: matchingEquipment.id,
              name: matchingEquipment.name,
              description: matchingEquipment.description,
              quantity: quantity,
              price: matchingEquipment.price
            });
          }
        }
      }
    });
    
    setItems(prev => [...prev, ...newItems]);
  };

  // Подсчет итого
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

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
          h1 { text-align: center; font-size: 20px; margin-bottom: 20px; }
          .info { margin-bottom: 20px; font-size: 12px; }
          .info p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
          th { background: #2980b9; color: white; padding: 8px; text-align: left; }
          td { padding: 6px 8px; border-bottom: 1px solid #ddd; }
          tr:nth-child(even) { background: #f5f5f5; }
          .total { margin-top: 20px; font-size: 14px; font-weight: bold; text-align: right; }
          .footer { margin-top: 30px; font-size: 10px; color: #666; }
        </style>
      </head>
      <body>
        <h1>СМЕТА</h1>
        <div class="info">
          <p><strong>Мероприятие:</strong> ${eventName}</p>
          <p><strong>Площадка:</strong> ${venue || '-'}</p>
          <p><strong>Дата:</strong> ${eventDate || '-'}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Наименование</th>
              <th>Кол-во</th>
              <th>Цена</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${item.price.toLocaleString('ru-RU')} ₽</td>
                <td>${(item.price * item.quantity).toLocaleString('ru-RU')} ₽</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="total">
          ИТОГО: ${total.toLocaleString('ru-RU')} ₽
        </div>
        
        ${pdfSettings.companyName ? `
          <div class="footer">
            <p><strong>${pdfSettings.companyName}</strong></p>
            <p>${pdfSettings.companyDetails}</p>
            <p>${pdfSettings.position}: ${pdfSettings.personName}</p>
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
  const exportExcel = () => {
    const data = items.map(item => ({
      'Наименование': item.name,
      'Описание': item.description,
      'Количество': item.quantity,
      'Цена за ед.': item.price,
      'Сумма': item.price * item.quantity
    }));

    data.push({
      'Наименование': 'ИТОГО',
      'Описание': '',
      'Количество': totalQuantity,
      'Цена за ед.': '',
      'Сумма': total
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Смета');
    
    XLSX.writeFile(wb, `smeta_${eventName || 'bez_nazvaniya'}.xlsx`);
  };

  // Печать через браузер
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Шапка */}
      <div className="border-b p-4 flex items-center justify-between bg-gray-50 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose}>
            <ChevronLeft className="w-5 h-5 mr-2" />
            Назад
          </Button>
          <h1 className="text-xl font-bold">
            {estimate ? 'Редактирование сметы' : 'Новая смета'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <FileText className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" onClick={exportPDF}>
            <FileText className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Печать
          </Button>
          <Button onClick={handleSave} disabled={!eventName || items.length === 0}>
            <Save className="w-4 h-4 mr-2" />
            Сохранить
          </Button>
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex-1 flex overflow-hidden print:block">
        {/* Левая колонка - Оборудование */}
        <div className="w-1/2 border-r flex flex-col print:hidden">
          <div className="p-4 border-b space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Package className="w-5 h-5" />
              Доступное оборудование
            </h2>
            <Input
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat === 'all' ? 'Все' : cat}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 gap-2">
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
                    onClick={() => canAddMore && addItem(item)}
                  >
                    <CardContent className="p-3">
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
        <div className="w-1/2 flex flex-col print:w-full">
          <div className="p-4 border-b space-y-4 print:hidden">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Позиции сметы
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                {items.length} поз. ({totalQuantity} ед.)
              </span>
            </h2>
            
            <div className="space-y-2">
              <Input
                placeholder="Название мероприятия *"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
              <Input
                placeholder="Площадка"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
              />
              <Input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
              
              {/* Предупреждение о занятости */}
              {eventDate && equipmentAvailability.some(eq => eq.occupiedQuantity > 0) && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertDescription className="text-sm">
                    <strong>Внимание!</strong> На {new Date(eventDate).toLocaleDateString('ru-RU')} есть другие мероприятия.
                    <br />
                    {equipmentAvailability.filter(eq => eq.occupiedQuantity > 0).length} позиций оборудования уже занято.
                  </AlertDescription>
                </Alert>
              )}

              {/* Применение шаблона */}
              {!estimate && templates.length > 0 && (
                <div className="border rounded-lg p-3 bg-blue-50">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Layout className="w-4 h-4" />
                    Применить шаблон
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {templates.map(template => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        onClick={() => applyTemplate(template)}
                        className="bg-white"
                      >
                        {template.name}
                        <span className="ml-1 text-xs text-gray-500">
                          ({template.items?.length || 0})
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Версия для печати */}
          <div ref={printRef} className="hidden print:block p-8">
            {pdfSettings.logo && (
              <img src={pdfSettings.logo} alt="Logo" className="h-16 mb-4" />
            )}
            <h1 className="text-2xl font-bold mb-4">СМЕТА</h1>
            <p><strong>Мероприятие:</strong> {eventName}</p>
            <p><strong>Площадка:</strong> {venue}</p>
            <p><strong>Дата:</strong> {eventDate}</p>
            <table className="w-full mt-4 border-collapse">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="text-left py-2">Наименование</th>
                  <th className="text-center py-2">Кол-во</th>
                  <th className="text-right py-2">Цена</th>
                  <th className="text-right py-2">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2">{item.name}</td>
                    <td className="text-center py-2">{item.quantity}</td>
                    <td className="text-right py-2">{item.price.toLocaleString('ru-RU')} ₽</td>
                    <td className="text-right py-2">{(item.price * item.quantity).toLocaleString('ru-RU')} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 text-right font-bold text-xl">
              ИТОГО: {total.toLocaleString('ru-RU')} ₽
            </div>
            {pdfSettings.companyName && (
              <div className="mt-8 text-sm">
                <p>{pdfSettings.companyName}</p>
                <p>{pdfSettings.companyDetails}</p>
                <p>{pdfSettings.position}: {pdfSettings.personName}</p>
                {pdfSettings.signature && (
                  <img src={pdfSettings.signature} alt="Подпись" className="h-12 mt-2" />
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4 print:hidden">
            {items.length === 0 ? (
              <div className="text-center text-gray-400 mt-10">
                <p>Добавьте оборудование из списка слева</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <Card key={index}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          {item.price.toLocaleString('ru-RU')} ₽ × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(index, item.quantity - 1)}
                        >
                          -
                        </Button>
                        <span className="w-8 text-center font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(index, item.quantity + 1)}
                        >
                          +
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Итого */}
          <div className="border-t p-4 bg-gray-50 print:hidden">
            <div className="flex justify-between items-center text-xl font-bold">
              <span>ИТОГО:</span>
              <span>{total.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
