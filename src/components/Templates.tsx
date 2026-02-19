import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Plus, Trash2, Edit, Copy } from 'lucide-react';
import type { Template, TemplateItem } from '../types';

interface TemplatesManagerProps {
  templates: Template[];
  categories: { id: string; name: string }[];
  equipment: { id: string; name: string; category: string }[];
  onCreate: (template: any, items: any[]) => Promise<{ error: any; data?: any }>;
  onUpdate: (id: string, updates: any, items?: any[]) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
}

export function TemplatesManager({
  templates,
  categories,
  equipment,
  onCreate,
  onUpdate,
  onDelete
}: TemplatesManagerProps) {
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleOpenNew = () => {
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (template: Template) => {
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleSubmit = async (data: any, items: any[]) => {
    if (editingTemplate) {
      await onUpdate(editingTemplate.id, data, items);
    } else {
      await onCreate(data, items);
    }
    handleClose();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Шаблоны смет</CardTitle>
            <Button onClick={handleOpenNew}>
              <Plus className="w-4 h-4 mr-2" />
              Новый шаблон
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-2">Нет созданных шаблонов</p>
              <p className="text-sm">Создайте шаблон для быстрого заполнения смет</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead>Позиций</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>{template.description || '-'}</TableCell>
                    <TableCell>{template.items?.length || 0}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleOpenEdit(template)}
                          title="Редактировать"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onDelete(template.id)}
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Диалог создания/редактирования шаблона */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Редактировать шаблон' : 'Новый шаблон'}
            </DialogTitle>
          </DialogHeader>
          <TemplateForm
            categories={categories}
            equipment={equipment}
            template={editingTemplate}
            onSubmit={handleSubmit}
            onCancel={handleClose}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TemplateFormProps {
  categories: { id: string; name: string }[];
  equipment: { id: string; name: string; category: string }[];
  template: Template | null;
  onSubmit: (data: any, items: any[]) => void;
  onCancel: () => void;
}

function TemplateForm({ categories, equipment, template, onSubmit, onCancel }: TemplateFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [newItem, setNewItem] = useState({
    category: '',
    equipment_id: '',
    equipment_name: '',
    default_quantity: 1
  });
  const [quantityInput, setQuantityInput] = useState('1');

  // Сброс состояния при открытии
  useEffect(() => {
    if (template) {
      setName(template.name || '');
      setDescription(template.description || '');
      setItems(template.items || []);
    } else {
      setName('');
      setDescription('');
      setItems([]);
    }
    setNewItem({ category: '', equipment_id: '', equipment_name: '', default_quantity: 1 });
    setQuantityInput('1');
  }, [template?.id]);

  const addItem = () => {
    if (!newItem.equipment_name) return;
    const itemToAdd: TemplateItem = {
      id: crypto.randomUUID(),
      category: newItem.category,
      equipment_id: newItem.equipment_id || undefined,
      equipment_name: newItem.equipment_name,
      default_quantity: parseInt(quantityInput) || 1
    };
    setItems([...items, itemToAdd]);
    setNewItem({ category: '', equipment_id: '', equipment_name: '', default_quantity: 1 });
    setQuantityInput('1');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  const handleQuantityChange = (value: string) => {
    setQuantityInput(value);
    const num = parseInt(value);
    if (!isNaN(num) && num > 0) {
      setNewItem(prev => ({ ...prev, default_quantity: num }));
    }
  };

  const handleEquipmentSelect = (equipmentId: string) => {
    const selected = equipment.find(e => e.id === equipmentId);
    if (selected) {
      setNewItem({
        category: selected.category,
        equipment_id: selected.id,
        equipment_name: selected.name,
        default_quantity: 1
      });
    } else {
      setNewItem({ category: '', equipment_id: '', equipment_name: '', default_quantity: 1 });
    }
  };

  return (
    <div className="space-y-6">
      {/* Основная информация */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="template-name">Название шаблона *</Label>
          <Input 
            id="template-name"
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Например: Конференция, Концерт, Свадьба"
            required 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-desc">Описание</Label>
          <Input 
            id="template-desc"
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание шаблона (необязательно)"
          />
        </div>
      </div>

      {/* Добавление позиций */}
      <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
        <h4 className="font-medium">Добавить оборудование в шаблон</h4>
        
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-4">
            <select
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={newItem.equipment_id}
              onChange={(e) => handleEquipmentSelect(e.target.value)}
            >
              <option value="">Выберите оборудование</option>
              {equipment.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} ({eq.category})
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3">
            <Input
              placeholder="Или введите название вручную"
              value={newItem.equipment_id ? '' : newItem.equipment_name}
              onChange={(e) => setNewItem({ ...newItem, equipment_name: e.target.value, equipment_id: '', category: '' })}
              onKeyDown={handleKeyDown}
              disabled={!!newItem.equipment_id}
            />
          </div>
          <div className="col-span-2">
            <select
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              disabled={!!newItem.equipment_id}
            >
              <option value="">Категория</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <Input
              type="text"
              min={1}
              placeholder="Кол-во"
              value={quantityInput}
              onChange={(e) => handleQuantityChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="col-span-1">
            <Button 
              onClick={addItem} 
              size="sm" 
              className="w-full"
              disabled={!newItem.equipment_name}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Список позиций */}
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700">
            Позиции шаблона ({items.length})
          </h5>
          
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Добавьте оборудование в шаблон
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {items.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex justify-between items-center bg-white p-3 rounded border"
                >
                  <div className="flex-1">
                    <span className="font-medium text-sm">{item.equipment_name}</span>
                    <span className="text-gray-500 text-sm ml-2">
                      ({item.category}) × {item.default_quantity} шт.
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeItem(idx)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Кнопки */}
      <div className="flex gap-3 pt-4 border-t">
        <Button 
          onClick={() => onSubmit({ name, description }, items)}
          className="flex-1"
          disabled={!name}
        >
          <Copy className="w-4 h-4 mr-2" />
          {template ? 'Сохранить изменения' : 'Создать шаблон'}
        </Button>
        <Button 
          variant="outline" 
          onClick={onCancel}
        >
          Отмена
        </Button>
      </div>
    </div>
  );
}
