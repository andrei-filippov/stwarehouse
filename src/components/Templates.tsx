import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Plus, Trash2, Edit } from 'lucide-react';
import type { Template, TemplateItem } from '../types';

interface TemplatesManagerProps {
  templates: Template[];
  categories: { id: string; name: string }[];
  onCreate: (template: any, items: any[]) => Promise<{ error: any; data?: any }>;
  onUpdate: (id: string, updates: any, items?: any[]) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
}

export function TemplatesManager({
  templates,
  categories,
  onCreate,
  onUpdate,
  onDelete
}: TemplatesManagerProps) {
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Шаблоны смет</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingTemplate(null)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Новый шаблон
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingTemplate ? 'Редактировать шаблон' : 'Новый шаблон'}
                  </DialogTitle>
                </DialogHeader>
                <TemplateForm
                  categories={categories}
                  template={editingTemplate}
                  onSubmit={async (data, items) => {
                    if (editingTemplate) {
                      await onUpdate(editingTemplate.id, data, items);
                    } else {
                      await onCreate(data, items);
                    }
                    setIsDialogOpen(false);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Описание</TableHead>
                <TableHead>Позиций</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>{template.description || '-'}</TableCell>
                  <TableCell>{template.items?.length || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setEditingTemplate(template);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onDelete(template.id)}
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
    </div>
  );
}

function TemplateForm({ 
  categories, 
  template, 
  onSubmit 
}: { 
  categories: { id: string; name: string }[];
  template: Template | null;
  onSubmit: (data: any, items: any[]) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [newItem, setNewItem] = useState({
    category: '',
    equipment_name: '',
    default_quantity: 1
  });

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
    setNewItem({ category: '', equipment_name: '', default_quantity: 1 });
  }, [template?.id]);

  const addItem = () => {
    if (!newItem.equipment_name) return;
    setItems([...items, { ...newItem, id: crypto.randomUUID() }]);
    setNewItem({ category: '', equipment_name: '', default_quantity: 1 });
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Название шаблона</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Описание</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium mb-2">Позиции шаблона</h4>
        
        <div className="flex gap-2 mb-2">
          <select
            className="border rounded px-2 py-1"
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
          >
            <option value="">Категория</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <Input
            placeholder="Название оборудования"
            value={newItem.equipment_name}
            onChange={(e) => setNewItem({ ...newItem, equipment_name: e.target.value })}
          />
          <Input
            type="number"
            className="w-24"
            value={newItem.default_quantity}
            onChange={(e) => setNewItem({ ...newItem, default_quantity: parseInt(e.target.value) || 1 })}
          />
          <Button onClick={addItem} size="sm">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-1 max-h-60 overflow-auto">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded">
              <span className="text-sm">{item.equipment_name} ({item.category}) × {item.default_quantity}</span>
              <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                <Trash2 className="w-3 h-3 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Button 
        onClick={() => onSubmit({ name, description }, items)}
        className="w-full"
        disabled={!name}
      >
        {template ? 'Сохранить изменения' : 'Создать шаблон'}
      </Button>
    </div>
  );
}