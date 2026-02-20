import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Upload, CheckSquare, Square, Edit2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { Equipment } from '../types';

interface ImportItem {
  id: string;
  selected: boolean;
  name: string;
  description: string;
  category: string;
  unit: string;
  price: number;
  originalRow: any;
  rowNumber: number;
}

interface EquipmentImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categories: { id: string; name: string }[];
  userId: string | undefined;
  onBulkInsert: (items: (Omit<Equipment, 'id' | 'created_at' | 'updated_at'> & { user_id: string })[]) => Promise<{ error: any; count?: number }>;
  onAddCategory: (name: string) => Promise<{ error: any; data?: any }>;
}

export function EquipmentImportDialog({
  isOpen,
  onClose,
  categories,
  userId,
  onBulkInsert,
  onAddCategory
}: EquipmentImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'editing'>('upload');
  const [importData, setImportData] = useState<ImportItem[]>([]);
  const [editingItem, setEditingItem] = useState<ImportItem | null>(null);
  const [detectedCategories, setDetectedCategories] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Статические единицы измерения
  const UNIT_OPTIONS = ['шт', 'комплект', 'услуга', 'человек', 'п.м.', 'шт.', 'компл.', 'ед.'];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const data = event.target?.result;
      
      if (file.name.endsWith('.csv')) {
        Papa.parse(data as string, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            processImportData(results.data);
          }
        });
      } else {
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        processExcelData(jsonData);
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const splitNameAndDescription = (fullText: string): { name: string; description: string } => {
    if (!fullText) return { name: '', description: '' };
    
    // Разделители: " - ", " / ", " (", "["
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

  const processExcelData = (rows: any[]) => {
    const items: ImportItem[] = [];
    const cats: string[] = [];
    let currentCategory = 'Общее';
    let rowNumber = 0;

    for (const row of rows) {
      rowNumber++;
      
      // Пропускаем пустые строки
      if (!row || row.every((cell: any) => cell === null || cell === undefined || cell === '')) {
        continue;
      }

      // Определяем категорию (строка без номера, но с текстом)
      const firstCell = row[0];
      const isCategoryRow = (firstCell === null || firstCell === undefined || firstCell === '') 
        && row[1] && typeof row[1] === 'string'
        && (!row[2] || row[2] === '') && (!row[3] || row[3] === '');

      if (isCategoryRow) {
        currentCategory = row[1].trim();
        if (!cats.includes(currentCategory)) {
          cats.push(currentCategory);
        }
        continue;
      }

      // Пропускаем заголовки таблицы
      if (typeof firstCell === 'string' && 
          (firstCell.toLowerCase().includes('наименование') || 
           firstCell.toLowerCase().includes('№') ||
           firstCell === 'N' ||
           firstCell === '#')) {
        continue;
      }

      // Проверяем, является ли строка позицией оборудования
      const hasNumber = typeof firstCell === 'number' || /^\d+$/.test(String(firstCell));
      const nameCell = row[1];
      
      if (hasNumber && nameCell) {
        const fullText = String(nameCell);
        const { name, description } = splitNameAndDescription(fullText);
        
        // Определяем единицу измерения
        let unit = String(row[2] || 'шт').trim();
        if (!unit || unit === 'undefined') unit = 'шт';
        
        // Приводим к стандартным единицам
        if (unit === 'шт.' || unit === 'ед.') unit = 'шт';
        if (unit === 'компл.') unit = 'комплект';

        items.push({
          id: `row-${rowNumber}`,
          selected: true,
          name: name || fullText,
          description: description,
          category: currentCategory,
          unit: unit,
          price: parseFloat(row[4]) || 0,
          originalRow: row,
          rowNumber
        });
      }
    }

    setDetectedCategories(cats);
    setImportData(items);
    setStep('preview');
  };

  const processImportData = (data: any[]) => {
    const items: ImportItem[] = [];
    const cats: string[] = [];
    let currentCategory = 'Общее';

    data.forEach((row, idx) => {
      // Если есть поле category - используем его
      if (row.category || row.Категория) {
        currentCategory = row.category || row.Категория;
        if (!cats.includes(currentCategory)) {
          cats.push(currentCategory);
        }
      }

      const fullText = row.name || row.Название || row['Наименование'] || '';
      if (!fullText) return;

      const { name, description } = splitNameAndDescription(fullText);
      
      items.push({
        id: `csv-${idx}`,
        selected: true,
        name: name || fullText,
        description: description || (row.description || row.Описание || ''),
        category: currentCategory,
        unit: row.unit || row['Ед.изм'] || row['Единица'] || 'шт',
        price: parseFloat(row.price || row.Цена || row['Стоимость'] || 0),
        originalRow: row,
        rowNumber: idx + 1
      });
    });

    setDetectedCategories(cats);
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

  const handleImport = async () => {
    if (!userId) {
      console.error('userId is undefined');
      return;
    }

    const selectedItems = importData.filter(item => item.selected);
    
    // Создаём новые категории если нужно
    const existingCategoryNames = categories.map(c => c.name);
    for (const item of selectedItems) {
      if (!existingCategoryNames.includes(item.category)) {
        await onAddCategory(item.category);
        existingCategoryNames.push(item.category);
      }
    }

    const itemsToInsert = selectedItems.map(item => ({
      name: item.name,
      description: item.description,
      category: item.category,
      quantity: 0, // Складской остаток = 0 по умолчанию
      price: item.price,
      unit: item.unit,
      user_id: userId
    }));

    const { error } = await onBulkInsert(itemsToInsert);
    if (!error) {
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setStep('upload');
    setImportData([]);
    setDetectedCategories([]);
    setEditingItem(null);
    onClose();
  };

  const selectedCount = importData.filter(i => i.selected).length;

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
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      processFile(file);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby="import-dialog-desc">
        <DialogHeader>
          <DialogTitle>Импорт оборудования</DialogTitle>
          <DialogDescription id="import-dialog-desc">
            {step === 'upload' && 'Загрузите файл Excel или CSV с данными оборудования'}
            {step === 'preview' && `Найдено ${importData.length} позиций. Выберите что импортировать.`}
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
              <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">
                Перетащите файл сюда или нажмите для выбора
              </p>
              <p className="text-sm text-gray-400">
                Поддерживаются: .xlsx, .xls, .csv
              </p>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="hidden"
                id="file-upload"
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
              <p className="font-medium mb-2">Как работает импорт:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-600">
                <li>Автоматически определяет категории из заголовков групп</li>
                <li>Разделяет название и описание по разделителю " - "</li>
                <li>Количество на складе устанавливается в 0 (заполните вручную)</li>
                <li>Вы можете редактировать данные перед импортом</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Информация и фильтры */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <Badge variant="secondary">
                  {selectedCount} из {importData.length} выбрано
                </Badge>
                {detectedCategories.length > 0 && (
                  <Badge variant="outline">
                    {detectedCategories.length} категорий
                  </Badge>
                )}
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
                    <TableHead>Название</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead className="w-20">Ед.</TableHead>
                    <TableHead className="w-24">Цена</TableHead>
                    <TableHead className="w-10"></TableHead>
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
                          className="min-w-[200px] text-sm"
                          placeholder="—"
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          value={item.category}
                          onChange={(e) => handleUpdateItem(item.id, { category: e.target.value })}
                          className="w-full border rounded px-2 py-1 text-sm"
                        >
                          {detectedCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                          <option value="Общее">Общее</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.unit}
                          onChange={(e) => handleUpdateItem(item.id, { unit: e.target.value })}
                          className="w-20 text-center"
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
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setEditingItem(item)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Предупреждение */}
            <div className="flex items-center gap-2 mt-4 p-3 bg-amber-50 text-amber-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Количество на складе будет установлено в 0 для всех позиций. Заполните остатки вручную после импорта.</span>
            </div>

            {/* Кнопки */}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Загрузить другой файл
              </Button>
              <Button onClick={handleImport} disabled={selectedCount === 0}>
                Импортировать {selectedCount} позиций
              </Button>
            </div>
          </div>
        )}

        {/* Диалог редактирования одной позиции */}
        {editingItem && (
          <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Редактирование позиции</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Название</Label>
                  <Input
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Описание</Label>
                  <Input
                    value={editingItem.description}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Категория</Label>
                  <Input
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Ед. изм.</Label>
                    <Input
                      value={editingItem.unit}
                      onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Цена</Label>
                    <Input
                      type="number"
                      value={editingItem.price}
                      onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditingItem(null)}>
                    Отмена
                  </Button>
                  <Button onClick={() => {
                    handleUpdateItem(editingItem.id, editingItem);
                    setEditingItem(null);
                  }}>
                    Сохранить
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
