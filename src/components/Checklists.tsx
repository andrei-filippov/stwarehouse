import { useState, useEffect, useCallback, memo, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { QRScanner } from './QRScanner';
import { 
  Plus, 
  Trash2, 
  FileText, 
  ClipboardCheck, 
  Wrench,
  Download,
  CheckSquare,
  Square,
  ListPlus,
  Edit,
  QrCode,
  Truck,
  RotateCcw,
  ToggleLeft,
  ToggleRight,
  Package
} from 'lucide-react';
import type { Checklist, ChecklistRule, ChecklistItem, Estimate, CableInventory } from '../types';
import { supabase } from '../lib/supabase';

import { Spinner } from './ui/spinner';

interface ChecklistsProps {
  estimates: Estimate[];
  equipment: { id: string; name: string; category: string; price?: number }[];
  categories: { id: string; name: string }[];
  cableInventory: CableInventory[]; // Реальные позиции из вкладки "Учет оборудования"
  cableCategories: { id: string; name: string }[]; // Категории для отображения
  checklists: Checklist[];
  rules: ChecklistRule[];
  onCreateRule: (rule: any, items?: any[]) => Promise<{ error: any }>;
  onDeleteRule: (id: string) => Promise<{ error: any }>;
  onCreateChecklist: (estimate: Estimate, customItems?: ChecklistItem[], notes?: string) => Promise<{ error: any }>;
  onUpdateChecklistItem: (checklistId: string, itemId: string, updates: Partial<ChecklistItem>) => Promise<{ error: any }>;
  onDeleteChecklist: (id: string) => Promise<{ error: any }>;
  loading?: boolean;
  fabAction?: number;
}

export const ChecklistsManager = memo(function ChecklistsManager({
  estimates,
  equipment,
  categories,
  cableInventory,
  cableCategories,
  checklists,
  rules,
  onCreateRule,
  onDeleteRule,
  onCreateChecklist,
  onUpdateChecklistItem,
  onDeleteChecklist,
  loading,
  fabAction
}: ChecklistsProps) {
  // Открываем создание чек-листа или правила при нажатии FAB (пропускаем первый рендер)
  const isFirstRender = useRef(false);
  useEffect(() => {
    if (!isFirstRender.current) {
      isFirstRender.current = true;
      return;
    }
    if (fabAction && fabAction > 0) {
      if (activeTab === 'checklists') {
        handleOpenChecklistDialog();
      } else {
        handleOpenRuleDialog();
      }
    }
  }, [fabAction]);
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

  const handleCreateRule = useCallback(async (rule: any, items?: any[]) => {
    console.log('[ChecklistsManager] handleCreateRule called with items:', items?.length, items);
    const result = await onCreateRule(rule, items);
    if (!result.error) {
      handleCloseRuleDialog();
    }
    return result;
  }, [onCreateRule]);

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

  // Обновляем selectedChecklist при изменении checklists (синхронизация с сервером)
  // Используем ref для отслеживания предыдущего значения, чтобы избежать лишних обновлений
  const prevChecklistsRef = useRef(checklists);
  useEffect(() => {
    if (selectedChecklist && checklists !== prevChecklistsRef.current) {
      const updated = checklists.find(c => c.id === selectedChecklist.id);
      console.log('[Checklists] checklists changed, found updated:', updated?.items?.length, 'current:', selectedChecklist.items?.length);
      // Обновляем только если данные реально изменились
      if (updated && JSON.stringify(updated.items) !== JSON.stringify(selectedChecklist.items)) {
        console.log('[Checklists] Updating selectedChecklist with new data');
        setSelectedChecklist(updated);
      }
      prevChecklistsRef.current = checklists;
    }
  }, [checklists, selectedChecklist]);

  const handleDeselectChecklist = useCallback(() => {
    setSelectedChecklist(null);
  }, []);

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
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="w-6 h-6" />
                </div>
              ) : checklists.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
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
                            <p className="text-xs md:text-sm text-muted-foreground">
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
              <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4">
                Правила автоматически добавляют инструменты в чек-лист на основе позиций сметы.
              </p>
              
              {rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
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
                            <p className="text-xs md:text-sm text-muted-foreground">
                              {rule.condition_type === 'category' ? 'Категория' : 'Оборудование'}: {rule.condition_value}
                            </p>
                            <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2">
                              {rule.items?.slice(0, 3).map((item, idx) => (
                                <Badge key={idx} variant="secondary" className="text-[10px] md:text-xs">
                                  {item.inventory_name || 'Позиция'} × {item.quantity}
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
        <DialogContent className="max-w-2xl w-[95%] max-h-[90vh] overflow-y-auto rounded-xl p-4 sm:p-6" aria-describedby="rule-dialog-desc">
          <DialogHeader>
            <DialogTitle>Новое правило</DialogTitle>
            <DialogDescription id="rule-dialog-desc">Создайте правило для автоматического формирования чек-листов</DialogDescription>
          </DialogHeader>
          <RuleForm 
            equipment={equipment}
            categories={categories}
            cableInventory={cableInventory}
            cableCategories={cableCategories}
            onSubmit={handleCreateRule}
            onCancel={handleCloseRuleDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Диалог создания чек-листа */}
      <Dialog open={isChecklistDialogOpen} onOpenChange={setIsChecklistDialogOpen}>
        <DialogContent className="max-w-4xl w-[95%] max-h-[90vh] overflow-y-auto rounded-xl p-4 sm:p-6" aria-describedby="checklist-dialog-desc">
          <DialogHeader>
            <DialogTitle>Создать чек-лист</DialogTitle>
            <DialogDescription id="checklist-dialog-desc">Создайте чек-лист на основе сметы</DialogDescription>
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
        <DialogContent className="max-w-4xl w-[95%] max-h-[85vh] overflow-y-auto rounded-xl p-4 sm:p-6" aria-describedby="view-checklist-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              {selectedChecklist?.event_name}
            </DialogTitle>
            <DialogDescription id="view-checklist-desc">Просмотр и управление чек-листом мероприятия</DialogDescription>
          </DialogHeader>
          {selectedChecklist && (
            <ChecklistView 
              checklist={selectedChecklist}
              onUpdateItem={onUpdateChecklistItem}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог калькулятора */}
      <Dialog open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6" aria-describedby="calculator-dialog-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Калькулятор инструментов
            </DialogTitle>
            <DialogDescription id="calculator-dialog-desc">Рассчитайте необходимое количество комплектующих</DialogDescription>
          </DialogHeader>
          <CalculatorForm onClose={handleCloseCalculator} />
        </DialogContent>
      </Dialog>
    </div>
  );
});

// Форма создания правила
function RuleForm({ 
  equipment, 
  categories: equipmentCategories,
  cableInventory,
  cableCategories,
  onSubmit, 
  onCancel 
}: { 
  equipment: { id: string; name: string; category: string }[];
  categories: { id: string; name: string }[];
  cableInventory: CableInventory[];
  cableCategories: { id: string; name: string }[];
  onSubmit: (data: any, items: any[]) => void, 
  onCancel: () => void 
}) {
  const [name, setName] = useState('');
  const [conditionType, setConditionType] = useState<'category' | 'equipment'>('equipment');
  const [conditionValue, setConditionValue] = useState('');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Выбранные позиции из инвентаря
  const [selectedItems, setSelectedItems] = useState<Array<{
    inventory_id: string;
    quantity: number;
    is_required: boolean;
    inventory_name?: string;
    inventory_category?: string;
    inventory_qr_code?: string;
  }>>([]);
  
  // Поиск инвентаря
  const [inventorySearch, setInventorySearch] = useState('');

  // Фильтрация инвентаря по поиску
  const filteredInventory = useMemo(() => {
    if (!inventorySearch.trim()) return cableInventory.slice(0, 20); // Показываем первые 20
    
    const search = inventorySearch.toLowerCase();
    return cableInventory.filter(item => {
      const itemName = item.name?.toLowerCase() || '';
      const categoryName = cableCategories.find(c => c.id === item.category_id)?.name.toLowerCase() || '';
      return itemName.includes(search) || categoryName.includes(search);
    }).slice(0, 50); // Макс 50 результатов
  }, [cableInventory, cableCategories, inventorySearch]);

  // Добавить позицию из инвентаря
  const addInventoryItem = useCallback((item: CableInventory) => {
    const categoryName = cableCategories.find(c => c.id === item.category_id)?.name;
    
    setSelectedItems(prev => {
      // Проверяем, не добавлена ли уже
      if (prev.some(p => p.inventory_id === item.id)) return prev;
      
      return [...prev, {
        inventory_id: item.id,
        quantity: 1,
        is_required: true,
        inventory_name: item.name || `${categoryName} ${item.length}м`,
        inventory_category: categoryName,
        inventory_qr_code: item.qr_code
      }];
    });
    setInventorySearch('');
  }, [cableCategories]);

  // Удалить позицию
  const removeItem = useCallback((index: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Обновить количество
  const updateQuantity = useCallback((index: number, delta: number) => {
    setSelectedItems(prev => prev.map((item, i) => 
      i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    ));
  }, []);

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
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="space-y-2">
        <Label>Название правила</Label>
        <Input 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Для концерта нужны кабели"
        />
      </div>

      <div className="space-y-2">
        <Label>Применять когда в смете есть</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={conditionType === 'equipment' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleConditionTypeChange('equipment')}
          >
            Оборудование
          </Button>
          <Button
            type="button"
            variant={conditionType === 'category' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleConditionTypeChange('category')}
          >
            Категория
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {conditionType === 'equipment' ? (
          <select
            className="w-full border border-border rounded-md p-2 bg-card text-foreground"
            value={selectedEquipmentId}
            onChange={(e) => handleEquipmentSelect(e.target.value)}
          >
            <option value="">-- Выберите оборудование из сметы --</option>
            {equipment.map(eq => (
              <option key={eq.id} value={eq.id}>
                {eq.name} ({eq.category})
              </option>
            ))}
          </select>
        ) : (
          <select
            className="w-full border border-border rounded-md p-2 bg-card text-foreground"
            value={selectedCategory}
            onChange={(e) => handleCategorySelect(e.target.value)}
          >
            <option value="">-- Выберите категорию из сметы --</option>
            {equipmentCategories.map(cat => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Выбор реальных позиций из инвентаря */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-medium">Добавить оборудование из склада</h4>
        <p className="text-xs text-muted-foreground">
          Выберите реальные позиции из вкладки "Учет оборудования". Они будут добавлены в чек-лист с QR-кодами.
        </p>
        
        {/* Поиск инвентаря */}
        <div className="relative">
          <Input
            placeholder="Поиск по названию или категории..."
            value={inventorySearch}
            onChange={(e) => setInventorySearch(e.target.value)}
          />
          {inventorySearch && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto z-50">
              {filteredInventory.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Ничего не найдено</div>
              ) : (
                filteredInventory.map(item => {
                  const categoryName = cableCategories.find(c => c.id === item.category_id)?.name;
                  const displayName = item.name || `${categoryName} ${item.length}м`;
                  const isAlreadyAdded = selectedItems.some(s => s.inventory_id === item.id);
                  
                  return (
                    <button
                      key={item.id}
                      className={`w-full text-left p-2 hover:bg-muted/50 flex items-center justify-between ${isAlreadyAdded ? 'opacity-50' : ''}`}
                      onClick={() => !isAlreadyAdded && addInventoryItem(item)}
                      disabled={isAlreadyAdded}
                    >
                      <div>
                        <div className="text-sm font-medium">{displayName}</div>
                        <div className="text-xs text-muted-foreground">{categoryName} {item.qr_code && `• QR: ${item.qr_code}`}</div>
                      </div>
                      {isAlreadyAdded && <span className="text-xs text-green-600">✓ Добавлено</span>}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Список выбранных позиций */}
        <div className="space-y-2">
          {selectedItems.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Выберите позиции из инвентаря выше
            </div>
          ) : (
            selectedItems.map((item, idx) => (
              <div key={item.inventory_id} className="flex items-center justify-between bg-muted/50 p-2 rounded">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.inventory_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.inventory_category}
                    {item.inventory_qr_code && <span className="ml-1 text-blue-600">• QR: {item.inventory_qr_code}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => updateQuantity(idx, -1)}>-</Button>
                    <span className="text-sm w-6 text-center">{item.quantity}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => updateQuantity(idx, 1)}>+</Button>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeItem(idx)}>
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button 
          onClick={() => {
            const itemsToSubmit = selectedItems.map(({ inventory_id, quantity, is_required, inventory_name, inventory_category, inventory_qr_code }) => ({
              inventory_id,
              quantity,
              is_required,
              inventory_name,
              inventory_category,
              inventory_qr_code
            }));
            console.log('[RuleForm] Submitting with items:', itemsToSubmit);
            onSubmit({ name, condition_type: conditionType, condition_value: conditionValue }, itemsToSubmit);
          }}
          className="flex-1"
          disabled={!name || !conditionValue || selectedItems.length === 0}
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
        <div className="bg-primary/10 p-3 rounded text-sm">
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
            <div key={idx} className="flex justify-between items-center bg-muted/50 p-2 rounded text-sm">
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
  // Режим проверки: 'simple' - один чекбокс, 'double' - погрузка + разгрузка
  const [checkMode, setCheckMode] = useState<'simple' | 'double'>('simple');
  
  // Оптимистичные обновления для мгновенного отклика UI
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, { is_checked?: boolean; loaded?: boolean; unloaded?: boolean; loaded_quantity?: number; unloaded_quantity?: number }>>({});
  
  // Локальный счетчик сканирований для синхронного отслеживания (чтобы не ждать API)
  const scanCounterRef = useRef<Record<string, { loaded: number; unloaded: number }>>({});
  
  // Локальный счетчик для комплектов (по названию оборудования)
  const kitScanCounterRef = useRef<Record<string, { loaded: number; unloaded: number }>>({});
  
  // QR-сканирование
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<'load' | 'unload'>('load');
  
  // Редактирование QR-кода
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingQrCode, setEditingQrCode] = useState('');

  // При смене чек-листа сбрасываем оптимистичные обновления и локальные счетчики
  useEffect(() => {
    setOptimisticUpdates({});
    scanCounterRef.current = {};
    kitScanCounterRef.current = {};
    
    // Отладка: показываем что пришло в чек-листе
    const itemsWithQr = checklist.items?.filter(i => i.qr_code) || [];
    console.log(`[ChecklistView] Loaded checklist: ${checklist.event_name}, items: ${checklist.items?.length}, with QR: ${itemsWithQr.length}`);
    console.log('[ChecklistView] Items with QR:', itemsWithQr.map(i => ({ name: i.name, qr: i.qr_code })));
  }, [checklist.id]);

  // Синхронизация с realtime обновлениями от других пользователей
  // ОТКЛЮЧЕНО: вызывает проблемы с обновлением UI после сканирования
  // useEffect(() => {
  //   setOptimisticUpdates(prev => {
  //     const newOptimistic = { ...prev };
  //     let hasChanges = false;
  //     
  //     checklist.items?.forEach(item => {
  //       if (!item.id) return;
  //       
  //       const optimistic = prev[item.id];
  //       if (!optimistic) return;
  //       
  //       const serverLoaded = (item as any).loaded ?? false;
  //       const serverUnloaded = (item as any).unloaded ?? false;
  //       const serverChecked = item.is_checked;
  //       
  //       if (
  //         (optimistic.loaded !== undefined && optimistic.loaded === serverLoaded) &&
  //         (optimistic.unloaded !== undefined && optimistic.unloaded === serverUnloaded) &&
  //         (optimistic.is_checked !== undefined && optimistic.is_checked === serverChecked)
  //       ) {
  //         delete newOptimistic[item.id];
  //         hasChanges = true;
  //       }
  //     });
  //     
  //     return hasChanges ? newOptimistic : prev;
  //   });
  // }, [checklist.items]);

  // Получаем статус item (с учетом режима)
  const getItemStatus = (item: ChecklistItem) => {
    const optimistic = item.id ? optimisticUpdates[item.id] : undefined;
    const status = {
      isChecked: optimistic?.is_checked ?? item.is_checked,
      loaded: optimistic?.loaded ?? (item as any).loaded ?? false,
      unloaded: optimistic?.unloaded ?? (item as any).unloaded ?? false,
      loaded_quantity: optimistic?.loaded_quantity ?? item.loaded_quantity ?? 0,
      unloaded_quantity: optimistic?.unloaded_quantity ?? item.unloaded_quantity ?? 0
    };
    return status;
  };

  // Проверяем состояние чекбокса (оптимистичное или из пропсов)
  const isChecked = useCallback((item: ChecklistItem): boolean => {
    const status = getItemStatus(item);
    if (checkMode === 'double') {
      // В двойном режиме считаем отмеченным только если разгружено
      // и количество разгружено >= требуемому
      if (!status.unloaded) return false;
      return status.unloaded_quantity >= item.quantity;
    }
    // В простом режиме проверяем loaded_quantity
    if (status.isChecked) return true;
    return status.loaded_quantity >= item.quantity;
  }, [checkMode, optimisticUpdates]);

  const handleToggle = useCallback(async (item: ChecklistItem) => {
    if (!item.id) {
      console.error('Item has no id:', item);
      return;
    }
    
    if (checkMode === 'double') {
      // Двойной режим: циклически переключаем unloaded -> loaded -> none
      const status = getItemStatus(item);
      let updates: any = {};
      
      if (!status.loaded && !status.unloaded) {
        // Первый клик - погрузка
        updates = { loaded: true, unloaded: false };
      } else if (status.loaded && !status.unloaded) {
        // Второй клик - разгрузка
        updates = { loaded: true, unloaded: true };
      } else {
        // Третий клик - сброс
        updates = { loaded: false, unloaded: false };
      }
      
      setOptimisticUpdates(prev => ({ ...prev, [item.id]: updates }));
      onUpdateItem(checklist.id, item.id, updates);
    } else {
      // Простой режим - стандартный чекбокс
      const newValue = !isChecked(item);
      setOptimisticUpdates(prev => ({ ...prev, [item.id]: { is_checked: newValue } }));
      onUpdateItem(checklist.id, item.id, { is_checked: newValue });
    }
  }, [checklist.id, onUpdateItem, isChecked, checkMode]);

  // Универсальная обработка QR-сканирования (оборудование или комплект)
  const handleQRScan = useCallback(async (qrCode: string) => {
    const searchCode = qrCode.toUpperCase();
    
    console.log('[QR Scan] Scanning:', searchCode);
    
    // 1. Проверяем - это QR код комплекта?
    const { data: kitData, error: kitError } = await supabase
      .from('equipment_kits')
      .select('id, name')
      .eq('qr_code', searchCode)
      .single();
    
    if (kitData && !kitError) {
      // Это комплект - обрабатываем все его позиции
      console.log('[QR Scan] Found kit:', kitData.name);
      await handleKitScan(kitData);
      return;
    }
    
    // 2. Ищем как обычное оборудование по QR-коду
    const item = checklist.items?.find(i => {
      const itemQr = i.qr_code?.toUpperCase();
      return itemQr === searchCode;
    });
    
    if (!item || !item.id) {
      toast.error('Позиция не найдена', { description: `QR-код ${qrCode} не найден в чек-листе` });
      return;
    }
    
    // 3. Обрабатываем как оборудование
    await handleEquipmentScan(item);
  }, [checklist.id, checklist.items, onUpdateItem, scanMode, optimisticUpdates, checkMode]);
  
  // Обработка сканирования оборудования (одна позиция) с учетом количества
  const handleEquipmentScan = useCallback(async (item: ChecklistItem) => {
    if (!item.id) return;
    
    // Инициализируем счетчик если нужно
    if (!scanCounterRef.current[item.id]) {
      scanCounterRef.current[item.id] = { loaded: 0, unloaded: 0 };
    }
    
    // Берем базовое количество из статуса (из БД или optimisticUpdates)
    const status = getItemStatus(item);
    const baseLoadedQty = status.loaded_quantity;
    const baseUnloadedQty = status.unloaded_quantity;
    
    // Добавляем локальные сканы из ref (для быстрого сканирования подряд)
    const localLoaded = scanCounterRef.current[item.id]?.loaded || 0;
    const localUnloaded = scanCounterRef.current[item.id]?.unloaded || 0;
    
    const currentLoadedQty = baseLoadedQty + localLoaded;
    const currentUnloadedQty = baseUnloadedQty + localUnloaded;
    
    const targetQty = item.quantity || 1;
    
    if (scanMode === 'load') {
      if (currentLoadedQty >= targetQty) {
        toast.info('Уже погружено полностью', { 
          description: `${item.name}: ${currentLoadedQty} из ${targetQty}` 
        });
        return;
      }
      
      // Увеличиваем локальный счетчик сразу (синхронно)
      scanCounterRef.current[item.id].loaded += 1;
      const newTotalQty = currentLoadedQty + 1;
      const isComplete = newTotalQty >= targetQty;
      
      let updates: any = {
        loaded_quantity: newTotalQty
      };
      
      if (checkMode === 'double') {
        updates.loaded = isComplete;
        if (!isComplete) updates.unloaded = false;
      } else {
        updates.is_checked = isComplete;
      }
      
      setOptimisticUpdates(prev => ({ ...prev, [item.id!]: updates }));
      
      // Запускаем API вызов асинхронно (не ждем)
      onUpdateItem(checklist.id, item.id, updates).catch(err => {
        console.error('Failed to update item:', err);
        // Откатываем локальный счетчик при ошибке
        scanCounterRef.current[item.id].loaded -= 1;
      });
      
      toast.success(
        isComplete ? '✅ Погружено полностью' : '📦 Погружено', 
        { description: `${item.name}: ${newTotalQty} из ${targetQty}` }
      );
      
    } else if (scanMode === 'unload') {
      if (currentLoadedQty < targetQty) {
        toast.error('Сначала нужно погрузить', { 
          description: `${item.name}: погружено ${currentLoadedQty} из ${targetQty}` 
        });
        return;
      }
      
      if (currentUnloadedQty >= targetQty) {
        toast.info('Уже разгружено полностью', { 
          description: `${item.name}: ${currentUnloadedQty} из ${targetQty}` 
        });
        return;
      }
      
      // Увеличиваем локальный счетчик сразу (синхронно)
      scanCounterRef.current[item.id].unloaded += 1;
      const newTotalQty = currentUnloadedQty + 1;
      const isComplete = newTotalQty >= targetQty;
      
      const updates = {
        unloaded_quantity: newTotalQty,
        loaded: true,
        unloaded: isComplete
      };
      
      setOptimisticUpdates(prev => ({ ...prev, [item.id!]: updates }));
      
      // Запускаем API вызов асинхронно (не ждем)
      onUpdateItem(checklist.id, item.id, updates).catch(err => {
        console.error('Failed to update item:', err);
        // Откатываем локальный счетчик при ошибке
        scanCounterRef.current[item.id].unloaded -= 1;
      });
      
      toast.success(
        isComplete ? '✅ Разгружено полностью' : '📦 Разгружено', 
        { description: `${item.name}: ${newTotalQty} из ${targetQty}` }
      );
    }
  }, [checklist.id, onUpdateItem, scanMode, optimisticUpdates, checkMode, getItemStatus]);

  // Обработка сканирования комплекта - учитывает количество единиц
  const handleKitScan = useCallback(async (kitData: { id: string; name: string }) => {
    try {
      console.log('[Kit Scan] Processing kit:', kitData.id, kitData.name);
      
      // Загружаем содержимое комплекта с количеством
      const { data: kitItemsData, error: kitItemsError } = await supabase
        .from('kit_items')
        .select(`
          inventory_id,
          quantity,
          cable_inventory(name)
        `)
        .eq('kit_id', kitData.id);
      
      if (kitItemsError) {
        console.error('[Kit Scan] Error loading kit items:', kitItemsError);
        toast.error('Ошибка загрузки комплекта');
        return;
      }
      
      console.log('[Kit Scan] Raw kit items data:', kitItemsData);
      
      // Создаем мапу: название оборудования -> необходимое количество
      const kitEquipmentMap = new Map<string, number>();
      kitItemsData?.forEach((item: any) => {
        const name = (item.cable_inventory as any)?.name?.toLowerCase().trim();
        const qty = item.quantity || 1;
        console.log(`[Kit Scan] Processing kit item: inventory_id=${item.inventory_id}, qty=${qty}, name=${name}`);
        if (name) {
          kitEquipmentMap.set(name, (kitEquipmentMap.get(name) || 0) + qty);
        }
      });
      
      console.log('[Kit Scan] Equipment in kit:', Object.fromEntries(kitEquipmentMap));
      console.log('[Kit Scan] Kit ID:', kitData.id);
      
      // Группируем items чек-листа по названию для подсчета
      const checklistItemsByName = new Map<string, typeof checklist.items>();
      for (const item of checklist.items || []) {
        const name = item.name.toLowerCase().trim();
        if (!checklistItemsByName.has(name)) {
          checklistItemsByName.set(name, []);
        }
        checklistItemsByName.get(name)!.push(item);
      }
      
      // DEBUG: Log all items with kit_id
      const itemsWithKitId = (checklist.items || []).filter(item => item.kit_id);
      console.log('[Kit Scan] Items in checklist with kit_id:', itemsWithKitId.map(i => ({ 
        name: i.name, 
        kit_id: i.kit_id, 
        kit_name: i.kit_name 
      })));
      
      // DEBUG: Log all item names in checklist for comparison
      console.log('[Kit Scan] All item names in checklist:', Array.from(checklistItemsByName.keys()));
      
      const kitIdStr = String(kitData.id);
      console.log('[Kit Scan] Looking for kit_id:', kitIdStr);
      let updatedCount = 0;
      const results: string[] = [];
      
      // Обрабатываем каждое оборудование из комплекта
      for (const [equipmentName, requiredQty] of kitEquipmentMap) {
        const matchingItems = checklistItemsByName.get(equipmentName) || [];
        
        // Также ищем по kit_id
        const itemsByKitId = (checklist.items || []).filter(item => 
          item.kit_id && String(item.kit_id) === kitIdStr
        );
        
        console.log(`[Kit Scan] Equipment "${equipmentName}": found by name=${matchingItems.length}, by kit_id=${itemsByKitId.length}`);
        
        // Объединяем и убираем дубликаты
        const allMatchingItems = [...matchingItems, ...itemsByKitId];
        const uniqueItems = allMatchingItems.filter((item, index, self) => 
          index === self.findIndex(i => i.id === item.id)
        );
        
        if (uniqueItems.length === 0) {
          console.log(`[Kit Scan] Equipment "${equipmentName}": NO MATCHING ITEMS FOUND`);
          results.push(`⚠️ ${equipmentName}: не найден в чек-листе`);
          continue;
        }
        
        console.log(`[Kit Scan] Equipment "${equipmentName}": total unique items=${uniqueItems.length}`);
        
        // Считаем сколько уже отсканировано (используем getItemStatus + локальные счетчики)
        let alreadyScanned = 0;
        for (const item of uniqueItems) {
          const status = getItemStatus(item);
          const baseQty = scanMode === 'unload' 
            ? status.unloaded_quantity
            : status.loaded_quantity;
          // Добавляем локальные сканы
          const localKey = `${item.id}_${equipmentName}`;
          const localQty = kitScanCounterRef.current[localKey]?.[scanMode] || 0;
          alreadyScanned += baseQty + localQty;
        }
        
        // Сколько нужно еще отсканировать
        let remainingToScan = Math.max(0, requiredQty - alreadyScanned);
        
        for (const item of uniqueItems) {
          if (remainingToScan <= 0) break;
          
          const status = getItemStatus(item);
          const currentQty = scanMode === 'unload' 
            ? status.unloaded_quantity
            : status.loaded_quantity;
          const itemNeeded = item.quantity || 1;
          
          // Сколько можно добавить к этой позиции
          const canAdd = Math.min(remainingToScan, itemNeeded - currentQty);
          
          if (canAdd > 0) {
            // Увеличиваем локальный счетчик комплекта
            const localKey = `${item.id}_${equipmentName}`;
            if (!kitScanCounterRef.current[localKey]) {
              kitScanCounterRef.current[localKey] = { loaded: 0, unloaded: 0 };
            }
            kitScanCounterRef.current[localKey][scanMode] += canAdd;
            
            const newTotalQty = currentQty + kitScanCounterRef.current[localKey][scanMode];
            
            console.log(`[Kit Scan] Item ${item.name} (id=${item.id}): currentQty=${currentQty}, canAdd=${canAdd}, newTotal=${newTotalQty}, itemNeeded=${itemNeeded}`);
            
            // Определяем статус на основе количества
            const isComplete = newTotalQty >= itemNeeded;
            
            let updates: any = {};
            if (scanMode === 'load') {
              updates.loaded_quantity = newTotalQty;
              if (checkMode === 'simple') {
                updates.is_checked = isComplete;
              } else {
                updates.loaded = isComplete;
                if (!isComplete) updates.unloaded = false;
              }
            } else if (scanMode === 'unload') {
              updates.unloaded_quantity = newTotalQty;
              updates.loaded = true;
              updates.unloaded = isComplete;
            }
            
            console.log(`[Kit Scan] Sending updates for item ${item.id}:`, updates);
            
            setOptimisticUpdates(prev => ({ ...prev, [item.id!]: updates }));
            
            // Запускаем API вызов асинхронно
            onUpdateItem(checklist.id, item.id!, updates).then(result => {
              console.log(`[Kit Scan] Update result for item ${item.id}:`, result);
            }).catch(err => {
              console.error('[Kit Scan] Failed to update kit item:', err);
              // Откатываем локальный счетчик при ошибке
              kitScanCounterRef.current[localKey][scanMode] -= canAdd;
            });
            
            updatedCount++;
            remainingToScan -= canAdd;
          }
        }
        
        // Итоговое количество после сканирования
        const scannedNow = requiredQty - remainingToScan;
        const finalScanned = alreadyScanned + scannedNow;
        
        const statusIcon = finalScanned >= requiredQty ? '✅' : '📦';
        results.push(`${statusIcon} ${equipmentName}: ${finalScanned} из ${requiredQty}`);
      }
      
      console.log(`[Kit Scan] Total updated: ${updatedCount}`);
      
      // Показываем детальный результат
      if (updatedCount > 0) {
        toast.success(
          `Комплект "${kitData.name}" отсканирован`,
          { 
            description: results.join('\n'),
            duration: 5000
          }
        );
      } else if (results.length > 0) {
        toast.info(
          `Комплект "${kitData.name}"`,
          { 
            description: results.join('\n'),
            duration: 5000
          }
        );
      } else {
        toast.info(`Комплект "${kitData.name}": оборудование не найдено в чек-листе`);
      }
    } catch (err: any) {
      console.error('[Kit Scan] Error:', err);
      toast.error('Ошибка сканирования комплекта', { description: err.message });
    }
  }, [checklist.id, checklist.items, onUpdateItem, getItemStatus, isChecked, checkMode, scanMode]);

  // Сохранение QR-кода
  const handleSaveQrCode = useCallback(async () => {
    if (!editingItemId) return;
    
    const item = checklist.items?.find(i => i.id === editingItemId);
    if (!item) return;
    
    await onUpdateItem(checklist.id, editingItemId, { qr_code: editingQrCode.trim() || null });
    setEditingItemId(null);
    setEditingQrCode('');
    toast.success('QR-код обновлён');
  }, [checklist.id, checklist.items, editingItemId, editingQrCode, onUpdateItem]);

  // Группировка по категориям использует актуальный чек-лист
  const grouped = useMemo(() => {
    return checklist.items?.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, ChecklistItem[]>);
  }, [checklist.items]);

  // Сортируем категории
  const sortedCategories = useMemo(() => {
    if (!grouped) return [];
    const categories = Object.keys(grouped);
    const categoryOrder = checklist.category_order;
    
    if (categoryOrder && categoryOrder.length > 0) {
      return categories.sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }
    
    return categories;
  }, [grouped, checklist.category_order]);

  const categoryNames: Record<string, string> = {
    equipment: 'Оборудование из сметы',
    tool: 'Инструменты',
    cable: 'Кабели и провода',
    accessory: 'Аксессуары',
    other: 'Другое'
  };

  // Прогресс считаем по актуальным данным
  const progress = useMemo(() => {
    return checklist.items?.filter(i => isChecked(i)).length || 0;
  }, [checklist.items, optimisticUpdates]);
  
  const total = checklist.items?.length || 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-muted/50 p-3 rounded">
        <div>
          <p className="text-sm text-muted-foreground">Дата: {new Date(checklist.event_date).toLocaleDateString('ru-RU')}</p>
          <p className="text-sm font-medium">Готово: {progress} / {total}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-green-600">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500/100"></span>
          </span>
          <span>Live</span>
        </div>
      </div>

      {checklist.notes && (
        <div className="bg-yellow-50 p-3 rounded text-sm">
          <strong>Примечания:</strong> {checklist.notes}
        </div>
      )}

      {/* Переключатель режима и кнопки */}
      <div className="flex flex-col gap-3">
        {/* Переключатель режима */}
        <div className="flex items-center justify-between bg-muted/50 p-3 rounded">
          <span className="text-sm text-muted-foreground">Режим проверки:</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCheckMode(checkMode === 'simple' ? 'double' : 'simple')}
            className="flex items-center gap-2"
          >
            {checkMode === 'simple' ? (
              <>
                <ToggleLeft className="w-5 h-5 text-muted-foreground/70" />
                <span>Простой</span>
              </>
            ) : (
              <>
                <ToggleRight className="w-5 h-5 text-blue-500" />
                <span>Двойной (погрузка+разгрузка)</span>
              </>
            )}
          </Button>
        </div>

        {/* Прогресс для двойного режима */}
        {checkMode === 'double' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-primary/10 p-2 rounded text-center">
              <div className="text-xs text-muted-foreground mb-1">Погружено</div>
              <div className="font-semibold text-blue-600">
                {checklist.items?.filter(i => getItemStatus(i).loaded).length || 0} / {total}
              </div>
            </div>
            <div className="bg-green-500/10 p-2 rounded text-center">
              <div className="text-xs text-muted-foreground mb-1">Разгружено</div>
              <div className="font-semibold text-green-600">
                {checklist.items?.filter(i => getItemStatus(i).unloaded).length || 0} / {total}
              </div>
            </div>
          </div>
        )}

        {/* Кнопки QR-сканирования */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={progress < total ? 'default' : 'outline'}
            onClick={() => {
              setScanMode('load');
              setIsQRScannerOpen(true);
            }}
            disabled={checkMode === 'simple' && progress === total}
            className="flex-1 sm:flex-none"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            {checkMode === 'double' ? 'Сканировать погрузку' : 'Сканировать QR'}
            {progress < total && checkMode === 'simple' && <span className="ml-1">({total - progress})</span>}
          </Button>
          
          {checkMode === 'double' && (
            <Button
              variant="outline"
              onClick={() => {
                setScanMode('unload');
                setIsQRScannerOpen(true);
              }}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Сканировать разгрузку
            </Button>
          )}
          
          {/* Подсказка о сканировании комплектов */}
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Package className="w-3 h-3" />
            Можно сканировать QR комплектов (KIT-*) и оборудования (EQ-*)
          </div>
          
          {progress > 0 && (
            <Button
              variant="outline"
              onClick={async () => {
                // Сброс всех отметок
                for (const item of checklist.items || []) {
                  if (item.id && isChecked(item)) {
                    await onUpdateItem(checklist.id, item.id, checkMode === 'double' 
                      ? { loaded: false, unloaded: false } 
                      : { is_checked: false });
                  }
                }
                setOptimisticUpdates({});
                toast.success('Все отметки сброшены');
              }}
            >
              Сбросить
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {grouped && sortedCategories.map((category) => (
          <div key={category}>
            <h4 className="font-semibold mb-2 text-sm text-foreground">
              {categoryNames[category] || category}
            </h4>
            <div className="space-y-1">
              {grouped[category].map((item) => {
                const status = getItemStatus(item);
                const checked = isChecked(item);
                const itemKey = item.id || `${item.name}-${item.category}`;
                
                if (checkMode === 'double') {
                  // Двойной режим - показываем два статуса
                  return (
                    <div 
                      key={itemKey}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                        status.unloaded ? 'bg-green-500/10' : status.loaded ? 'bg-primary/10' : 'bg-muted/50'
                      }`}
                      onClick={() => handleToggle(item)}
                    >
                      {/* Иконки погрузки/разгрузки */}
                      <div className="flex flex-col gap-1">
                        <div className={`w-3 h-3 rounded-full border-2 ${status.loaded ? 'bg-primary/100 border-blue-500' : 'border-gray-300'}`} title="Погрузка" />
                        <div className={`w-3 h-3 rounded-full border-2 ${status.unloaded ? 'bg-green-500/100 border-green-500' : 'border-gray-300'}`} title="Разгрузка" />
                      </div>
                      
                      <span className={`flex-1 ${status.unloaded ? 'line-through text-muted-foreground' : ''}`}>
                        {item.name}
                        {/* Отображение прогресса сканирования - используем status для оптимистичных обновлений */}
                        <span className={`ml-2 ${
                          (status.unloaded_quantity || 0) >= item.quantity ? 'text-green-600 font-medium' :
                          (status.loaded_quantity || 0) >= item.quantity ? 'text-blue-600 font-medium' :
                          (status.loaded_quantity || 0) > 0 || (status.unloaded_quantity || 0) > 0 ? 'text-amber-600' :
                          'text-muted-foreground'
                        }`}>
                          {scanMode === 'unload'
                            ? `${status.unloaded_quantity || 0} из ${item.quantity}`
                            : `${status.loaded_quantity || 0} из ${item.quantity}`
                          }
                        </span>
                        {item.is_required && <span className="text-red-500 ml-1">*</span>}
                        {(item as any).kit_name && <span className="text-xs text-purple-500 ml-2">📦 {(item as any).kit_name}</span>}
                        {item.qr_code && <span className="text-xs text-blue-500 ml-2">📱 {item.qr_code}</span>}
                        <span className="text-xs ml-2">
                          {status.unloaded ? '✅ разгружено' : status.loaded ? '📦 погружено' : ''}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 ml-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItemId(item.id || null);
                          setEditingQrCode(item.qr_code || '');
                        }}
                        title={item.qr_code ? 'Изменить QR-код' : 'Добавить QR-код'}
                      >
                        {item.qr_code ? (
                          <Edit className="w-3 h-3 text-muted-foreground/70" />
                        ) : (
                          <QrCode className="w-3 h-3 text-gray-300" />
                        )}
                      </Button>
                    </div>
                  );
                }
                
                // Простой режим
                return (
                  <div 
                    key={itemKey}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                      checked ? 'bg-green-500/10' : 'bg-muted/50'
                    }`}
                    onClick={() => handleToggle(item)}
                  >
                    {checked ? (
                      <CheckSquare className="w-5 h-5 text-green-600" />
                    ) : (
                      <Square className="w-5 h-5 text-muted-foreground/70" />
                    )}
                    <span className={`flex-1 ${checked ? 'line-through text-muted-foreground' : ''}`}>
                      {item.name}
                      {/* Отображение прогресса сканирования - используем status для оптимистичных обновлений */}
                      <span className={`ml-2 ${
                        (status.loaded_quantity || 0) >= item.quantity ? 'text-green-600 font-medium' :
                        (status.loaded_quantity || 0) > 0 ? 'text-amber-600' :
                        'text-muted-foreground'
                      }`}>
                        {`${status.loaded_quantity || 0} из ${item.quantity}`}
                      </span>
                      {item.is_required && <span className="text-red-500 ml-1">*</span>}
                      {(item as any).kit_name && <span className="text-xs text-purple-500 ml-2">📦 {(item as any).kit_name}</span>}
                      {item.qr_code && <span className="text-xs text-blue-500 ml-2">📱 {item.qr_code}</span>}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItemId(item.id || null);
                        setEditingQrCode(item.qr_code || '');
                      }}
                      title={item.qr_code ? 'Изменить QR-код' : 'Добавить QR-код'}
                    >
                      {item.qr_code ? (
                        <Edit className="w-3 h-3 text-muted-foreground/70" />
                      ) : (
                        <QrCode className="w-3 h-3 text-gray-300" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* QR Scanner */}
      <QRScanner
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScan={handleQRScan}
        title={scanMode === 'unload' ? 'Сканировать разгрузку' : 'Сканировать оборудование'}
        subtitle={scanMode === 'unload' ? `Разгрузка: ${progress} / ${total}` : `Погрузка: ${progress} / ${total} • Можно сканировать комплекты (KIT-*)`}
        keepOpen={true}
      />

      {/* Диалог редактирования QR-кода */}
      <Dialog open={!!editingItemId} onOpenChange={() => setEditingItemId(null)}>
        <DialogContent className="max-w-sm" aria-describedby="qr-edit-desc">
          <DialogHeader>
            <DialogTitle>QR-код оборудования</DialogTitle>
            <DialogDescription id="qr-edit-desc">
              {checklist.items?.find(i => i.id === editingItemId)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Введите QR-код (например: EQ-CB29XMDL)"
              value={editingQrCode}
              onChange={(e) => setEditingQrCode(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveQrCode} className="flex-1">Сохранить</Button>
              <Button variant="outline" onClick={() => setEditingItemId(null)}>Отмена</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
        .category { font-size: 14px; font-weight: bold; margin-top: 15px; margin-bottom: 8px; color: #2980b9; border-bottom: 2px solid #2980b9; padding-bottom: 4px; }
        .category.equipment { color: #27ae60; border-bottom-color: #27ae60; }
        .item { font-size: 13px; margin: 4px 0; padding: 6px 0; display: flex; align-items: center; border-bottom: 1px dotted #ccc; }
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


// Калькулятор для чек-листов
function CalculatorForm({ onClose }: { onClose: () => void }) {
  const [calculationType, setCalculationType] = useState<'truss' | 'dmx'>('truss');
  
  // Для ферм
  const [jointsCount, setJointsCount] = useState('');
  const [trussType, setTrussType] = useState<'square' | 'triangle' | 'flat'>('square');
  const [trussResult, setTrussResult] = useState<{connectors: number, pins: number, splints: number} | null>(null);
  
  // Для DMX
  const [trussLength, setTrussLength] = useState('');
  const [fixtureCount, setFixtureCount] = useState('');
  const [dmxResult, setDmxResult] = useState<{cablePerFixture: number, totalCables: number} | null>(null);

  const calculateTruss = () => {
    const joints = parseInt(jointsCount);
    if (joints > 0) {
      let connectors = 0, pins = 0, splints = 0;
      
      switch (trussType) {
        case 'square':
          connectors = joints * 4;
          pins = joints * 8;
          splints = joints * 8;
          break;
        case 'triangle':
          connectors = joints * 3;
          pins = joints * 6;
          splints = joints * 6;
          break;
        case 'flat':
          connectors = joints * 2;
          pins = joints * 4;
          splints = joints * 4;
          break;
      }
      
      setTrussResult({ connectors, pins, splints });
    }
  };

  const calculateDmx = () => {
    const length = parseFloat(trussLength);
    const fixtures = parseInt(fixtureCount);
    
    if (length > 0 && fixtures > 0) {
      // Расстояние между приборами
      const spacing = length / fixtures;
      
      // Кабель с запасом 30%, кратно 0.5м
      let cablePerFixture = spacing * 1.3;
      cablePerFixture = Math.ceil(cablePerFixture * 2) / 2; // Округление до 0.5
      
      // Общее количество кабелей: приборы - 1
      const totalCables = fixtures - 1;
      
      setDmxResult({ cablePerFixture, totalCables });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={calculationType === 'truss' ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => setCalculationType('truss')}
        >
          Фермы
        </Button>
        <Button
          type="button"
          variant={calculationType === 'dmx' ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => setCalculationType('dmx')}
        >
          DMX кабель
        </Button>
      </div>

      {calculationType === 'truss' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Тип фермы</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={trussType === 'square' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setTrussType('square')}
              >
                Квадратная
              </Button>
              <Button
                type="button"
                variant={trussType === 'triangle' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setTrussType('triangle')}
              >
                Треугольная
              </Button>
              <Button
                type="button"
                variant={trussType === 'flat' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setTrussType('flat')}
              >
                Плоская
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Количество стыков</Label>
            <Input
              type="number"
              value={jointsCount}
              onChange={(e) => setJointsCount(e.target.value)}
              placeholder="Например: 10"
            />
          </div>

          <Button onClick={calculateTruss} className="w-full">
            Рассчитать
          </Button>

          {trussResult !== null && (
            <div className="bg-primary/10 p-4 rounded-lg space-y-2">
              <p className="font-semibold text-foreground">Необходимо комплектующих:</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-card p-2 rounded">
                  <p className="text-xs text-muted-foreground">Коннекторы</p>
                  <p className="text-xl font-bold text-blue-600">{trussResult.connectors}</p>
                </div>
                <div className="bg-card p-2 rounded">
                  <p className="text-xs text-muted-foreground">Пальцы</p>
                  <p className="text-xl font-bold text-blue-600">{trussResult.pins}</p>
                </div>
                <div className="bg-card p-2 rounded">
                  <p className="text-xs text-muted-foreground">Шплинты</p>
                  <p className="text-xl font-bold text-blue-600">{trussResult.splints}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => copyToClipboard(`Коннекторы: ${trussResult.connectors}, Пальцы: ${trussResult.pins}, Шплинты: ${trussResult.splints}`)}
              >
                Копировать
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Длина фермы (м)</Label>
            <Input
              type="number"
              value={trussLength}
              onChange={(e) => setTrussLength(e.target.value)}
              placeholder="Например: 12"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Количество приборов</Label>
            <Input
              type="number"
              value={fixtureCount}
              onChange={(e) => setFixtureCount(e.target.value)}
              placeholder="Например: 8"
            />
          </div>

          <Button onClick={calculateDmx} className="w-full">
            Рассчитать
          </Button>

          {dmxResult !== null && (
            <div className="bg-green-500/10 p-4 rounded-lg space-y-2">
              <p className="font-semibold text-foreground">Результат:</p>
              <div className="space-y-1">
                <p className="text-sm">Кабель на прибор: <strong>{dmxResult.cablePerFixture} м</strong></p>
                <p className="text-sm">Всего кабелей DMX: <strong>{dmxResult.totalCables} шт</strong></p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => copyToClipboard(`Кабель DMX: ${dmxResult.cablePerFixture} м x ${dmxResult.totalCables} шт`)}
              >
                Копировать
              </Button>
            </div>
          )}
        </div>
      )}

      <Button variant="outline" onClick={onClose} className="w-full">
        Закрыть
      </Button>
    </div>
  );
}

export default ChecklistsManager;

