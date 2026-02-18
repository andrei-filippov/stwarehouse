import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Plus, Upload, Download, Trash2, Edit, Search } from 'lucide-react';
import type { Equipment } from '../types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface EquipmentManagerProps {
  equipment: Equipment[];
  categories: { id: string; name: string }[];
  onAdd: (item: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>) => Promise<{ error: any }>;
  onUpdate: (id: string, updates: Partial<Equipment>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
  onBulkInsert: (items: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>[]) => Promise<{ error: any; count?: number }>;
}

export function EquipmentManager({ 
  equipment, 
  categories, 
  onAdd, 
  onUpdate, 
  onDelete,
  onBulkInsert 
}: EquipmentManagerProps) {
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredEquipment = equipment.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        // Excel
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        processImportData(jsonData);
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const processImportData = (data: any[]) => {
    // Ожидаемые колонки: name, category, quantity, price, description
    const processed = data.map((row: any) => ({
      name: row.name || row.Название || row['Наименование'] || '',
      category: row.category || row.Категория || row['Категория'] || 'Общее',
      quantity: parseInt(row.quantity || row.Количество || row['Кол-во'] || 0),
      price: parseFloat(row.price || row.Цена || row['Стоимость'] || 0),
      description: row.description || row.Описание || ''
    })).filter(item => item.name); // Фильтруем пустые строки

    setImportData(processed);
    setImportPreview(true);
  };

  const handleImport = async () => {
    const { error } = await onBulkInsert(importData);
    if (!error) {
      setIsImportDialogOpen(false);
      setImportPreview(false);
      setImportData([]);
    }
  };

  const exportToExcel = () => {
    const data = equipment.map(item => ({
      'Название': item.name,
      'Категория': item.category,
      'Количество': item.quantity,
      'Цена': item.price,
      'Описание': item.description
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Оборудование');
    
    // UTF-8 для кириллицы
    XLSX.writeFile(wb, 'оборудование.xlsx');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Оборудование</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Импорт
              </Button>
              <Button variant="outline" onClick={exportToExcel}>
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Добавить оборудование</DialogTitle>
                  </DialogHeader>
                  <EquipmentForm 
                    categories={categories}
                    onSubmit={async (data) => {
                      const { error } = await onAdd(data);
                      if (!error) setIsAddDialogOpen(false);
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Поиск оборудования..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Кол-во</TableHead>
                <TableHead>Цена</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEquipment.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.price.toLocaleString('ru-RU')} ₽</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setEditingItem(item)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onDelete(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Диалог импорта */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Импорт оборудования</DialogTitle>
          </DialogHeader>
          
          {!importPreview ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Загрузите Excel или CSV файл со столбцами: Название, Категория, Количество, Цена, Описание
              </p>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                ref={fileInputRef}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm">Найдено записей: {importData.length}</p>
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Категория</TableHead>
                      <TableHead>Кол-во</TableHead>
                      <TableHead>Цена</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importData.slice(0, 10).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.price}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {importData.length > 10 && (
                  <p className="text-center text-sm text-gray-500 mt-2">
                    ... и ещё {importData.length - 10} записей
                  </p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setImportPreview(false);
                  setImportData([]);
                }}>
                  Отмена
                </Button>
                <Button onClick={handleImport}>
                  Импортировать {importData.length} записей
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать оборудование</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <EquipmentForm 
              categories={categories}
              initialData={editingItem}
              onSubmit={async (data) => {
                const { error } = await onUpdate(editingItem.id, data);
                if (!error) setEditingItem(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Форма оборудования
function EquipmentForm({ 
  categories, 
  initialData, 
  onSubmit 
}: { 
  categories: { id: string; name: string }[];
  initialData?: Partial<Equipment>;
  onSubmit: (data: any) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    category: initialData?.category || '',
    quantity: initialData?.quantity || 0,
    price: initialData?.price || 0,
    description: initialData?.description || ''
  });

  const handleNumberChange = (field: string, value: string) => {
    // Исправление проблемы с первой цифрой
    const numValue = value === '' ? 0 : parseFloat(value);
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  return (
    <form 
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formData);
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>Название</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Категория</Label>
        <select
          className="w-full border rounded-md p-2"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          required
        >
          <option value="">Выберите категорию</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.name}>{cat.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Количество</Label>
          <Input
            type="number"
            min="0"
            value={formData.quantity || ''}
            onChange={(e) => handleNumberChange('quantity', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Цена</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formData.price || ''}
            onChange={(e) => handleNumberChange('price', e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Описание</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>
      <Button type="submit" className="w-full">
        {initialData ? 'Сохранить' : 'Добавить'}
      </Button>
    </form>
  );
}