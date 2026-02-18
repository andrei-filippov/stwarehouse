import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { 
  Trash2, 
  Save, 
  ChevronLeft,
  FileText,
  Package,
  Printer,
  Image
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

  // Экспорт PDF с кириллицей через встроенный шрифт
  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Заголовок
    doc.setFontSize(20);
    doc.text('SMETA', 105, 20, { align: 'center' });
    
    // Информация о мероприятии
    doc.setFontSize(12);
    doc.text(`Meropriyatie: ${eventName}`, 20, 40);
    doc.text(`Ploshadka: ${venue}`, 20, 50);
    doc.text(`Data: ${eventDate}`, 20, 60);
    
    // Таблица
    const tableData = items.map(item => [
      item.name,
      item.quantity.toString(),
      item.price.toLocaleString('ru-RU'),
      (item.price * item.quantity).toLocaleString('ru-RU')
    ]);

    autoTable(doc, {
      startY: 70,
      head: [['Naimenovanie', 'Kol-vo', 'Tsena', 'Summa']],
      body: tableData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    // Итого
    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(14);
    doc.text(`ITOGO: ${total.toLocaleString('ru-RU')} RUB`, 20, finalY + 20);

    // Реквизиты
    if (pdfSettings.companyName) {
      doc.setFontSize(10);
      doc.text(pdfSettings.companyName, 20, finalY + 40);
      doc.text(pdfSettings.companyDetails, 20, finalY + 50);
    }

    doc.save(`smeta_${eventName || 'bez_nazvaniya'}.pdf`);
  };

  // Экспорт Excel с UTF-8 BOM
  const exportExcel = () => {
    const data = items.map(item => ({
      'Naimenovanie': item.name,
      'Opisanie': item.description,
      'Kolichestvo': item.quantity,
      'Tsena za ed.': item.price,
      'Summa': item.price * item.quantity
    }));

    data.push({
      'Naimenovanie': 'ITOGO',
      'Opisanie': '',
      'Kolichestvo': totalQuantity,
      'Tsena za ed.': '',
      'Summa': total
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Smeta');
    
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
            Nazad
          </Button>
          <h1 className="text-xl font-bold">
            {estimate ? 'Redaktirovanie smety' : 'Novaya smeta'}
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
            Pechat
          </Button>
          <Button onClick={handleSave} disabled={!eventName || items.length === 0}>
            <Save className="w-4 h-4 mr-2" />
            Sokhranit
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
              Dostupnoe oborudovanie
            </h2>
            <Input
              placeholder="Poisk..."
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
                  {cat === 'all' ? 'Vse' : cat}
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
                      {item.price.toLocaleString('ru-RU')} RUB
                    </p>
                    <p className="text-xs text-gray-400">
                      V nalichii: {item.quantity}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Правая колонка - Смета */}
        <div className="w-1/2 flex flex-col print:w-full">
          <div className="p-4 border-b space-y-4 print:hidden">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Pozitsii smety
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                {items.length} poz. ({totalQuantity} ed.)
              </span>
            </h2>
            
            <div className="space-y-2">
              <Input
                placeholder="Nazvanie meropriyatiya *"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
              <Input
                placeholder="Ploshadka"
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

          {/* Версия для печати */}
          <div ref={printRef} className="hidden print:block p-8">
            {pdfSettings.logo && (
              <img src={pdfSettings.logo} alt="Logo" className="h-16 mb-4" />
            )}
            <h1 className="text-2xl font-bold mb-4">SMETA</h1>
            <p><strong>Meropriyatie:</strong> {eventName}</p>
            <p><strong>Ploshadka:</strong> {venue}</p>
            <p><strong>Data:</strong> {eventDate}</p>
            <table className="w-full mt-4 border-collapse">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="text-left py-2">Naimenovanie</th>
                  <th className="text-center py-2">Kol-vo</th>
                  <th className="text-right py-2">Tsena</th>
                  <th className="text-right py-2">Summa</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2">{item.name}</td>
                    <td className="text-center py-2">{item.quantity}</td>
                    <td className="text-right py-2">{item.price.toLocaleString('ru-RU')} RUB</td>
                    <td className="text-right py-2">{(item.price * item.quantity).toLocaleString('ru-RU')} RUB</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 text-right font-bold text-xl">
              ITOGO: {total.toLocaleString('ru-RU')} RUB
            </div>
            {pdfSettings.companyName && (
              <div className="mt-8 text-sm">
                <p>{pdfSettings.companyName}</p>
                <p>{pdfSettings.companyDetails}</p>
                <p>{pdfSettings.position}: {pdfSettings.personName}</p>
                {pdfSettings.signature && (
                  <img src={pdfSettings.signature} alt="Podpis" className="h-12 mt-2" />
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4 print:hidden">
            {items.length === 0 ? (
              <div className="text-center text-gray-400 mt-10">
                <p>Dobavte oborudovanie iz spiska sleva</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <Card key={index}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          {item.price.toLocaleString('ru-RU')} RUB × {item.quantity}
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
              <span>ITOGO:</span>
              <span>{total.toLocaleString('ru-RU')} RUB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
