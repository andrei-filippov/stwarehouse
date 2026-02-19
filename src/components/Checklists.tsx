import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Plus, 
  Trash2, 
  FileText, 
  ClipboardCheck, 
  Wrench,
  Download,
  CheckSquare,
  Square,
  ListPlus
} from 'lucide-react';
import type { Checklist, ChecklistRule, ChecklistItem, Estimate } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ChecklistsProps {
  estimates: Estimate[];
  checklists: Checklist[];
  rules: ChecklistRule[];
  onCreateRule: (rule: any, items: any[]) => Promise<{ error: any }>;
  onDeleteRule: (id: string) => Promise<{ error: any }>;
  onCreateChecklist: (estimate: Estimate, customItems?: ChecklistItem[], notes?: string) => Promise<{ error: any }>;
  onUpdateChecklistItem: (checklistId: string, itemId: string, updates: Partial<ChecklistItem>) => Promise<{ error: any }>;
  onDeleteChecklist: (id: string) => Promise<{ error: any }>;
}

export function ChecklistsManager({
  estimates,
  checklists,
  rules,
  onCreateRule,
  onDeleteRule,
  onCreateChecklist,
  onUpdateChecklistItem,
  onDeleteChecklist
}: ChecklistsProps) {
  const [activeTab, setActiveTab] = useState('checklists');
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [isChecklistDialogOpen, setIsChecklistDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="checklists" className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Чек-листы
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Правила
          </TabsTrigger>
        </TabsList>

        {/* Вкладка Чек-листы */}
        <TabsContent value="checklists" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Чек-листы мероприятий</CardTitle>
                <Button onClick={() => setIsChecklistDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Создать чек-лист
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {checklists.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-2">Нет созданных чек-листов</p>
                  <p className="text-sm">Создайте чек-лист на основе сметы</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {checklists.map(checklist => (
                    <Card 
                      key={checklist.id} 
                      className="cursor-pointer hover:shadow-md"
                      onClick={() => setSelectedChecklist(checklist)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{checklist.event_name}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(checklist.event_date).toLocaleDateString('ru-RU')}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">
                              {checklist.items?.filter(i => i.is_checked).length || 0} / {checklist.items?.length || 0}
                            </Badge>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                exportChecklistToPDF(checklist);
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteChecklist(checklist.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка Правила */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Правила формирования чек-листов</CardTitle>
                <Button onClick={() => setIsRuleDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Новое правило
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                Правила автоматически добавляют инструменты и оборудование в чек-лист на основе позиций сметы.
              </p>
              
              {rules.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-2">Нет созданных правил</p>
                  <p className="text-sm">Создайте правило для автоматического формирования чек-листов</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map(rule => (
                    <Card key={rule.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">{rule.name}</p>
                            <p className="text-sm text-gray-500">
                              Условие: {rule.condition_type === 'category' ? 'Категория' : 'Оборудование'} = "{rule.condition_value}"
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {rule.items?.map((item, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {item.name} × {item.quantity}
                                  {item.is_required && ' *'}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => onDeleteRule(rule.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Диалог создания правила */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Новое правило</DialogTitle>
          </DialogHeader>
          <RuleForm 
            onSubmit={async (data, items) => {
              await onCreateRule(data, items);
              setIsRuleDialogOpen(false);
            }}
            onCancel={() => setIsRuleDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Диалог создания чек-листа */}
      <Dialog open={isChecklistDialogOpen} onOpenChange={setIsChecklistDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Создать чек-лист</DialogTitle>
          </DialogHeader>
          <ChecklistCreateForm
            estimates={estimates}
            onSubmit={async (estimate, customItems, notes) => {
              await onCreateChecklist(estimate, customItems, notes);
              setIsChecklistDialogOpen(false);
            }}
            onCancel={() => setIsChecklistDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Диалог просмотра чек-листа */}
      <Dialog open={!!selectedChecklist} onOpenChange={() => setSelectedChecklist(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              {selectedChecklist?.event_name}
            </DialogTitle>
          </DialogHeader>
          {selectedChecklist && (
            <ChecklistView 
              checklist={selectedChecklist}
              onUpdateItem={onUpdateChecklistItem}
              onExportPDF={() => exportChecklistToPDF(selectedChecklist)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Форма создания правила
function RuleForm({ onSubmit, onCancel }: { onSubmit: (data: any, items: any[]) => void, onCancel: () => void }) {
  const [name, setName] = useState('');
  const [conditionType, setConditionType] = useState<'category' | 'equipment'>('equipment');
  const [conditionValue, setConditionValue] = useState('');
  const [items, setItems] = useState<Array<{ name: string; quantity: number; category: string; is_required: boolean }>>([]);
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, category: 'tool', is_required: true });

  const addItem = () => {
    if (!newItem.name) return;
    setItems([...items, { ...newItem }]);
    setNewItem({ name: '', quantity: 1, category: 'tool', is_required: true });
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const categories = [
    { value: 'tool', label: 'Инструмент' },
    { value: 'cable', label: 'Кабель/Провод' },
    { value: 'accessory', label: 'Аксессуар' },
    { value: 'other', label: 'Другое' }
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Название правила</Label>
        <Input 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Звуковая система"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Тип условия</Label>
          <Select value={conditionType} onValueChange={(v) => setConditionType(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equipment">Оборудование</SelectItem>
              <SelectItem value="category">Категория</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Значение условия</Label>
          <Input 
            value={conditionValue} 
            onChange={(e) => setConditionValue(e.target.value)}
            placeholder={conditionType === 'category' ? 'Звук' : 'Микшер'}
          />
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-medium">Что добавлять в чек-лист</h4>
        
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-5">
            <Input
              placeholder="Название"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Input
              type="number"
              min={1}
              placeholder="Кол-во"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="col-span-3">
            <Select value={newItem.category} onValueChange={(v) => setNewItem({ ...newItem, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Button onClick={addItem} className="w-full" disabled={!newItem.name}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded">
              <span className="text-sm">
                {item.name} × {item.quantity}
                <Badge variant="outline" className="ml-2 text-xs">
                  {categories.find(c => c.value === item.category)?.label}
                </Badge>
                {item.is_required && <span className="text-red-500 ml-1">*</span>}
              </span>
              <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                <Trash2 className="w-3 h-3 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button 
          onClick={() => onSubmit({ name, condition_type: conditionType, condition_value: conditionValue }, items)}
          className="flex-1"
          disabled={!name || !conditionValue}
        >
          Создать правило
        </Button>
        <Button variant="outline" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  );
}

// Форма создания чек-листа
function ChecklistCreateForm({ 
  estimates, 
  onSubmit, 
  onCancel 
}: { 
  estimates: Estimate[]; 
  onSubmit: (estimate: Estimate, customItems: ChecklistItem[], notes: string) => void;
  onCancel: () => void;
}) {
  const [selectedEstimateId, setSelectedEstimateId] = useState('');
  const [notes, setNotes] = useState('');
  const [customItems, setCustomItems] = useState<ChecklistItem[]>([]);
  const [newItemName, setNewItemName] = useState('');

  const selectedEstimate = estimates.find(e => e.id === selectedEstimateId);

  const addCustomItem = () => {
    if (!newItemName) return;
    setCustomItems([...customItems, {
      name: newItemName,
      quantity: 1,
      category: 'other',
      is_required: true,
      is_checked: false
    }]);
    setNewItemName('');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Выберите смету</Label>
        <Select value={selectedEstimateId} onValueChange={setSelectedEstimateId}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите смету..." />
          </SelectTrigger>
          <SelectContent>
            {estimates.map(e => (
              <SelectItem key={e.id} value={e.id}>
                {e.event_name} ({new Date(e.event_date).toLocaleDateString('ru-RU')})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedEstimate && (
        <div className="bg-blue-50 p-3 rounded text-sm">
          <p><strong>Площадка:</strong> {selectedEstimate.venue}</p>
          <p><strong>Позиций в смете:</strong> {selectedEstimate.items?.length || 0}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Дополнительные пункты (вручную)</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Например: Запасные батарейки"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomItem()}
          />
          <Button onClick={addCustomItem} size="sm">
            <ListPlus className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-1">
          {customItems.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
              <span>{item.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setCustomItems(customItems.filter((_, i) => i !== idx))}>
                <Trash2 className="w-3 h-3 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Примечания</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Особые требования, контакты и т.д."
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button 
          onClick={() => selectedEstimate && onSubmit(selectedEstimate, customItems, notes)}
          className="flex-1"
          disabled={!selectedEstimate}
        >
          Создать чек-лист
        </Button>
        <Button variant="outline" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  );
}

// Просмотр чек-листа
function ChecklistView({ 
  checklist, 
  onUpdateItem,
  onExportPDF
}: { 
  checklist: Checklist; 
  onUpdateItem: (checklistId: string, itemId: string, updates: Partial<ChecklistItem>) => Promise<{ error: any }>;
  onExportPDF: () => void;
}) {
  const handleToggle = async (item: ChecklistItem) => {
    await onUpdateItem(checklist.id, item.id!, { is_checked: !item.is_checked });
  };

  const grouped = checklist.items?.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const categoryNames: Record<string, string> = {
    tool: 'Инструменты',
    cable: 'Кабели и провода',
    accessory: 'Аксессуары',
    other: 'Другое'
  };

  const progress = checklist.items?.filter(i => i.is_checked).length || 0;
  const total = checklist.items?.length || 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-gray-50 p-3 rounded">
        <div>
          <p className="text-sm text-gray-500">Дата: {new Date(checklist.event_date).toLocaleDateString('ru-RU')}</p>
          <p className="text-sm font-medium">Готово: {progress} / {total}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onExportPDF}>
          <Download className="w-4 h-4 mr-2" />
          PDF
        </Button>
      </div>

      {checklist.notes && (
        <div className="bg-yellow-50 p-3 rounded text-sm">
          <strong>Примечания:</strong> {checklist.notes}
        </div>
      )}

      <div className="space-y-4">
        {grouped && Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h4 className="font-semibold mb-2 text-sm text-gray-700">
              {categoryNames[category] || category}
            </h4>
            <div className="space-y-1">
              {items.map((item, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                    item.is_checked ? 'bg-green-50' : 'bg-gray-50'
                  }`}
                  onClick={() => handleToggle(item)}
                >
                  {item.is_checked ? (
                    <CheckSquare className="w-5 h-5 text-green-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                  <span className={`flex-1 ${item.is_checked ? 'line-through text-gray-500' : ''}`}>
                    {item.name}
                    <span className="text-gray-500 ml-2">× {item.quantity}</span>
                    {item.is_required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Экспорт чек-листа в PDF с поддержкой кириллицы
function exportChecklistToPDF(checklist: Checklist) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const grouped = checklist.items?.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const categoryNames: Record<string, string> = {
    tool: 'Инструменты',
    cable: 'Кабели и провода',
    accessory: 'Аксессуары',
    other: 'Другое'
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Чек-лист - ${checklist.event_name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { text-align: center; font-size: 20px; margin-bottom: 5px; }
        .subtitle { text-align: center; font-size: 12px; color: #666; margin-bottom: 20px; }
        .info { font-size: 12px; margin-bottom: 20px; }
        .category { font-size: 14px; font-weight: bold; margin-top: 15px; margin-bottom: 8px; color: #2980b9; }
        .item { font-size: 11px; margin: 5px 0; display: flex; align-items: center; }
        .checkbox { width: 14px; height: 14px; border: 1px solid #333; margin-right: 8px; display: inline-flex; align-items: center; justify-content: center; }
        .checkbox.checked { background: #2980b9; color: white; }
        .notes { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 11px; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <h1>ЧЕК-ЛИСТ</h1>
      <div class="subtitle">${checklist.event_name}</div>
      
      <div class="info">
        <strong>Дата мероприятия:</strong> ${new Date(checklist.event_date).toLocaleDateString('ru-RU')}<br>
        <strong>Дата формирования:</strong> ${new Date().toLocaleDateString('ru-RU')}
      </div>

      ${Object.entries(grouped || {}).map(([category, items]) => `
        <div class="category">${categoryNames[category] || category}</div>
        ${items.map(item => `
          <div class="item">
            <span class="checkbox ${item.is_checked ? 'checked' : ''}">${item.is_checked ? '✓' : ''}</span>
            ${item.name} × ${item.quantity}
            ${item.is_required ? '<span style="color: red;">*</span>' : ''}
          </div>
        `).join('')}
      `).join('')}

      ${checklist.notes ? `
        <div class="notes">
          <strong>Примечания:</strong><br>
          ${checklist.notes}
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
}
