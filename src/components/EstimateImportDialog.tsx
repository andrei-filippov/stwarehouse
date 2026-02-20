import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Upload, CheckSquare, Square, FileSpreadsheet, Calendar, MapPin, User, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { EstimateItem } from '../types';

interface ImportItem {
  id: string;
  selected: boolean;
  num: number;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  price: number;
  coefficient: number;
  category?: string;
}

interface EstimateImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (estimateData: {
    event_name: string;
    venue: string;
    event_date: string;
  }, items: EstimateItem[]) => void;
}

export function EstimateImportDialog({
  isOpen,
  onClose,
  onImport
}: EstimateImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'details'>('upload');
  const [importData, setImportData] = useState<ImportItem[]>([]);
  const [detectedInfo, setDetectedInfo] = useState<{
    eventName?: string;
    venue?: string;
    eventDate?: string;
  }>({});
  const [estimateDetails, setEstimateDetails] = useState({
    event_name: '',
    venue: '',
    event_date: ''
  });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const splitNameAndDescription = (fullText: string): { name: string; description: string } => {
    if (!fullText) return { name: '', description: '' };
    
    const separators = [' - ', ' / ', ' (', ' [', '–', '—'];
    
    for (const sep of separators) {
      const idx = fullText.indexOf(sep);
      if (idx > 0) {
        const name = fullText.substring(0, idx).trim();
        let desc = fullText.substring(idx + sep.length).trim();
        if (sep === ' (' || sep === ' [') {
          desc = sep.trim() + desc;
          if (!desc.endsWith(')') && !desc.endsWith(']')) {
            desc += sep === ' (' ? ')' : ']';
          }
        }
        return { name, description: desc };
      }
    }
    
    return { name: fullText.trim(), description: '' };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const data = event.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      processExcelData(rows);
    };

    reader.readAsBinaryString(file);
  };

  const processExcelData = (rows: any[][]) => {
    const items: ImportItem[] = [];
    const info: { eventName?: string; venue?: string; eventDate?: string } = {};
    let currentCategory = '';
    let rowNumber = 0;

    for (const row of rows) {
      rowNumber++;
      
      if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) {
        continue;
      }

      // Ищем информацию о мероприятии (обычно в первых строках)
      if (row[1] && typeof row[1] === 'string') {
        const text = row[1];
        
        // Дата мероприятия
        if (text.includes('Дата') || text.includes('25.02.2026') || text.match(/\d{2}\.\d{2}\.\d{4}/)) {
          const dateMatch = text.match(/(\d{2}\.\d{2}\.\d{4})/);
          if (dateMatch) {
            const [day, month, year] = dateMatch[1].split('.');
            info.eventDate = `${year}-${month}-${day}`;
          }
        }
        
        // Место проведения
        if (text.includes('Место') || text.includes('площадка') || text.includes('Гранд Холл')) {
          const venueMatch = text.match(/Место[\s:]+(.+?)(?:\(|$)/i) || 
                             text.match(/площадка[\s:]+(.+?)(?:\(|$)/i) ||
                             text.match(/:\s*(.+)/);
          if (venueMatch) {
            info.venue = venueMatch[1].trim();
          }
        }

        // Название мероприятия
        if (text.includes('мероприятия:') || rowNumber === 4) {
          const eventMatch = text.match(/мероприятия:\s*(.+)/i) ||
                            text.match(/:\s*(.+)/);
          if (eventMatch && !info.eventName) {
            info.eventName = eventMatch[1].trim();
          }
        }
      }

      // Определяем категорию (строка без номера, но с текстом)
      const firstCell = row[0];
      const isCategoryRow = (firstCell === null || firstCell === undefined || firstCell === '') 
        && row[1] && typeof row[1] === 'string'
        && (!row[2] || row[2] === '') && (!row[3] || row[3] === '');

      if (isCategoryRow) {
        currentCategory = row[1].trim();
        continue;
      }

      // Пропускаем заголовки таблицы
      if (typeof firstCell === 'string' && 
          (firstCell.toLowerCase().includes('наименование') || 
           firstCell.toLowerCase().includes('№') ||
           firstCell === 'N' ||
           firstCell === '#' ||
           firstCell === 'n')) {
        continue;
      }

      // Проверяем, является ли строка позицией оборудования
      const hasNumber = typeof firstCell === 'number' || /^\d+$/.test(String(firstCell));
      const nameCell = row[1];
      
      if (hasNumber && nameCell) {
        const fullText = String(nameCell);
        const { name, description } = splitNameAndDescription(fullText);
        
        let unit = String(row[2] || 'шт').trim();
        if (!unit || unit === 'undefined') unit = 'шт';
        
        // Ищем цену (обычно в колонках 4 или 5)
        let price = 0;
        for (let i = 4; i <= 6; i++) {
          if (row[i] && typeof row[i] === 'number' && row[i] > 100) {
            price = row[i];
            break;
          }
        }

        // Количество
        let quantity = 1;
        if (row[3] && typeof row[3] === 'number') {
          quantity = row[3];
        }

        // Коэффициент (обычно после количества или цены)
        let coefficient = 1;
        for (let i = 5; i <= 7; i++) {
          if (row[i] && (row[i] === 1 || row[i] === 2 || row[i] === 0.5)) {
            coefficient = row[i];
            break;
          }
        }

        items.push({
          id: `row-${rowNumber}`,
          selected: true,
          num: typeof firstCell === 'number' ? firstCell : parseInt(firstCell),
          name: name || fullText,
          description: description,
          unit: unit,
          quantity: quantity,
          price: price,
          coefficient: coefficient,
          category: currentCategory
        });
      }
    }

    // Если не нашли название мероприятия, используем имя файла
    if (!info.eventName) {
      info.eventName = 'Новое мероприятие';
    }

    setDetectedInfo(info);
    setEstimateDetails({
      event_name: info.eventName || '',
      venue: info.venue || '',
      event_date: info.eventDate || ''
    });
    setImportData(items);
    setStep('preview');
  };

  const handleSelectAll = (selected: boolean) => {
    setImportData(items => items.map(item => ({ ...item, selected })));
  };

  const handleToggleItem = (id: string) => {
    setImportData(items => items.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  const handleUpdateItem = (id: string, updates: Partial<ImportItem>) => {
    setImportData(items => items.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const handleImport = () => {
    const selectedItems = importData.filter(item => item.selected);
    
    const estimateItems: EstimateItem[] = selectedItems.map((item) => ({
      equipment_id: undefined, // Импортированное оборудование не привязано к справочнику
      name: item.name,
      description: item.description,
      category: item.category || 'Общее',
      quantity: item.quantity,
      price: item.price,
      unit: item.unit,
      coefficient: item.coefficient
    }));

    onImport(estimateDetails, estimateItems);
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep('upload');
    setImportData([]);
    setDetectedInfo({});
    setEstimateDetails({ event_name: '', venue: '', event_date: '' });
    onClose();
  };

  const selectedCount = importData.filter(i => i.selected).length;
  const totalSum = importData
    .filter(i => i.selected)
    .reduce((sum, item) => sum + (item.price * item.quantity * item.coefficient), 0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      processFile(file);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby="estimate-import-desc">
        <DialogHeader>
          <DialogTitle>Импорт сметы из Excel</DialogTitle>
          <DialogDescription id="estimate-import-desc">
            {step === 'upload' && 'Загрузите файл сметы в формате Excel'}
            {step === 'preview' && `Найдено ${importData.length} позиций на сумму ${totalSum.toLocaleString('ru-RU')} ₽`}
            {step === 'details' && 'Уточните данные мероприятия'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <p className="text-gray-600 mb-2">
                Перетащите файл сметы сюда или нажмите для выбора
              </p>
              <p className="text-sm text-gray-400">
                Поддерживаются: .xlsx, .xls
              </p>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="hidden"
              />
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Выбрать файл
              </Button>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700">
              <p className="font-medium mb-2">Как работает импорт сметы:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-600">
                <li>Автоматически распознаёт название, дату и место мероприятия</li>
                <li>Разделяет название оборудования и описание по разделителю " - "</li>
                <li>Сохраняет количество, цену и коэффициент для каждой позиции</li>
                <li>Вы можете редактировать данные перед сохранением</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Быстрое редактирование деталей сметы */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <Label className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Мероприятие
                </Label>
                <Input
                  value={estimateDetails.event_name}
                  onChange={(e) => setEstimateDetails({ ...estimateDetails, event_name: e.target.value })}
                  placeholder="Название"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Площадка
                </Label>
                <Input
                  value={estimateDetails.venue}
                  onChange={(e) => setEstimateDetails({ ...estimateDetails, venue: e.target.value })}
                  placeholder="Место проведения"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Дата
                </Label>
                <Input
                  type="date"
                  value={estimateDetails.event_date}
                  onChange={(e) => setEstimateDetails({ ...estimateDetails, event_date: e.target.value })}
                />
              </div>
            </div>

            {/* Информация о выборе */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <Badge variant="secondary">
                  {selectedCount} из {importData.length} выбрано
                </Badge>
                <Badge variant="outline" className="text-green-600">
                  Сумма: {totalSum.toLocaleString('ru-RU')} ₽
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleSelectAll(true)}>
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Все
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSelectAll(false)}>
                  <Square className="w-4 h-4 mr-2" />
                  Никого
                </Button>
              </div>
            </div>

            {/* Таблица с прокруткой */}
            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox 
                        checked={selectedCount === importData.length && importData.length > 0}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      />
                    </TableHead>
                    <TableHead className="w-12">№</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead className="w-20">Ед.</TableHead>
                    <TableHead className="w-20">Кол-во</TableHead>
                    <TableHead className="w-20">Цена</TableHead>
                    <TableHead className="w-16">Коэф</TableHead>
                    <TableHead className="w-24">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.map((item) => (
                    <TableRow key={item.id} className={!item.selected ? 'opacity-50' : ''}>
                      <TableCell>
                        <Checkbox 
                          checked={item.selected}
                          onCheckedChange={() => handleToggleItem(item.id)}
                        />
                      </TableCell>
                      <TableCell>{item.num}</TableCell>
                      <TableCell>
                        <Input
                          value={item.name}
                          onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                          className="min-w-[150px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                          className="min-w-[150px] text-sm"
                          placeholder="—"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.unit}
                          onChange={(e) => handleUpdateItem(item.id, { unit: e.target.value })}
                          className="w-16 text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.price}
                          onChange={(e) => handleUpdateItem(item.id, { price: parseFloat(e.target.value) || 0 })}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.5"
                          value={item.coefficient}
                          onChange={(e) => handleUpdateItem(item.id, { coefficient: parseFloat(e.target.value) || 1 })}
                          className="w-16"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {(item.price * item.quantity * item.coefficient).toLocaleString('ru-RU')} ₽
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Предупреждение */}
            <div className="flex items-center gap-2 mt-4 p-3 bg-amber-50 text-amber-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Импортированное оборудование будет добавлено только в эту смету. Для добавления в справочник используйте импорт во вкладке "Оборудование".</span>
            </div>

            {/* Кнопки */}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Загрузить другой файл
              </Button>
              <Button onClick={handleImport} disabled={selectedCount === 0}>
                Создать смету ({selectedCount} позиций)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
