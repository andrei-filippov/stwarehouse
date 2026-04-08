import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { 
  Scan, 
  Info, 
  Package, 
  ClipboardCheck, 
  X, 
  Plus, 
  Minus, 
  User, 
  CheckCircle2,
  AlertCircle,
  Trash2,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { QRScanner } from './QRScanner';
import { QRCodeDialog } from './QRCodeDisplay';
import type { ChecklistV2, ChecklistItemV2, EquipmentKit } from '../types/checklist';
import type { CableInventory, CableCategory } from '../types';
import { supabase } from '../lib/supabase';
import { useUrlScanCode, clearUrlScanCode } from '../hooks/useUrlScanCode';

interface QuickQRScannerProps {
  companyId?: string;
  checklists?: ChecklistV2[];
  inventory?: CableInventory[];
  categories?: CableCategory[];
  kits?: EquipmentKit[];
  onRefresh?: () => void; // Callback для обновления данных после операций
}

type ScanMode = 'info' | 'issue' | 'checklist';
type ChecklistMode = 'load' | 'unload';

interface IssueItem {
  id: string;
  inventory_id: string;
  name: string;
  category_id: string;
  category_name: string;
  quantity: number;
  max_quantity: number;
  length?: number;
  qr_code?: string;
}

export function QuickQRScanner({ 
  companyId, 
  checklists = [],
  inventory = [],
  categories = [],
  kits = [],
  onRefresh
}: QuickQRScannerProps) {
  // Основное состояние
  const [isMainOpen, setIsMainOpen] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('info');
  
  // Состояние сканера
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerSubtitle, setScannerSubtitle] = useState<string>();
  
  // Состояние для режима информации
  const [scannedItem, setScannedItem] = useState<CableInventory | EquipmentKit | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  
  // Состояние для режима выдачи
  const [issueItems, setIssueItems] = useState<IssueItem[]>([]);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({
    issued_to: '',
    contact: ''
  });
  
  // Состояние для режима чеклиста
  const [selectedChecklist, setSelectedChecklist] = useState<ChecklistV2 | null>(null);
  const [checklistMode, setChecklistMode] = useState<ChecklistMode>('load');
  const [isChecklistDialogOpen, setIsChecklistDialogOpen] = useState(false);
  const [checklistProgress, setChecklistProgress] = useState({ loaded: 0, unloaded: 0, total: 0 });

  // Получаем активные чеклисты (не завершенные)
  const activeChecklists = useMemo(() => {
    return checklists.filter(c => {
      const totalQty = c.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) || 0;
      const unloadedQty = c.items?.reduce((sum, i) => {
        return sum + (i.unloaded_quantity || (i.unloaded ? (i.quantity || 1) : 0));
      }, 0) || 0;
      return totalQty === 0 || unloadedQty < totalQty; // Не показываем полностью разгруженные
    });
  }, [checklists]);

  // Загрузка инвентаря если не передан
  const [localInventory, setLocalInventory] = useState<CableInventory[]>(inventory);
  const [localKits, setLocalKits] = useState<EquipmentKit[]>(kits);
  
  const fetchInventory = useCallback(async () => {
    if (!companyId || inventory.length > 0) return;
    const { data } = await supabase
      .from('cable_inventory')
      .select('*')
      .eq('company_id', companyId);
    if (data) setLocalInventory(data);
  }, [companyId, inventory.length]);

  const fetchKits = useCallback(async () => {
    if (!companyId || kits.length > 0) return;
    const { data } = await supabase
      .from('equipment_kits')
      .select('*, items:kit_items(*)')
      .eq('company_id', companyId);
    if (data) setLocalKits(data);
  }, [companyId, kits.length]);

  // Объединенные данные
  const allInventory = inventory.length > 0 ? inventory : localInventory;
  const allKits = kits.length > 0 ? kits : localKits;
  
  // Читаем URL scan параметр
  const urlScanCode = useUrlScanCode();
  const processedUrlScan = useRef(false);

  // Обработка URL scan параметра
  useEffect(() => {
    if (urlScanCode && !processedUrlScan.current && allInventory.length > 0) {
      console.log('[QuickQRScanner] Processing URL scan code:', urlScanCode);
      processedUrlScan.current = true;
      
      // Открываем главный диалог
      setIsMainOpen(true);
      
      // Обрабатываем сканирование в режиме информации (по умолчанию)
      setTimeout(() => {
        handleInfoScan(urlScanCode);
        clearUrlScanCode();
      }, 300);
    }
  }, [urlScanCode, allInventory, handleInfoScan]);

  // Debug: выводим данные для проверки
  useEffect(() => {
    if (isMainOpen) {
      console.log('[QuickQRScanner] Inventory:', allInventory.length, 'items');
      console.log('[QuickQRScanner] Kits:', allKits.length, 'kits');
      console.log('[QuickQRScanner] Checklists:', checklists.length, 'checklists');
    }
  }, [isMainOpen, allInventory, allKits, checklists]);

  // Открытие главного диалога
  const openMainDialog = useCallback(() => {
    fetchInventory();
    fetchKits();
    setIsMainOpen(true);
  }, [fetchInventory, fetchKits]);

  // Обработка сканирования в режиме информации
  const handleInfoScan = useCallback((qrCode: string) => {
    // Ищем комплект
    const kit = allKits.find(k => k.qr_code === qrCode);
    if (kit) {
      setScannedItem(kit);
      setIsInfoDialogOpen(true);
      return;
    }
    
    // Ищем оборудование
    const item = allInventory.find(i => i.qr_code === qrCode);
    if (item) {
      setScannedItem(item);
      setIsInfoDialogOpen(true);
      return;
    }
    
    toast.error('QR-код не найден', { 
      description: `${qrCode} не найден в базе` 
    });
  }, [allInventory, allKits]);

  // Обработка сканирования в режиме выдачи
  const handleIssueScan = useCallback((qrCode: string) => {
    // Ищем оборудование
    const item = allInventory.find(i => i.qr_code === qrCode);
    if (!item) {
      toast.error('Оборудование не найдено', { 
        description: `${qrCode} не найден в базе` 
      });
      return;
    }
    
    // Проверяем не добавлено ли уже
    const alreadyAdded = issueItems.find(i => i.inventory_id === item.id);
    if (alreadyAdded) {
      toast.info('Уже в списке', { 
        description: `${item.name || 'Позиция'} уже добавлена` 
      });
      return;
    }
    
    const category = categories.find(c => c.id === item.category_id);
    
    setIssueItems(prev => [...prev, {
      id: `${Date.now()}_${item.id}`,
      inventory_id: item.id!,
      name: item.name || `${category?.name || 'Оборудование'} ${item.length}м`,
      category_id: item.category_id,
      category_name: category?.name || 'Без категории',
      quantity: 1,
      max_quantity: item.quantity,
      length: item.length,
      qr_code: item.qr_code
    }]);
    
    toast.success('Добавлено в выдачу', { 
      description: item.name || 'Позиция добавлена' 
    });
  }, [allInventory, categories, issueItems]);

  // Обработка сканирования в режиме чеклиста
  const handleChecklistScan = useCallback((qrCode: string) => {
    if (!selectedChecklist) {
      console.log('[QuickQRScanner] No selected checklist');
      return;
    }
    
    if (!selectedChecklist.items || selectedChecklist.items.length === 0) {
      console.log('[QuickQRScanner] Checklist has no items');
      toast.error('Чеклист пуст');
      return;
    }
    
    // Определяем, какие позиции еще не отмечены полностью (в зависимости от режима)
    const isItemPending = (item: ChecklistItemV2) => {
      const totalQty = item.quantity || 1;
      if (checklistMode === 'load') {
        const loadedQty = item.loaded_quantity || (item.loaded ? totalQty : 0);
        return loadedQty < totalQty;
      } else {
        const unloadedQty = item.unloaded_quantity || (item.unloaded ? totalQty : 0);
        return unloadedQty < totalQty;
      }
    };
    
    // Получаем текущее количество отсканированное
    const getCurrentQuantity = (item: ChecklistItemV2) => {
      const totalQty = item.quantity || 1;
      if (checklistMode === 'load') {
        return item.loaded_quantity || (item.loaded ? totalQty : 0);
      } else {
        return item.unloaded_quantity || (item.unloaded ? totalQty : 0);
      }
    };
    
    // Ищем комплект
    const kit = allKits.find(k => k.qr_code === qrCode);
    if (kit && kit.items) {
      let foundCount = 0;
      kit.items.forEach(kitItem => {
        // Ищем по inventory_id или по имени
        let checklistItem = selectedChecklist.items?.find(
          i => i.inventory_id && kitItem.inventory_id && 
               i.inventory_id === kitItem.inventory_id && isItemPending(i)
        );
        // Fallback: ищем по имени
        if (!checklistItem && kitItem.inventory_name) {
          checklistItem = selectedChecklist.items?.find(
            i => i.name === kitItem.inventory_name && isItemPending(i)
          );
        }
        if (checklistItem) {
          updateChecklistItem(checklistItem, kitItem.quantity);
          foundCount++;
        }
      });
      
      if (foundCount > 0) {
        toast.success(`Комлект «${kit.name}» отсканирован`, {
          description: `Отмечено ${foundCount} позиций`
        });
      } else {
        toast.info('Позиции комплекта не найдены в чеклисте или уже отмечены');
      }
      return;
    }
    
    // Ищем оборудование
    const inventoryItem = allInventory.find(i => i.qr_code === qrCode);
    console.log('[QuickQRScanner] Scanned QR:', qrCode);
    console.log('[QuickQRScanner] Found inventory:', inventoryItem);
    console.log('[QuickQRScanner] Checklist items count:', selectedChecklist.items?.length || 0);
    console.log('[QuickQRScanner] Checklist items:', selectedChecklist.items);
    
    if (!inventoryItem) {
      toast.error('QR-код не найден в базе оборудования');
      return;
    }
    
    // Сначала ищем в чеклисте по QR-коду (самый точный способ)
    let checklistItem = selectedChecklist.items?.find(
      i => i.qr_code === qrCode && isItemPending(i)
    );
    console.log('[QuickQRScanner] Found by QR code:', checklistItem);
    
    // Затем ищем по inventory_id
    if (!checklistItem) {
      checklistItem = selectedChecklist.items?.find(
        i => i.inventory_id && inventoryItem.id && 
             i.inventory_id === inventoryItem.id && isItemPending(i)
      );
      console.log('[QuickQRScanner] Found by inventory_id:', checklistItem);
    }
    
    // Если не нашли по inventory_id, ищем по имени (fallback)
    if (!checklistItem && inventoryItem.name) {
      console.log('[QuickQRScanner] Searching by name:', inventoryItem.name);
      checklistItem = selectedChecklist.items?.find(
        i => i.name?.toLowerCase() === inventoryItem.name?.toLowerCase() && isItemPending(i)
      );
      console.log('[QuickQRScanner] Found by name:', checklistItem);
    }
    
    if (!checklistItem) {
      toast.error('Не найдено в чеклисте', {
        description: `${inventoryItem.name || 'Позиция'} не в списке или уже отмечено`
      });
      return;
    }
    
    updateChecklistItem(checklistItem, 1);
    toast.success('Отмечено', { 
      description: checklistItem.name 
    });
  }, [selectedChecklist, allInventory, allKits]);

  // Обновление позиции чеклиста
  const updateChecklistItem = async (item: ChecklistItemV2, scanQty: number) => {
    if (!selectedChecklist) return;
    
    const now = new Date().toISOString();
    const user = (await supabase.auth.getUser()).data.user;
    const totalQty = item.quantity || 1;
    
    // Получаем текущее количество и добавляем отсканированное
    let currentQty = 0;
    if (checklistMode === 'load') {
      currentQty = item.loaded_quantity || (item.loaded ? totalQty : 0);
    } else {
      currentQty = item.unloaded_quantity || (item.unloaded ? totalQty : 0);
    }
    
    const newQty = Math.min(currentQty + scanQty, totalQty);
    const isComplete = newQty >= totalQty;
    
    const updates: any = {};
    
    if (checklistMode === 'load') {
      updates.loaded = isComplete;
      updates.loaded_at = isComplete ? now : (item.loaded_at || now);
      updates.loaded_by = user?.email || user?.id;
      updates.loaded_quantity = newQty;
    } else {
      updates.unloaded = isComplete;
      updates.unloaded_at = isComplete ? now : (item.unloaded_at || now);
      updates.unloaded_by = user?.email || user?.id;
      updates.unloaded_quantity = newQty;
    }
    
    // Обновляем локально (сравниваем по id элемента чеклиста)
    const updatedItems = selectedChecklist.items?.map(i => 
      i.id === item.id ? { ...i, ...updates } : i
    );
    
    setSelectedChecklist({ ...selectedChecklist, items: updatedItems });
    
    // Обновляем прогресс (считаем сумму quantity)
    const total = updatedItems?.reduce((sum, i) => sum + (i.quantity || 1), 0) || 0;
    const loaded = updatedItems?.reduce((sum, i) => {
      return sum + (i.loaded_quantity || (i.loaded ? (i.quantity || 1) : 0));
    }, 0) || 0;
    const unloaded = updatedItems?.reduce((sum, i) => {
      return sum + (i.unloaded_quantity || (i.unloaded ? (i.quantity || 1) : 0));
    }, 0) || 0;
    setChecklistProgress({ loaded, unloaded, total });
    
    // Сохраняем в БД (checklist_items нет company_id, проверяем через checklist_id)
    if (item.id && selectedChecklist?.id) {
      const { error } = await supabase
        .from('checklist_items')
        .update(updates)
        .eq('id', item.id)
        .eq('checklist_id', selectedChecklist.id);
      
      if (error) {
        console.error('Error updating checklist item:', error);
        toast.error('Ошибка сохранения', { description: error.message });
      }
    }
  };

  // Общий обработчик сканирования
  const handleScan = useCallback((qrCode: string) => {
    switch (scanMode) {
      case 'info':
        handleInfoScan(qrCode);
        break;
      case 'issue':
        handleIssueScan(qrCode);
        break;
      case 'checklist':
        handleChecklistScan(qrCode);
        break;
    }
  }, [scanMode, handleInfoScan, handleIssueScan, handleChecklistScan]);

  // Открытие сканера
  const openScanner = useCallback(() => {
    let subtitle: string | undefined;
    switch (scanMode) {
      case 'issue':
        subtitle = `В выдаче: ${issueItems.length} позиций. Сканируйте еще или завершите`;
        break;
      case 'checklist':
        if (selectedChecklist) {
          const mode = checklistMode === 'load' ? 'Погрузка' : 'Разгрузка';
          subtitle = `${mode}: ${selectedChecklist.event_name}`;
        }
        break;
    }
    setScannerSubtitle(subtitle);
    setIsScannerOpen(true);
  }, [scanMode, issueItems.length, selectedChecklist, checklistMode]);

  // Изменение количества в выдаче
  const updateIssueQuantity = (id: string, delta: number) => {
    setIssueItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, Math.min(item.quantity + delta, item.max_quantity));
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  // Удаление из выдачи
  const removeIssueItem = (id: string) => {
    setIssueItems(prev => prev.filter(i => i.id !== id));
  };

  // Отправка выдачи
  const submitIssue = async () => {
    if (!companyId || issueItems.length === 0) return;
    if (!issueForm.issued_to.trim()) {
      toast.error('Укажите, кому выдаётся оборудование');
      return;
    }

    const user = (await supabase.auth.getUser()).data.user;
    let hasError = false;

    for (const item of issueItems) {
      const { error } = await supabase
        .from('cable_movements')
        .insert({
          company_id: companyId,
          category_id: item.category_id,
          inventory_id: item.inventory_id,
          equipment_name: item.name,
          length: item.length || 0,
          quantity: item.quantity,
          issued_to: issueForm.issued_to,
          contact: issueForm.contact || undefined,
          issued_by: user?.id,
          type: 'issue'
        });

      if (error) {
        hasError = true;
        toast.error(`Ошибка при выдаче ${item.name}`, { description: error.message });
      }
    }

    if (!hasError) {
      toast.success('Оборудование выдано', { 
        description: `Выдано ${issueItems.length} позиций` 
      });
      setIssueItems([]);
      setIssueForm({ issued_to: '', contact: '' });
      setIsIssueDialogOpen(false);
      setIsMainOpen(false);
      onRefresh?.(); // Обновляем данные в родительском компоненте
    }
  };

  // Выбор чеклиста
  const selectChecklist = (checklist: ChecklistV2) => {
    setSelectedChecklist(checklist);
    // Считаем сумму quantity, а не количество позиций
    const totalQty = checklist.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) || 0;
    const loadedQty = checklist.items?.reduce((sum, i) => {
      return sum + (i.loaded_quantity || (i.loaded ? (i.quantity || 1) : 0));
    }, 0) || 0;
    const unloadedQty = checklist.items?.reduce((sum, i) => {
      return sum + (i.unloaded_quantity || (i.unloaded ? (i.quantity || 1) : 0));
    }, 0) || 0;
    setChecklistProgress({ loaded: loadedQty, unloaded: unloadedQty, total: totalQty });
    setIsChecklistDialogOpen(true);
  };

  return (
    <>
      {/* Кнопка быстрого доступа */}
      <Button 
        className="w-full justify-start"
        variant="outline"
        onClick={openMainDialog}
      >
        <Scan className="w-4 h-4 mr-2" />
        QR Сканер
      </Button>

      {/* Главный диалог выбора режима */}
      <Dialog open={isMainOpen} onOpenChange={setIsMainOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scan className="w-5 h-5" />
              QR Сканер
            </DialogTitle>
            <DialogDescription>
              Выберите режим работы
            </DialogDescription>
          </DialogHeader>

          <Tabs value={scanMode} onValueChange={(v) => setScanMode(v as ScanMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info" className="text-xs sm:text-sm">
                <Info className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Инфо</span>
                <span className="sm:hidden">Инфо</span>
              </TabsTrigger>
              <TabsTrigger value="issue" className="text-xs sm:text-sm">
                <Package className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Выдача</span>
                <span className="sm:hidden">Выд</span>
              </TabsTrigger>
              <TabsTrigger value="checklist" className="text-xs sm:text-sm">
                <ClipboardCheck className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Чеклист</span>
                <span className="sm:hidden">Чек</span>
              </TabsTrigger>
            </TabsList>

            {/* Режим Информация */}
            <TabsContent value="info" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Отсканируйте QR-код оборудования или комплекта для просмотра информации
              </p>
              <Button onClick={openScanner} className="w-full">
                <Scan className="w-4 h-4 mr-2" />
                Сканировать
              </Button>
            </TabsContent>

            {/* Режим Выдача */}
            <TabsContent value="issue" className="space-y-4">
              {issueItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Отсканируйте QR-коды оборудования для добавления в выдачу
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      В выдаче: {issueItems.length} позиций
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsIssueDialogOpen(true)}
                    >
                      Продолжить
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                    {issueItems.map(item => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-2 bg-muted rounded"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.category_name}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => updateIssueQuantity(item.id, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="text-sm w-6 text-center">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => updateIssueQuantity(item.id, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500"
                            onClick={() => removeIssueItem(item.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button onClick={openScanner} className="w-full">
                <Scan className="w-4 h-4 mr-2" />
                {issueItems.length === 0 ? 'Сканировать' : 'Добавить ещё'}
              </Button>
            </TabsContent>

            {/* Режим Чеклист */}
            <TabsContent value="checklist" className="space-y-4">
              {isChecklistDialogOpen && selectedChecklist ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedChecklist.event_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {checklistMode === 'load' ? 'Погрузка' : 'Разгрузка'}
                      </p>
                    </div>
                    <Badge variant={checklistMode === 'load' ? 'default' : 'secondary'}>
                      {checklistMode === 'load' 
                        ? `${checklistProgress.loaded}/${checklistProgress.total}` 
                        : `${checklistProgress.unloaded}/${checklistProgress.total}`
                      }
                    </Badge>
                  </div>
                  
                  {/* Прогресс бар */}
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ 
                        width: `${checklistMode === 'load' 
                          ? (checklistProgress.total ? (checklistProgress.loaded / checklistProgress.total) * 100 : 0)
                          : (checklistProgress.total ? (checklistProgress.unloaded / checklistProgress.total) * 100 : 0)
                        }%` 
                      }}
                    />
                  </div>
                  
                  {/* Список позиций (свернутый) */}
                  <Collapsible className="border rounded-lg">
                    <CollapsibleTrigger className="w-full p-3 flex items-center justify-between text-sm hover:bg-muted/50 transition-colors">
                      <span className="font-medium">Позиции для сканирования</span>
                      <span className="text-muted-foreground">
                        {selectedChecklist.items?.filter(i => {
                          if (checklistMode === 'load') {
                            return (i.loaded_quantity || 0) < (i.quantity || 1);
                          } else {
                            return (i.unloaded_quantity || 0) < (i.quantity || 1);
                          }
                        }).length} осталось
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="max-h-48 overflow-y-auto border-t">
                        {selectedChecklist.items?.map((item, idx) => {
                          const totalQty = item.quantity || 1;
                          const doneQty = checklistMode === 'load' 
                            ? (item.loaded_quantity || (item.loaded ? totalQty : 0))
                            : (item.unloaded_quantity || (item.unloaded ? totalQty : 0));
                          const isComplete = doneQty >= totalQty;
                          
                          return (
                            <div 
                              key={item.id || idx}
                              className={`flex items-center justify-between p-2 text-sm border-b last:border-b-0 ${
                                isComplete ? 'bg-green-500/10' : 'hover:bg-muted/30'
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={`w-2 h-2 rounded-full ${
                                  isComplete ? 'bg-green-500' : 'bg-amber-500'
                                }`} />
                                <span className={`truncate ${isComplete ? 'text-muted-foreground line-through' : ''}`}>
                                  {item.name}
                                </span>
                              </div>
                              <span className={`text-xs shrink-0 ${isComplete ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {doneQty}/{totalQty}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  <Button onClick={openScanner} className="w-full">
                    <Scan className="w-4 h-4 mr-2" />
                    Сканировать оборудование
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setIsChecklistDialogOpen(false);
                      setSelectedChecklist(null);
                    }}
                  >
                    Выбрать другой чеклист
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeChecklists.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Нет активных чеклистов</p>
                    </div>
                  ) : (
                    <>
                      <Select 
                        value={checklistMode} 
                        onValueChange={(v) => setChecklistMode(v as ChecklistMode)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите режим" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="load">Погрузка (выезд)</SelectItem>
                          <SelectItem value="unload">Разгрузка (возврат)</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {activeChecklists.map(checklist => {
                          const totalQty = checklist.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) || 0;
                          const loadedQty = checklist.items?.reduce((sum, i) => {
                            return sum + (i.loaded_quantity || (i.loaded ? (i.quantity || 1) : 0));
                          }, 0) || 0;
                          const unloadedQty = checklist.items?.reduce((sum, i) => {
                            return sum + (i.unloaded_quantity || (i.unloaded ? (i.quantity || 1) : 0));
                          }, 0) || 0;
                          
                          return (
                            <div
                              key={checklist.id}
                              className="p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors"
                              onClick={() => selectChecklist(checklist)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{checklist.event_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(checklist.event_date).toLocaleDateString('ru-RU')}
                                  </p>
                                </div>
                                <div className="flex gap-2 text-xs">
                                  <span className="text-blue-600">↗ {loadedQty}/{totalQty}</span>
                                  <span className="text-green-600">↙ {unloadedQty}/{totalQty}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Диалог сканера */}
      <QRScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
        title="Сканировать QR-код"
        subtitle={scannerSubtitle}
        keepOpen={scanMode !== 'info'}
      />

      {/* Диалог информации */}
      <Dialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <DialogContent className="max-w-sm w-[95%] rounded-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {'items' in (scannedItem || {}) ? 'Комплект' : 'Оборудование'}
            </DialogTitle>
          </DialogHeader>
          
          {scannedItem && (
            <div className="space-y-4">
              {'items' in scannedItem ? (
                // Комплект
                <>
                  <div className="text-center">
                    <p className="font-bold text-lg">{scannedItem.name}</p>
                    {scannedItem.qr_code && (
                      <p className="text-xs text-muted-foreground font-mono">{scannedItem.qr_code}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Содержимое:</p>
                    {scannedItem.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm p-2 bg-muted rounded">
                        <span>{item.inventory_name}</span>
                        <span className="text-muted-foreground">{item.quantity} шт</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                // Оборудование
                <>
                  <div className="text-center">
                    <p className="font-bold text-lg">{scannedItem.name || 'Оборудование'}</p>
                    <p className="text-xs text-muted-foreground">
                      {categories.find(c => c.id === scannedItem.category_id)?.name}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-muted rounded text-center">
                      <p className="text-muted-foreground">На складе</p>
                      <p className="font-bold">{scannedItem.quantity} шт</p>
                    </div>
                    {scannedItem.length && (
                      <div className="p-2 bg-muted rounded text-center">
                        <p className="text-muted-foreground">Длина</p>
                        <p className="font-bold">{scannedItem.length} м</p>
                      </div>
                    )}
                  </div>
                  {scannedItem.qr_code && (
                    <QRCodeDialog
                      isOpen={true}
                      onClose={() => {}}
                      value={scannedItem.qr_code}
                      equipmentName={scannedItem.name}
                    />
                  )}
                </>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setIsInfoDialogOpen(false)} className="w-full">
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог выдачи */}
      <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
        <DialogContent className="max-w-md w-[95%] rounded-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Выдача оборудования</DialogTitle>
            <DialogDescription>
              Укажите получателя и проверьте количество
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="issued_to">Кому выдаётся *</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="issued_to"
                  placeholder="ФИО или название"
                  value={issueForm.issued_to}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, issued_to: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact">Контакт (необязательно)</Label>
              <Input
                id="contact"
                placeholder="Телефон или email"
                value={issueForm.contact}
                onChange={(e) => setIssueForm(prev => ({ ...prev, contact: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Позиции ({issueItems.length})</Label>
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                {issueItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => updateIssueQuantity(item.id, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm w-6 text-center">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => updateIssueQuantity(item.id, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsIssueDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={submitIssue} disabled={!issueForm.issued_to.trim()}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Выдать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
