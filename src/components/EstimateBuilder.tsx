import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';

import { Card, CardContent } from './ui/card';
import { 
  Trash2, 
  Save, 
  ChevronLeft,
  FileText,
  Package
} from 'lucide-react';
import type { Equipment, Estimate, EstimateItem, PDFSettings } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface EstimateBuilderProps {
  equipment: Equipment[];
  estimate?: Estimate | null;
  pdfSettings: PDFSettings;
  onSave: (estimate: any, items: any[]) => Promise<void>;
  onClose: () => void;
}

export function EstimateBuilder({ 
  equipment, 
  estimate, 
  pdfSettings, 
  onSave, 
  onClose 
}: EstimateBuilderProps) {
  const [eventName, setEventName] = useState(estimate?.event_name || '');
  const [venue, setVenue] = useState(estimate?.venue || '');
  const [eventDate, setEventDate] = useState(estimate?.event_date || '');
  const [items, setItems] = useState<EstimateItem[]>(estimate?.items || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Категории для фильтра
  const categories = ['all', ...new Set(equipment.map(e => e.category))];

  // Фильтр оборудования
  const filteredEquipment = equipment.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Добавление позиции
  const addItem = (equipmentItem: Equipment) => {
    const existingItem = items.find(i => i.equipment_id === equipmentItem.id);
    
    if (existingItem) {
      // Увеличиваем количество
      setItems(items.map(i => 
        i.equipment_id === equipmentItem.id 
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      // Добавляем новую позицию
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

  // Подсчет итого
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemCount = items.length;

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

  // Экспорт PDF с кириллицей
  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Используем стандартный метод с UTF-8 поддержкой через base64 шрифт
    // Для простоты используем встроенный шрифт и настройки
    doc.setFont('helvetica');
    
    // Заголовок
    doc.setFontSize(20);
    doc.text('СМЕТА', 105, 20, { align: 'center' });
    
    // Информация о мероприятии
    doc.setFontSize(12);
    doc.text(`Мероприятие: ${eventName}`, 20, 40);
    doc.text(`Площадка: ${venue}`, 20, 50);
    doc.text(`Дата: ${eventDate}`, 20, 60);
    
    // Таблица
    const tableData = items.map(item => [
      item.name,
      item.quantity.toString(),
      item.price.toLocaleString('ru-RU'),
      (item.price * item.quantity).toLocaleString('ru-RU')
    ]);

    autoTable(doc, {
      startY: 70,
      head: [['Наименование', 'Кол-во', 'Цена', 'Сумма']],
      body: tableData,
      styles: { font: 'helvetica', fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    // Итого
    const finalY = (doc as any).lastAutoTable.finalY || 100;
    doc.setFontSize(14);
    doc.text(`ИТОГО: ${total.toLocaleString('ru-RU')} ₽`, 20, finalY + 20);

    // Реквизиты
    if (pdfSettings.companyName) {
      doc.setFontSize(10);
      doc.text(pdfSettings.companyName, 20, finalY + 40);
      doc.text(pdfSettings.companyDetails, 20, finalY + 50);
    }

    doc.save(`смета_${eventName || 'без_названия'}.pdf`);
  };

  // Экспорт Excel с UTF-8 BOM
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
      'Количество': 0,
      'Цена за ед.': 0,
      'Сумма': total
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Смета');
    
    // UTF-8 BOM для кириллицы
    XLSX.writeFile(wb, `смета_${eventName || 'без_названия'}.xlsx`);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Шапка */}
      <div className="border-b p-4 flex items-center justify-between bg-gray-50">
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
          <Button onClick={handleSave} disabled={!eventName || items.length === 0}>
            <Save className="w-4 h-4 mr-2" />
            Сохранить
          </Button>
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex-1 flex overflow-hidden">
        {/* Левая колонка - Оборудование */}
        <div className="w-1/2 border-r flex flex-col">
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
              {filteredEquipment.map(item => (
                <Card 
                  key={item.id} 
                  className="cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={() => addItem(item)}
                >
                  <CardContent className="p-3">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.category}</p>
                    <p className="text-sm font-semibold mt-1">
                      {item.price.toLocaleString('ru-RU')} ₽
                    </p>
                    <p className="text-xs text-gray-400">
                      В наличии: {item.quantity}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Правая колонка - Смета */}
        <div className="w-1/2 flex flex-col">
          <div className="p-4 border-b space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Позиции сметы
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                {itemCount} поз.
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
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
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
          <div className="border-t p-4 bg-gray-50">
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