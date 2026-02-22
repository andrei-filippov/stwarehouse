import { useState, useEffect, useCallback, memo } from 'react';
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

import { Spinner } from './ui/spinner';

interface ChecklistsProps {
  estimates: Estimate[];
  equipment: { id: string; name: string; category: string; price?: number }[];
  categories: { id: string; name: string }[];
  checklists: Checklist[];
  rules: ChecklistRule[];
  onCreateRule: (rule: any, items: any[]) => Promise<{ error: any }>;
  onDeleteRule: (id: string) => Promise<{ error: any }>;
  onCreateChecklist: (estimate: Estimate, customItems?: ChecklistItem[], notes?: string) => Promise<{ error: any }>;
  onUpdateChecklistItem: (checklistId: string, itemId: string, updates: Partial<ChecklistItem>) => Promise<{ error: any }>;
  onDeleteChecklist: (id: string) => Promise<{ error: any }>;
  loading?: boolean;
}

export const ChecklistsManager = memo(function ChecklistsManager({
  estimates,
  equipment,
  categories,
  checklists,
  rules,
  onCreateRule,
  onDeleteRule,
  onCreateChecklist,
  onUpdateChecklistItem,
  onDeleteChecklist,
  loading
}: ChecklistsProps) {
  const [activeTab, setActiveTab] = useState('checklists');
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [isChecklistDialogOpen, setIsChecklistDialogOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  const handleExportChecklist = useCallback((checklist: Checklist) => {
    exportChecklistToPDF(checklist);
  }, []);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
  }, []);

  const handleOpenRuleDialog = useCallback(() => {
    setIsRuleDialogOpen(true);
  }, []);

  const handleCloseRuleDialog = useCallback(() => {
    setIsRuleDialogOpen(false);
  }, []);

  const handleOpenChecklistDialog = useCallback(() => {
    setIsChecklistDialogOpen(true);
  }, []);

  const handleCloseChecklistDialog = useCallback(() => {
    setIsChecklistDialogOpen(false);
  }, []);

  const handleOpenCalculator = useCallback(() => {
    setIsCalculatorOpen(true);
  }, []);

  const handleCloseCalculator = useCallback(() => {
    setIsCalculatorOpen(false);
  }, []);

  const handleSelectChecklist = useCallback((checklist: Checklist) => {
    setSelectedChecklist(checklist);
  }, []);

  const handleDeselectChecklist = useCallback(() => {
    setSelectedChecklist(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
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
        <TabsContent value="checklists" className="space-y-3 md:space-y-4">
          <Card>
            <CardHeader className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <CardTitle className="text-base md:text-lg">Чек-листы</CardTitle>
                <Button onClick={handleOpenChecklistDialog} size="sm" className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Создать
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
                <div className="space-y-2 md:space-y-3">
                  {checklists.map(checklist => (
                    <Card 
                      key={checklist.id} 
                      className="cursor-pointer hover:shadow-md"
                      onClick={() => handleSelectChecklist(checklist)}
                    >
                      <CardContent className="p-3 md:p-4">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm md:text-base truncate">{checklist.event_name}</p>
                            <p className="text-xs md:text-sm text-gray-500">
                              {checklist.event_date ? new Date(checklist.event_date).toLocaleDateString('ru-RU') : '—'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                            <Badge variant="outline" className="text-xs">
                              {checklist.items?.filter(i => i.is_checked).length || 0}/{checklist.items?.length || 0}
                            </Badge>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportChecklist(checklist);
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0"
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
        <TabsContent value="rules" className="space-y-3 md:space-y-4">
          <Card>
            <CardHeader className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <CardTitle className="text-base md:text-lg">Правила</CardTitle>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button variant="outline" onClick={handleOpenCalculator} size="sm" className="flex-1 sm:flex-none">
                    <Wrench className="w-4 h-4 mr-2" />
                    <span className="hidden md:inline">Калькулятор</span>
                    <span className="md:hidden">Кальк.</span>
                  </Button>
                  <Button onClick={handleOpenRuleDialog} size="sm" className="flex-1 sm:flex-none">
                    <Plus className="w-4 h-4 mr-2" />
                    <span className="hidden md:inline">Новое правило</span>
                    <span className="md:hidden">Добавить</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-4">
                Правила автоматически добавляют инструменты в чек-лист на основе позиций сметы.
              </p>
              
              {rules.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-2">Нет созданных правил</p>
                  <p className="text-sm">Создайте правило для автоматического формирования чек-листов</p>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {rules.map(rule => (
                    <Card key={rule.id}>
                      <CardContent className="p-3 md:p-4">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm md:text-base">{rule.name}</p>
                            <p className="text-xs md:text-sm text-gray-500">
                              {rule.condition_type === 'category' ? 'Категория' : 'Оборудование'}: {rule.condition_value}
                            </p>
                            <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2">
                              {rule.items?.slice(0, 3).map((item, idx) => (
                                <Badge key={idx} variant="secondary" className="text-[10px] md:text-xs">
                                  {item.name} × {item.quantity}
                                  {item.is_required && ' *'}
                                </Badge>
                              ))}
                              {rule.items && rule.items.length > 3 && (
                                <Badge variant="secondary" className="text-[10px] md:text-xs">+{rule.items.length - 3}</Badge>
                              )}
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 flex-shrink-0"
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
        <DialogContent className="max-w-2xl w-[95%] md:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новое правило</DialogTitle>
          </DialogHeader>
          <RuleForm 
            equipment={equipment}
            categories={categories}
            onSubmit={onCreateRule}
            onCancel={handleCloseRuleDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Диалог создания чек-листа */}
      <Dialog open={isChecklistDialogOpen} onOpenChange={setIsChecklistDialogOpen}>
        <DialogContent className="max-w-2xl w-[95%] md:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Создать чек-лист</DialogTitle>
          </DialogHeader>
          <ChecklistCreateForm
            estimates={estimates}
            onSubmit={onCreateChecklist}
            onCancel={handleCloseChecklistDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Диалог просмотра чек-листа */}
      <Dialog open={!!selectedChecklist} onOpenChange={handleDeselectChecklist}>
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
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});

// Форма создания правила
function RuleForm({ 
  equipment, 
  categories: equipmentCategories,
  onSubmit, 
  onCancel 
}: { 
  equipment: { id: string; name: string; category: string }[];
  categories: { id: string; name: string }[];
  onSubmit: (data: any, items: any[]) => void, 
  onCancel: () => void 
}) {
  const [name, setName] = useState('');
  const [conditionType, setConditionType] = useState<'category' | 'equipment'>('equipment');
  const [conditionValue, setConditionValue] = useState('');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [items, setItems] = useState<Array<{ name: string; quantity: number; category: string; is_required: boolean }>>([]);
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, category: 'tool', is_required: true });

  const addItem = useCallback(() => {
    if (!newItem.name) return;
    setItems(prev => [...prev, { ...newItem }]);
    setNewItem({ name: '', quantity: 1, category: 'tool', is_required: true });
  }, [newItem]);

  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const itemCategories = [
    { value: 'tool', label: 'Инструмент' },
    { value: 'cable', label: 'Кабель/Провод' },
    { value: 'accessory', label: 'Аксессуар' },
    { value: 'other', label: 'Другое' }
  ];

  const handleConditionTypeChange = useCallback((type: 'category' | 'equipment') => {
    setConditionType(type);
    setConditionValue('');
    setSelectedEquipmentId('');
    setSelectedCategory('');
  }, []);

  const handleEquipmentSelect = useCallback((equipmentId: string) => {
    setSelectedEquipmentId(equipmentId);
    const eq = equipment.find(e => e.id === equipmentId);
    if (eq) {
      setConditionValue(eq.name);
    }
  }, [equipment]);

  const handleCategorySelect = useCallback((categoryName: string) => {
    setSelectedCategory(categoryName);
    setConditionValue(categoryName);
  }, []);

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

      <div className="space-y-2">
        <Label>Привязка к</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={conditionType === 'equipment' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleConditionTypeChange('equipment')}
          >
            Оборудованию
          </Button>
          <Button
            type="button"
            variant={conditionType === 'category' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleConditionTypeChange('category')}
          >
            Категории
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{conditionType === 'equipment' ? 'Выберите оборудование' : 'Выберите категорию'}</Label>
        {conditionType === 'equipment' ? (
          <select
            className="w-full border rounded-md p-2"
            value={selectedEquipmentId}
            onChange={(e) => handleEquipmentSelect(e.target.value)}
          >
            <option value="">-- Выберите оборудование --</option>
            {equipment.map(eq => (
              <option key={eq.id} value={eq.id}>
                {eq.name} ({eq.category})
              </option>
            ))}
          </select>
        ) : (
          <select
            className="w-full border rounded-md p-2"
            value={selectedCategory}
            onChange={(e) => handleCategorySelect(e.target.value)}
          >
            <option value="">-- Выберите категорию --</option>
            {equipmentCategories.map(cat => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        )}
        {conditionValue && (
          <p className="text-sm text-gray-500">
            Условие: {conditionType === 'equipment' ? 'Оборудование' : 'Категория'} = "{conditionValue}"
          </p>
        )}
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-medium">Что добавлять в чек-лист</h4>
        
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-5">
            <Input
              placeholder="Название"
              value={newItem.name}
              onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <Input
              type="number"
              min={1}
              placeholder="Кол-во"
              value={newItem.quantity}
              onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
            />
          </div>
          <div className="col-span-3">
            <Select value={newItem.category} onValueChange={(v) => setNewItem(prev => ({ ...prev, category: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {itemCategories.map(c => (
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
                  {itemCategories.find(c => c.value === item.category)?.label}
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

  const addCustomItem = useCallback(() => {
    if (!newItemName) return;
    setCustomItems(prev => [...prev, {
      name: newItemName,
      quantity: 1,
      category: 'other',
      is_required: true,
      is_checked: false
    }]);
    setNewItemName('');
  }, [newItemName]);

  const removeCustomItem = useCallback((idx: number) => {
    setCustomItems(prev => prev.filter((_, i) => i !== idx));
  }, []);

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
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomItem())}
          />
          <Button onClick={addCustomItem} size="sm">
            <ListPlus className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-1">
          {customItems.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
              <span>{item.name}</span>
              <Button variant="ghost" size="sm" onClick={() => removeCustomItem(idx)}>
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
}: { 
  checklist: Checklist; 
  onUpdateItem: (checklistId: string, itemId: string, updates: Partial<ChecklistItem>) => Promise<{ error: any }>;
}) {
  // Локальное состояние для мгновенного обновления UI
  const [localItems, setLocalItems] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    checklist.items?.forEach(item => {
      if (item.id) initial[item.id] = item.is_checked;
    });
    return initial;
  });

  // Синхронизируем локальное состояние с пропсами
  useEffect(() => {
    const updated: Record<string, boolean> = {};
    checklist.items?.forEach(item => {
      if (item.id) updated[item.id] = item.is_checked;
    });
    setLocalItems(updated);
  }, [checklist.items]);

  const handleToggle = useCallback(async (item: ChecklistItem) => {
    if (!item.id) {
      console.error('Item has no id:', item);
      return;
    }
    
    // Мгновенно обновляем локальное состояние
    const newValue = !localItems[item.id];
    setLocalItems(prev => ({ ...prev, [item.id]: newValue }));
    
    // Отправляем на сервер
    await onUpdateItem(checklist.id, item.id, { is_checked: newValue });
  }, [localItems, checklist.id, onUpdateItem]);

  // Используем локальное состояние или пропсы
  const isChecked = useCallback((item: ChecklistItem) => {
    if (!item.id) return item.is_checked;
    return localItems[item.id] ?? item.is_checked;
  }, [localItems]);

  const grouped = checklist.items?.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const categoryNames: Record<string, string> = {
    equipment: 'Оборудование из сметы',
    tool: 'Инструменты',
    cable: 'Кабели и провода',
    accessory: 'Аксессуары',
    other: 'Другое'
  };

  const progress = checklist.items?.filter(i => isChecked(i)).length || 0;
  const total = checklist.items?.length || 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-gray-50 p-3 rounded">
        <div>
          <p className="text-sm text-gray-500">Дата: {new Date(checklist.event_date).toLocaleDateString('ru-RU')}</p>
          <p className="text-sm font-medium">Готово: {progress} / {total}</p>
        </div>
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
              {items.map((item, idx) => {
                const checked = isChecked(item);
                return (
                  <div 
                    key={idx}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                      checked ? 'bg-green-50' : 'bg-gray-50'
                    }`}
                    onClick={() => handleToggle(item)}
                  >
                    {checked ? (
                      <CheckSquare className="w-5 h-5 text-green-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                    <span className={`flex-1 ${checked ? 'line-through text-gray-500' : ''}`}>
                      {item.name}
                      <span className="text-gray-500 ml-2">× {item.quantity}</span>
                      {item.is_required && <span className="text-red-500 ml-1">*</span>}
                    </span>
                  </div>
                );
              })}
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
    equipment: 'Оборудование из сметы',
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
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
        h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
        .subtitle { text-align: center; font-size: 12px; color: #666; margin-bottom: 15px; }
        .info { font-size: 11px; margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px; }
        .category { font-size: 13px; font-weight: bold; margin-top: 12px; margin-bottom: 6px; color: #2980b9; border-bottom: 1px solid #2980b9; padding-bottom: 2px; }
        .category.equipment { color: #27ae60; border-bottom-color: #27ae60; }
        .item { font-size: 10px; margin: 4px 0; display: flex; align-items: center; }
        .checkbox { width: 12px; height: 12px; border: 1px solid #333; margin-right: 8px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .checkbox.checked { background: #2980b9; color: white; border-color: #2980b9; }
        .notes { margin-top: 15px; padding: 10px; background: #fffacd; border-radius: 4px; font-size: 10px; }
        .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #666; text-align: center; }
        @media print { 
          .no-print { display: none; }
          body { margin: 15px; }
        }
      </style>
    </head>
    <body>
      <h1>ЧЕК-ЛИСТ МЕРОПРИЯТИЯ</h1>
      <div class="subtitle">${checklist.event_name}</div>
      
      <div class="info">
        <strong>Дата мероприятия:</strong> ${new Date(checklist.event_date).toLocaleDateString('ru-RU')}<br>
        <strong>Дата формирования:</strong> ${new Date().toLocaleDateString('ru-RU')}<br>
        <strong>Всего позиций:</strong> ${checklist.items?.length || 0}
      </div>

      ${Object.entries(grouped || {}).map(([category, items]) => `
        <div class="category ${category === 'equipment' ? 'equipment' : ''}">${categoryNames[category] || category}</div>
        ${items.map(item => `
          <div class="item">
            <span class="checkbox ${item.is_checked ? 'checked' : ''}">${item.is_checked ? '✓' : ''}</span>
            <span style="flex: 1;">${item.name}</span>
            <span style="margin-left: 10px; font-weight: bold;">× ${item.quantity}</span>
            ${item.is_required ? '<span style="color: red; margin-left: 5px;">*</span>' : ''}
          </div>
        `).join('')}
      `).join('')}

      ${checklist.notes ? `
        <div class="notes">
          <strong>Примечания:</strong><br>
          ${checklist.notes}
        </div>
      ` : ''}
      
      <div class="footer">
        * — обязательный пункт
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 500);
}
