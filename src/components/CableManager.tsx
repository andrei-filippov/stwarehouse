import { useState, useMemo, memo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Pencil,
  Package,
  User,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Cable,
  GripVertical,
  CheckSquare,
  X,
  Boxes,
  Calendar,
  Search,
  Filter,
  TrendingUp,
  Wrench,
  ArrowRightLeft
} from 'lucide-react';
import type { CableCategory, CableInventory, CableMovement, EquipmentRepair } from '../types';
import type { EquipmentKit } from '../types/checklist';
import { REPAIR_STATUSES, getRepairStatusLabel, getRepairStatusColor } from '../types';
import { CABLE_COLORS } from '../types/cable';
import { Spinner } from './ui/spinner';
import { TransferToInventoryDialog } from './TransferToInventoryDialog';
import { QRCodeDialog, QRCodeBatchPrint, QRCodeDisplay } from './QRCodeDisplay';
import { QRScanner } from './QRScanner';
import { supabase } from '../lib/supabase';
import { useUrlScanCode, clearUrlScanCode } from '../hooks/useUrlScanCode';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { ru } from 'date-fns/locale';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { logger } from '../lib/logger';

interface SelectedItem {
  inventory_id: string;
  category_id: string;
  length: number;
  name?: string;
  available: number;
  quantity: number;
}

interface CableManagerProps {
  categories: CableCategory[];
  inventory: CableInventory[];
  movements: CableMovement[];
  repairs: EquipmentRepair[];
  stats: Record<string, { totalLength: number; totalQty: number; issuedQty: number; repairQty: number }>;
  loading?: boolean;
  onAddCategory: (data: Omit<CableCategory, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<{ error: any }>;
  onUpdateCategory: (id: string, updates: Partial<CableCategory>) => Promise<{ error: any }>;
  onDeleteCategory: (id: string) => Promise<{ error: any }>;
  onReorderCategories?: (categoryIds: string[]) => Promise<{ error: any }>;
  onImportFromEquipment?: () => Promise<{ error: any }>;
  onUpsertInventory: (data: Omit<CableInventory, 'id' | 'created_at' | 'updated_at'>) => Promise<{ error: any }>;
  onUpdateInventoryQty?: (id: string, quantity: number) => Promise<{ error: any }>;
  onDeleteInventory: (id: string) => Promise<{ error: any }>;
  onIssueCable: (data: {
    category_id: string;
    inventory_id: string;
    length?: number;
    equipment_name?: string;
    quantity: number;
    issued_to: string;
    contact?: string;
  }) => Promise<{ error: any }>;
  onReturnCable: (movementId: string) => Promise<{ error: any }>;
  onSendToRepair?: (repair: Partial<EquipmentRepair>) => Promise<{ error: any }>;
  onUpdateRepairStatus?: (repairId: string, status: EquipmentRepair['status'], returnedDate?: string) => Promise<{ error: any }>;
  onDeleteRepair?: (repairId: string) => Promise<{ error: any }>;
  onRefresh?: () => void; // Обновление данных после операций
  fabAction?: number;
  // Для переноса во вкладку "Оборудование"
  onTransferToEquipment?: (items: { 
    name: string; 
    description: string; 
    quantity: number; 
    category: string;
    price: number;
    unit: string;
  }[]) => Promise<{ error: any }>;
  targetEquipmentCategories?: { id: string; name: string }[];
  existingEquipment?: { name: string; category: string }[];
  // Комплекты для QR-сканирования
  kits?: EquipmentKit[];
}

export const CableManager = memo(function CableManager({
  categories,
  inventory,
  movements,
  repairs,
  stats,
  loading,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
  onImportFromEquipment,
  onUpsertInventory,
  onUpdateInventoryQty,
  onDeleteInventory,
  onIssueCable,
  onReturnCable,
  onSendToRepair,
  onUpdateRepairStatus,
  onDeleteRepair,
  onRefresh,
  fabAction,
  onTransferToEquipment,
  targetEquipmentCategories,
  existingEquipment,
  kits = [],
}: CableManagerProps) {
  const [activeTab, setActiveTab] = useState('warehouse');
  
  // Загружаем профили выдавших для отображения
  const [issuerProfiles, setIssuerProfiles] = useState<Record<string, { email?: string; name?: string }>>({});
  
  useEffect(() => {
    const loadIssuerProfiles = async () => {
      const issuerIds = [...new Set(movements.map(m => m.issued_by).filter(Boolean))] as string[];
      if (issuerIds.length === 0) return;
      
      const unknownIds = issuerIds.filter(id => !issuerProfiles[id]);
      if (unknownIds.length === 0) return;
      
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, email, name')
          .in('id', unknownIds);
        
        if (data) {
          setIssuerProfiles(prev => {
            const next = { ...prev };
            data.forEach((p: any) => {
              next[p.id] = { email: p.email, name: p.name };
            });
            return next;
          });
        }
      } catch {
        // ignore
      }
    };
    
    loadIssuerProfiles();
  }, [movements]);
  
  const formatIssuer = (issuedByName?: string, issuedBy?: string) => {
    if (issuedByName) return issuedByName;
    if (!issuedBy) return null;
    const profile = issuerProfiles[issuedBy];
    return profile?.name || profile?.email || issuedBy.slice(0, 8);
  };

  // Подвкладки склада: оборудование (с name) vs коммутация (без name)
  const [warehouseSubTab, setWarehouseSubTab] = useState<'equipment' | 'cabling'>('equipment');
  
  // Фильтрация инвентаря
  const equipmentItems = useMemo(() => 
    inventory.filter(item => item.name && item.name.trim()), 
    [inventory]
  );
  const cablingItems = useMemo(() => 
    inventory.filter(item => !item.name || !item.name.trim()), 
    [inventory]
  );
  
  // Режим выбора оборудования для переноса во вкладку "Оборудование"
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<Set<string>>(new Set());
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  
  // Выбранные позиции для массовой выдачи
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [isBulkIssueDialogOpen, setIsBulkIssueDialogOpen] = useState(false);
  const [bulkIssueForm, setBulkIssueForm] = useState({
    issued_to: '',
    contact: '',
    items: [] as SelectedItem[],
  });
  
  // Открываем добавление при нажатии FAB (пропускаем первый рендер)
  const isFirstRender = useRef(false);
  useEffect(() => {
    if (!isFirstRender.current) {
      isFirstRender.current = true;
      return;
    }
    if (fabAction && fabAction > 0) {
      if (activeTab === 'warehouse') {
        setEditingCategory(null);
        setCategoryForm({ name: '', description: '', color: '#3b82f6', type: 'other' });
        setIsCategoryDialogOpen(true);
      }
    }
  }, [fabAction]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Состояние для поиска
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isInventoryDialogOpen, setIsInventoryDialogOpen] = useState(false);
  
  const [editingCategory, setEditingCategory] = useState<CableCategory | null>(null);
  const [editingInventory, setEditingInventory] = useState<CableInventory | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', color: '#3b82f6', parent_id: '' as string | undefined, type: 'other' as 'sound' | 'light' | 'other' });
  const [inventoryForm, setInventoryForm] = useState({ category_id: '', name: '', length: '', quantity: '', min_quantity: '0', watts: '', notes: '' });
  
  // Repair dialog states
  const [isRepairDialogOpen, setIsRepairDialogOpen] = useState(false);
  const [repairForm, setRepairForm] = useState({
    category_id: '',
    inventory_id: '',
    equipment_name: '',
    length: 0,
    quantity: 1,
    reason: '',
    notes: '',
  });

  // Import/Export states
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // QR Code states
  const [selectedQRItem, setSelectedQRItem] = useState<CableInventory | null>(null);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [scannedQRItem, setScannedQRItem] = useState<CableInventory | null>(null);
  const [isQRActionDialogOpen, setIsQRActionDialogOpen] = useState(false);
  const [qrScanMode, setQrScanMode] = useState<'single' | 'batch'>('single'); // batch = режим выдачи

  // Фильтры для истории
  const [historyFilters, setHistoryFilters] = useState({
    dateFrom: '',
    dateTo: '',
    categoryId: 'all',
    status: 'all',
    search: '',
  });

  // Читаем URL scan параметр
  const urlScanCode = useUrlScanCode();
  const processedUrlScan = useRef(false);
  const [pendingScanCode, setPendingScanCode] = useState<string | null>(null);

  // Обработка URL scan параметра - только сохраняем код
  useEffect(() => {
    if (urlScanCode && !processedUrlScan.current && inventory.length > 0) {
      logger.debug('[CableManager] Received URL scan code:', urlScanCode);
      processedUrlScan.current = true;
      setPendingScanCode(urlScanCode);
    }
  }, [urlScanCode, inventory]);

  // Обработка pending scan кода (вызовется после определения handleQRScan)
  useEffect(() => {
    if (pendingScanCode) {
      logger.debug('[CableManager] Processing pending scan code:', pendingScanCode);
      setTimeout(() => {
        handleQRScan(pendingScanCode);
        clearUrlScanCode();
        setPendingScanCode(null);
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScanCode]);

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Функции для выбора оборудования
  const selectInventory = (id: string, selected: boolean) => {
    setSelectedInventoryIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const selectAllInCategory = (categoryId: string, selected: boolean) => {
    const items = inventory.filter(i => i.category_id === categoryId && i.name); // только оборудование с названием
    setSelectedInventoryIds(prev => {
      const newSet = new Set(prev);
      items.forEach(item => {
        if (selected) {
          newSet.add(item.id);
        } else {
          newSet.delete(item.id);
        }
      });
      return newSet;
    });
  };

  const openTransferDialog = () => {
    if (selectedInventoryIds.size === 0) {
      toast.error('Выберите оборудование для переноса');
      return;
    }
    setIsTransferDialogOpen(true);
  };

  // Получаем выбранное оборудование для переноса
  const selectedInventory = useMemo(() => 
    inventory.filter(item => selectedInventoryIds.has(item.id)),
    [inventory, selectedInventoryIds]
  );

  const handleAddCategory = async () => {
    const { error } = await onAddCategory({
      ...categoryForm,
      parent_id: categoryForm.parent_id || undefined,
      sort_order: categories.length,
    });
    if (!error) {
      setIsCategoryDialogOpen(false);
      setCategoryForm({ name: '', description: '', color: '#3b82f6', parent_id: undefined, type: 'other' });
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    const { error } = await onUpdateCategory(editingCategory.id, {
      ...categoryForm,
      parent_id: categoryForm.parent_id || undefined,
    });
    if (!error) {
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', color: '#3b82f6', parent_id: undefined, type: 'other' });
    }
  };

  // Генерация уникального QR-кода
  const generateQRCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'EQ-';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Проверяем уникальность
    const existing = inventory.find(item => item.qr_code === result);
    if (existing) {
      return generateQRCode(); // Рекурсивно генерируем новый
    }
    return result;
  };

  const handleAddInventory = async () => {
    const minQty = parseInt(inventoryForm.min_quantity);
    const watts = parseInt(inventoryForm.watts);
    const { error } = await onUpsertInventory({
      category_id: inventoryForm.category_id,
      name: inventoryForm.name || undefined,
      length: inventoryForm.length ? parseFloat(inventoryForm.length) : undefined,
      quantity: parseInt(inventoryForm.quantity),
      min_quantity: isNaN(minQty) ? 0 : minQty,
      watts: inventoryForm.watts ? (isNaN(watts) ? undefined : watts) : undefined,
      notes: inventoryForm.notes || undefined,
      qr_code: generateQRCode(),
    });
    if (!error) {
      setIsInventoryDialogOpen(false);
      setInventoryForm({ category_id: '', name: '', length: '', quantity: '', min_quantity: '0', watts: '', notes: '' });
    }
  };

  // Редактирование позиции инвентаря
  const openInventoryEdit = (item: CableInventory, categoryName: string) => {
    setEditingInventory(item);
    setSelectedCategoryId(item.category_id);
    setInventoryForm({
      category_id: item.category_id,
      name: item.name || '',
      length: item.length?.toString() || '',
      quantity: item.quantity.toString(),
      min_quantity: item.min_quantity?.toString() || '0',
      watts: item.watts?.toString() || '',
      notes: item.notes || '',
    });
    setIsInventoryDialogOpen(true);
  };

  const handleEditInventory = async () => {
    if (!editingInventory) return;
    
    const minQty = parseInt(inventoryForm.min_quantity);
    const watts = parseInt(inventoryForm.watts);
    const { error } = await onUpsertInventory({
      id: editingInventory.id,
      category_id: inventoryForm.category_id,
      name: inventoryForm.name || undefined,
      length: inventoryForm.length ? parseFloat(inventoryForm.length) : undefined,
      quantity: parseInt(inventoryForm.quantity),
      min_quantity: isNaN(minQty) ? 0 : minQty,
      watts: inventoryForm.watts ? (isNaN(watts) ? undefined : watts) : undefined,
      notes: inventoryForm.notes || undefined,
    });
    if (!error) {
      setIsInventoryDialogOpen(false);
      setEditingInventory(null);
      setInventoryForm({ category_id: '', name: '', length: '', quantity: '', min_quantity: '0', watts: '', notes: '' });
    }
  };

  // Обработка сканирования QR-кода (оборудование или комплект)
  const handleQRScan = (qrCode: string) => {
    // 1. Проверяем - это QR код комплекта?
    const kit = kits.find(k => k.qr_code === qrCode);
    if (kit) {
      // Это комплект - добавляем все его позиции в выдачу
      if (qrScanMode === 'batch') {
        handleKitScanForIssue(kit);
      } else {
        // В обычном режиме показываем диалог с информацией о комплекте
        handleKitScanForInfo(kit);
      }
      return;
    }

    // 2. Ищем как обычное оборудование
    const item = inventory.find(i => i.qr_code === qrCode);
    if (!item) {
      toast.error('Оборудование не найдено', { description: `QR-код ${qrCode} не найден в базе` });
      return;
    }
    
    // В режиме batch (выдача) - сразу добавляем в выдачу без диалога
    if (qrScanMode === 'batch') {
      const alreadySelected = selectedItems.find(si => si.inventory_id === item.id);
      if (alreadySelected) {
        toast.info('Уже в выдаче', { description: `${item.name} - ${alreadySelected.quantity} шт.` });
      } else {
        // Напрямую обновляем selectedItems
        setSelectedItems(prev => [...prev, {
          inventory_id: item.id!,
          category_id: item.category_id,
          length: item.length || 0,
          name: item.name,
          available: item.quantity,
          quantity: 1,
        }]);
        toast.success('Добавлено в выдачу', { 
          description: `${item.name} - 1 шт.` 
        });
      }
      // Не закрываем сканер - можно сканировать следующую позицию
      return;
    }
    
    // Обычный режим - показываем диалог действий
    setScannedQRItem(item);
    setIsQRActionDialogOpen(true);
  };

  // Сканирование комплекта для выдачи (batch mode)
  const handleKitScanForIssue = (kit: EquipmentKit) => {
    if (!kit.items || kit.items.length === 0) {
      toast.error('Комплект пуст', { description: `${kit.name} не содержит оборудования` });
      return;
    }

    let addedCount = 0;
    let skippedCount = 0;

    kit.items.forEach(kitItem => {
      // Находим инвентарь по inventory_id
      const inventoryItem = inventory.find(i => i.id === kitItem.inventory_id);
      if (!inventoryItem) {
        skippedCount++;
        return;
      }

      // Проверяем не добавлен ли уже
      const alreadySelected = selectedItems.find(si => si.inventory_id === inventoryItem.id);
      if (alreadySelected) {
        skippedCount++;
        return;
      }

      // Добавляем с учетом quantity из комплекта
      const qty = kitItem.quantity || 1;
      setSelectedItems(prev => [...prev, {
        inventory_id: inventoryItem.id!,
        category_id: inventoryItem.category_id,
        length: inventoryItem.length || 0,
        name: inventoryItem.name,
        available: inventoryItem.quantity,
        quantity: Math.min(qty, inventoryItem.quantity), // Не больше чем есть на складе
      }]);
      addedCount++;
    });

    if (addedCount > 0) {
      toast.success(`Комплект «${kit.name}» добавлен`, { 
        description: `Добавлено ${addedCount} позиций` 
      });
    }
    if (skippedCount > 0) {
      toast.info('Некоторые позиции пропущены', { 
        description: `${skippedCount} уже в выдаче или не найдены` 
      });
    }
  };

  // Сканирование комплекта для информации (single mode)
  const handleKitScanForInfo = (kit: EquipmentKit) => {
    const itemsCount = kit.items?.length || 0;
    toast.info(`Комплект: ${kit.name}`, { 
      description: `Содержит ${itemsCount} позиций. Переключитесь в режим выдачи чтобы добавить.` 
    });
  };

  // Показать QR-код для позиции
  const handleShowQRCode = (item: CableInventory) => {
    setSelectedQRItem(item);
    setIsQRDialogOpen(true);
  };

  // Действия с отсканированным оборудованием
  const handleQRAction = (action: 'info' | 'issue' | 'return') => {
    if (!scannedQRItem) return;
    
    switch (action) {
      case 'info':
        handleShowQRCode(scannedQRItem);
        break;
      case 'issue':
        // Добавляем в выдачу напрямую
        setSelectedItems(prev => [...prev, {
          inventory_id: scannedQRItem.id!,
          category_id: scannedQRItem.category_id,
          length: scannedQRItem.length || 0,
          name: scannedQRItem.name,
          available: scannedQRItem.quantity,
          quantity: 1,
        }]);
        toast.success('Добавлено в выдачу', { description: scannedQRItem.name || 'Позиция' });
        break;
      case 'return':
        // Переходим на вкладку "Выдано"
        setActiveTab('issued');
        toast.info('Найдите позицию в списке выданных для возврата');
        break;
    }
    setIsQRActionDialogOpen(false);
    setScannedQRItem(null);
  };

  // Обновление количества напрямую
  const handleUpdateInventoryQty = async (id: string, newQty: number, length: number) => {
    if (newQty < 0) return;
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    // Если доступна функция обновления по ID - используем её (быстрее и надежнее)
    if (onUpdateInventoryQty) {
      const { error } = await onUpdateInventoryQty(id, newQty);
      if (error) {
        toast.error('Ошибка при обновлении', { description: error.message });
      }
      return;
    }
    
    // Fallback: используем upsert (может создать дубликат если есть несколько записей с одной длиной)
    const { error } = await onUpsertInventory({
      category_id: item.category_id,
      length: length,
      quantity: newQty,
      min_quantity: item.min_quantity,
      notes: item.notes,
    });
    
    if (error) {
      toast.error('Ошибка при обновлении', { description: error.message });
    }
  };

  // Обработка выбора позиции
  const toggleItemSelection = (item: CableInventory) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.inventory_id === item.id);
      if (exists) {
        return prev.filter(i => i.inventory_id !== item.id);
      }
      return [...prev, {
        inventory_id: item.id!,
        category_id: item.category_id,
        length: item.length,
        name: item.name,
        available: item.quantity,
        quantity: 1, // По умолчанию 1
      }];
    });
  };

  // Открытие диалога массовой выдачи
  const openBulkIssueDialog = () => {
    setBulkIssueForm({
      issued_to: '',
      contact: '',
      items: [...selectedItems],
    });
    setIsBulkIssueDialogOpen(true);
  };

  // Обработка массовой выдачи
  const handleBulkIssue = async () => {
    if (!bulkIssueForm.issued_to.trim()) {
      toast.error('Укажите, кому выдаётся оборудование');
      return;
    }

    let hasError = false;
    
    for (const item of bulkIssueForm.items) {
      if (item.quantity <= 0 || item.quantity > item.available) {
        toast.error(`Некорректное количество для позиции`);
        hasError = true;
        break;
      }
      
      const { error } = await onIssueCable({
        category_id: item.category_id,
        inventory_id: item.inventory_id,
        length: item.length,
        equipment_name: item.name,
        quantity: item.quantity,
        issued_to: bulkIssueForm.issued_to,
        contact: bulkIssueForm.contact || undefined,
      });
      
      if (error) {
        hasError = true;
        break;
      }
    }
    
    if (!hasError) {
      setIsBulkIssueDialogOpen(false);
      setSelectedItems([]);
      toast.success('Успешно выдано');
      // Обновляем данные в реальном времени
      onRefresh?.();
    }
  };

  // Обновление количества в форме массовой выдачи
  const updateBulkItemQuantity = (inventoryId: string, quantity: number) => {
    setBulkIssueForm(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.inventory_id === inventoryId 
          ? { ...item, quantity: Math.max(1, Math.min(quantity, item.available)) }
          : item
      ),
    }));
  };

  // Открыть диалог отправки в ремонт
  const openRepairDialog = (categoryId: string, item: CableInventory, categoryName: string) => {
    setRepairForm({
      category_id: categoryId,
      inventory_id: item.id!,
      equipment_name: item.name || `${categoryName} ${item.length}м`,
      length: item.length || 0,
      quantity: 1,
      reason: '',
      notes: '',
    });
    setIsRepairDialogOpen(true);
  };

  // Отправить в ремонт
  const handleSendToRepair = async () => {
    if (!repairForm.reason.trim()) {
      toast.error('Укажите причину поломки');
      return;
    }
    if (!onSendToRepair) {
      toast.error('Функция отправки в ремонт не доступна');
      return;
    }

    const { error } = await onSendToRepair(repairForm);
    if (!error) {
      setIsRepairDialogOpen(false);
      setRepairForm({
        category_id: '',
        inventory_id: '',
        equipment_name: '',
        length: 0,
        quantity: 1,
        reason: '',
        notes: '',
      });
    }
  };

  const openCategoryEdit = (cat: CableCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      type: cat.type || 'other',
      description: cat.description || '',
      color: cat.color?.toLowerCase() || '#3b82f6',
      parent_id: cat.parent_id || undefined,
    });
    setIsCategoryDialogOpen(true);
  };

  const openInventoryAdd = (categoryId: string) => {
    setEditingInventory(null);
    setInventoryForm({ category_id: categoryId, name: '', length: '', quantity: '', min_quantity: '0', notes: '' });
    setIsInventoryDialogOpen(true);
  };

  // Экспорт в Excel
  const exportToExcel = () => {
    const data = inventory.map(item => {
      const category = categories.find(c => c.id === item.category_id);
      return {
        'Категория': category?.name || '',
        'Название': item.name || '',
        'Длина (м)': item.length || '',
        'Количество': item.quantity,
        'Мин. остаток': item.min_quantity || 0,
        'Мощность (Вт)': item.watts || '',
        'Комментарий': item.notes || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Оборудование');
    XLSX.writeFile(wb, `оборудование_склад_${format(new Date(), 'dd.MM.yyyy')}.xlsx`);
  };

  // Обработка загрузки файла
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        setImportData(jsonData);
        setImportPreview(true);
      } catch (err) {
        toast.error('Ошибка чтения файла');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Импорт данных
  const handleImport = async () => {
    if (importData.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    for (const row of importData) {
      // Получаем или создаем категорию
      const categoryName = row['Категория'] || row['category'] || 'Общее';
      let categoryId = categories.find(c => c.name === categoryName)?.id;
      
      if (!categoryId) {
        // Создаем новую категорию
        const { data, error } = await onAddCategory({
          name: categoryName,
          color: '#3b82f6',
          sort_order: categories.length,
        });
        if (error) {
          errorCount++;
          continue;
        }
        categoryId = data?.id;
      }

      if (!categoryId) {
        errorCount++;
        continue;
      }

      const { error } = await onUpsertInventory({
        category_id: categoryId,
        name: row['Название'] || row['name'] || undefined,
        length: row['Длина (м)'] || row['length'] ? parseFloat(row['Длина (м)'] || row['length']) : undefined,
        quantity: parseInt(row['Количество'] || row['quantity']) || 0,
        min_quantity: parseInt(row['Мин. остаток'] || row['min_quantity']) || 0,
        watts: row['Мощность (Вт)'] || row['watts'] ? parseInt(row['Мощность (Вт)'] || row['watts']) : undefined,
        notes: row['Комментарий'] || row['notes'] || undefined,
      });

      if (error) {
        errorCount++;
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Импортировано ${successCount} позиций`);
    }
    if (errorCount > 0) {
      toast.error(`Ошибка импорта ${errorCount} позиций`);
    }

    setIsImportDialogOpen(false);
    setImportPreview(false);
    setImportData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Построение дерева категорий
  const categoryTree = useMemo(() => {
    const map = new Map<string, CableCategory & { children: CableCategory[]; level: number }>();
    const roots: (CableCategory & { children: CableCategory[]; level: number })[] = [];
    
    // Сначала создаем все узлы
    categories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [], level: 0 });
    });
    
    // Затем строим иерархию
    categories.forEach(cat => {
      const node = map.get(cat.id)!;
      if (cat.parent_id && map.has(cat.parent_id)) {
        const parent = map.get(cat.parent_id)!;
        node.level = parent.level + 1;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });
    
    return roots;
  }, [categories]);

  // Фильтруем категории для подвкладок: показываем категории с нужным типом оборудования 
  // ИЛИ категории, созданные недавно (последние 24 часа) - чтобы видеть новые пустые категории
  const filteredCategoryTree = useMemo(() => {
    const isRecentlyCreated = (cat: CableCategory) => {
      if (!cat.created_at) return false;
      const created = new Date(cat.created_at);
      const now = new Date();
      const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      return hoursDiff < 24; // Показываем категории, созданные менее 24 часов назад
    };

    const hasMatchingItems = (catId: string): boolean => {
      // Проверяем, есть ли в категории оборудование нужного типа
      const items = warehouseSubTab === 'equipment' ? equipmentItems : cablingItems;
      return items.some(item => item.category_id === catId);
    };

    const processCategory = (cat: CableCategory & { children: CableCategory[] }): (CableCategory & { children: CableCategory[] }) | null => {
      // Фильтруем дочерние категории
      const filteredChildren = cat.children
        .map(child => processCategory(child as CableCategory & { children: CableCategory[] }))
        .filter(Boolean) as (CableCategory & { children: CableCategory[] })[];

      // Проверяем, нужно ли показывать эту категорию
      const shouldShow = isRecentlyCreated(cat) || hasMatchingItems(cat.id) || filteredChildren.length > 0;
      
      if (!shouldShow) return null;

      return {
        ...cat,
        children: filteredChildren
      };
    };

    return categoryTree
      .map(cat => processCategory(cat))
      .filter(Boolean) as (CableCategory & { children: CableCategory[] })[];
  }, [categoryTree, warehouseSubTab, equipmentItems, cablingItems]);

  // Фильтрация инвентаря по поисковому запросу
  const filteredInventory = useMemo(() => {
    // Сначала фильтруем по подвкладке (оборудование vs коммутация)
    const baseItems = warehouseSubTab === 'equipment' 
      ? equipmentItems 
      : cablingItems;
    
    // Затем применяем поиск если есть
    if (!searchQuery.trim()) return baseItems;
    
    const query = searchQuery.toLowerCase().trim();
    return baseItems.filter(item => {
      const nameMatch = item.name?.toLowerCase().includes(query);
      const notesMatch = item.notes?.toLowerCase().includes(query);
      const categoryMatch = categories.find(c => c.id === item.category_id)?.name.toLowerCase().includes(query);
      return nameMatch || notesMatch || categoryMatch;
    });
  }, [inventory, searchQuery, categories, warehouseSubTab, equipmentItems, cablingItems]);

  // Получение плоского списка для селекта (с отступами)
  const flatCategoriesForSelect = useMemo(() => {
    const result: { id: string; name: string; level: number }[] = [];
    
    const traverse = (cats: CableCategory[], level: number) => {
      cats.forEach(cat => {
        result.push({ id: cat.id, name: cat.name, level });
        if (cat.children && cat.children.length > 0) {
          traverse(cat.children, level + 1);
        }
      });
    };
    
    traverse(categoryTree, 0);
    return result;
  }, [categoryTree]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Заголовок */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Cable className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
            <span className="hidden sm:inline">Учет оборудования</span>
            <span className="sm:hidden">Оборудование</span>
          </h1>
        
        {/* Группировка кнопок по смыслу */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Группа 1: Управление */}
          <div className="flex items-center gap-1">
            <Button 
              onClick={() => {
                setEditingCategory(null);
                setCategoryForm({ name: '', description: '', color: '#3b82f6', type: 'other' });
                setIsCategoryDialogOpen(true);
              }}
              size="sm"
              className="h-8 sm:h-9"
            >
              <Plus className="w-4 h-4 mr-0 sm:mr-1.5" />
              <span className="hidden sm:inline text-sm">Категория</span>
            </Button>
            
            {/* Кнопка выбора для переноса в оборудование */}
            {onTransferToEquipment && targetEquipmentCategories && (
              selectionMode ? (
                <>
                  <Button 
                    variant="default"
                    size="sm"
                    onClick={openTransferDialog}
                    disabled={selectedInventoryIds.size === 0}
                    className="h-8 sm:h-9"
                  >
                    <Package className="w-4 h-4 mr-0 sm:mr-1.5" />
                    <span className="hidden sm:inline text-sm">В оборудование</span>
                    {selectedInventoryIds.size > 0 && (
                      <span className="ml-1.5 bg-background/20 px-1.5 py-0.5 rounded text-xs">
                        {selectedInventoryIds.size}
                      </span>
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setSelectionMode(false);
                      setSelectedInventoryIds(new Set());
                    }}
                    className="h-8 sm:h-9 px-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectionMode(true)}
                  className="h-8 sm:h-9"
                >
                  <CheckSquare className="w-4 h-4 mr-0 sm:mr-1.5" />
                  <span className="hidden sm:inline text-sm">Выбрать</span>
                </Button>
              )
            )}
          </div>
          
          {/* Разделитель */}
          <div className="w-px h-6 bg-gray-300 mx-1 hidden sm:block" />
          
          {/* Группа 2: Сканирование и выдача */}
          <div className="flex items-center gap-1">
            {/* Кнопка сканирования с выпадающим меню */}
            <div className="relative flex items-center">
              <Button 
                variant={qrScanMode === 'batch' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsQRScannerOpen(true)}
                className={`h-8 sm:h-9 ${qrScanMode === 'batch' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                title={qrScanMode === 'batch' ? 'Режим выдачи активен' : 'Сканировать QR-код'}
              >
                <svg className="w-4 h-4 mr-0 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <span className="hidden sm:inline text-sm">
                  {qrScanMode === 'batch' ? `Выдача (${selectedItems.length})` : 'Сканировать'}
                </span>
                {qrScanMode === 'batch' && selectedItems.length > 0 && (
                  <span className="ml-1.5 bg-background/20 px-1.5 py-0.5 rounded text-xs">
                    {selectedItems.length}
                  </span>
                )}
              </Button>
              
              {/* Переключатель режима */}
              <Button
                variant={qrScanMode === 'batch' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  if (qrScanMode === 'single') {
                    setQrScanMode('batch');
                    toast.info('Режим выдачи включен', { 
                      description: `Сканируйте QR — оборудование и комплекты (${kits.length}) сразу добавятся в выдачу`
                    });
                  } else {
                    setQrScanMode('single');
                    toast.info('Обычный режим QR');
                  }
                }}
                className={`h-8 sm:h-9 px-2 ml-0.5 ${qrScanMode === 'batch' ? 'bg-green-700 hover:bg-green-800 border-green-700' : ''}`}
                title={qrScanMode === 'batch' ? 'Выключить режим выдачи' : 'Включить режим выдачи'}
              >
                {qrScanMode === 'batch' ? <X className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          
          {/* Разделитель */}
          <div className="w-px h-6 bg-gray-300 mx-1 hidden sm:block" />
          
          {/* Группа 3: Импорт/Экспорт */}
          <div className="flex items-center gap-1">
            <Button 
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              title="Экспорт в Excel"
              className="h-8 sm:h-9 px-2 sm:px-3"
            >
              <svg className="w-4 h-4 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline text-sm">Excel</span>
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setIsImportDialogOpen(true)}
            title="Импорт из Excel"
          >
            <svg className="w-4 h-4 mr-0 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">Импорт</span>
          </Button>
          </div>
        </div>
      </div>
        
      {/* Подсказка о возможностях */}
      <p className="text-xs text-muted-foreground hidden sm:block">
        QR-сканер поддерживает оборудование (EQ-*) и комплекты (KIT-*). 
        <span className="text-blue-600 cursor-pointer hover:underline ml-1" onClick={() => setIsQRScannerOpen(true)}>Открыть сканер</span>
      </p>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full h-9 sm:h-10 flex overflow-x-auto scrollbar-hide">
          <TabsTrigger value="warehouse" className="text-xs sm:text-sm flex-shrink-0">Склад</TabsTrigger>
          <TabsTrigger value="issued" className="text-xs sm:text-sm flex-shrink-0">
            Выдано
            {movements.filter(m => m.is_returned !== true).length > 0 && (
              <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">{movements.filter(m => m.is_returned !== true).length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="repair" className="text-xs sm:text-sm flex-shrink-0">
            Ремонт
            {repairs.filter(r => r.status === 'in_repair').length > 0 && (
              <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">{repairs.filter(r => r.status === 'in_repair').length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm flex-shrink-0">
            История
            <Badge variant="outline" className="ml-1 sm:ml-2 text-xs">{repairs.length + movements.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Вкладка Склад */}
        <TabsContent value="warehouse" className="space-y-4">
          {/* Подвкладки: Оборудование vs Коммутация */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setWarehouseSubTab('equipment')}
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                warehouseSubTab === 'equipment' 
                  ? 'bg-background text-blue-600 shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Оборудование
              <span className="ml-1.5 text-xs opacity-70">({equipmentItems.length})</span>
            </button>
            <button
              onClick={() => setWarehouseSubTab('cabling')}
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                warehouseSubTab === 'cabling' 
                  ? 'bg-background text-blue-600 shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Коммутация
              <span className="ml-1.5 text-xs opacity-70">({cablingItems.length})</span>
            </button>
          </div>

          {/* Поиск */}
          {categories.length > 0 && (
            <div className="relative">
              <input
                type="text"
                placeholder={warehouseSubTab === 'equipment' ? "Поиск оборудования..." : "Поиск кабелей..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <svg className="absolute left-3 top-2.5 w-5 h-5 text-muted-foreground/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-muted-foreground/70 hover:text-muted-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
          
          {categories.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Нет категорий</p>
                <p className="text-sm mb-4">Добавьте первую категорию кабелей</p>
                {onImportFromEquipment && (
                  <Button 
                    variant="outline" 
                    onClick={onImportFromEquipment}
                    className="mt-2"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Импортировать из Оборудования
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <CategoryList 
              categories={filteredCategoryTree}
              inventory={filteredInventory}
              movements={movements}
              repairs={repairs}
              stats={stats}
              selectedItems={selectedItems}
              expandedCategories={expandedCategories}
              onToggleCategory={toggleCategory}
              onToggleItem={toggleItemSelection}
              onUpdateInventoryQty={handleUpdateInventoryQty}
              onDeleteInventory={onDeleteInventory}
              onAddInventory={openInventoryAdd}
              onEditInventory={openInventoryEdit}
              onEditCategory={openCategoryEdit}
              onDeleteCategory={onDeleteCategory}
              onSendToRepair={openRepairDialog}
              onShowQRCode={handleShowQRCode}
              onReorderCategories={onReorderCategories}
              selectionMode={selectionMode}
              selectedInventoryIds={selectedInventoryIds}
              onSelectInventory={selectInventory}
              onSelectAllInCategory={selectAllInCategory}
            />
          )}
          
          {/* Плавающая панель выдачи */}
          {(selectedItems.length > 0 || qrScanMode === 'batch') && (
            <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-md">
              <Card className={`shadow-lg border-0 ${selectedItems.length > 0 ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}`}>
                <CardContent className="p-2.5 sm:p-3">
                  {selectedItems.length > 0 ? (
                    /* Режим с выбранными позициями */
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs sm:text-sm font-medium truncate">
                            К выдаче: {selectedItems.length} позиций
                          </span>
                          <span className="text-[10px] sm:text-xs opacity-80 truncate">
                            {selectedItems.slice(0, 2).map(i => i.name).join(', ')}
                            {selectedItems.length > 2 && ` +${selectedItems.length - 2}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={openBulkIssueDialog}
                          className="h-7 sm:h-8 text-xs sm:text-sm font-medium"
                        >
                          Выдать
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-white hover:text-white/80 hover:bg-background/20 h-7 sm:h-8 text-xs px-2"
                          onClick={() => setSelectedItems([])}
                          title="Очистить выбор"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Режим ожидания сканирования */
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 bg-background rounded-full animate-pulse shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs sm:text-sm font-medium truncate">
                            Режим выдачи активен
                          </span>
                          <span className="text-[10px] sm:text-xs opacity-90 truncate">
                            Сканируйте QR оборудования или комплекты ({kits.length})
                          </span>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-white hover:text-white/80 hover:bg-background/20 h-7 sm:h-8 text-xs px-2 shrink-0"
                        onClick={() => {
                          setQrScanMode('single');
                          toast.info('Режим выдачи выключен');
                        }}
                      >
                        <X className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">Выйти</span>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Вкладка Выдано */}
        <TabsContent value="issued" className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <User className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Выданная коммутация</span>
                <span className="sm:hidden">Выдано</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movements.filter(m => m.is_returned !== true).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Всё на складе</p>
                  <p className="text-sm">Нет выданных позиций</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {movements.filter(m => m.is_returned !== true).map(movement => {
                    const category = categories.find(c => c.id === movement.category_id);
                    return (
                      <div 
                        key={movement.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 bg-muted/50 rounded-lg gap-2"
                      >
                        <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                          <Checkbox
                            checked={false}
                            onCheckedChange={async () => {
                              const { error } = await onReturnCable(movement.id);
                              if (!error) {
                                onRefresh?.();
                              }
                            }}
                            className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 sm:mt-0 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm sm:text-base">
                              <div 
                                className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0"
                                style={{ backgroundColor: category?.color || '#ccc' }}
                              />
                              <span className="font-medium">{category?.name || 'Неизвестно'}</span>
                              {movement.equipment_name ? (
                                <span className="text-muted-foreground text-sm">{movement.equipment_name}</span>
                              ) : (
                                <span className="text-muted-foreground text-sm">{movement.length} м</span>
                              )}
                              <span className="text-muted-foreground text-sm">× {movement.quantity} шт</span>
                            </div>
                            <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                              <User className="w-3 h-3 inline mr-1" />
                              {movement.issued_to}
                              {movement.contact && (
                                <span className="hidden sm:inline"> • {movement.contact}</span>
                              )}
                            </div>
                            {movement.contact && (
                              <div className="text-xs text-muted-foreground/70 sm:hidden">
                                {movement.contact}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground/70">
                              {format(new Date(movement.created_at || ''), 'dd.MM.yyyy HH:mm', { locale: ru })}
                              {(movement.issued_by_name || movement.issued_by) && (
                                <span className="ml-2">Выдал: {formatIssuer(movement.issued_by_name, movement.issued_by)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка История */}
        <TabsContent value="history" className="space-y-3 sm:space-y-4">
          {/* Статистика */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Всего выдач</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold mt-1">{movements.length}</div>
                <div className="text-xs text-muted-foreground">
                  {movements.filter(m => !m.is_returned).length} активных
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Возвращено</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold mt-1">
                  {movements.filter(m => m.is_returned).length}
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.round((movements.filter(m => m.is_returned).length / Math.max(movements.length, 1)) * 100)}% возвратов
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs text-muted-foreground">В ремонте</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold mt-1">
                  {repairs.filter(r => r.status === 'in_repair').length}
                </div>
                <div className="text-xs text-muted-foreground">
                  {repairs.filter(r => r.status !== 'in_repair').length} завершено
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Всего операций</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold mt-1">{movements.length + repairs.length}</div>
                <div className="text-xs text-muted-foreground">
                  за все время
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                📜 История операций
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Фильтры */}
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Filter className="w-4 h-4" />
                  Фильтры
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {/* Поиск */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Поиск по названию..."
                      value={historyFilters.search}
                      onChange={(e) => setHistoryFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                  {/* Категория */}
                  <select
                    value={historyFilters.categoryId}
                    onChange={(e) => setHistoryFilters(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="h-9 px-2 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="all">Все категории</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  {/* Статус */}
                  <select
                    value={historyFilters.status}
                    onChange={(e) => setHistoryFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="h-9 px-2 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="all">Все статусы</option>
                    <option value="active">Активные (не возвращено)</option>
                    <option value="returned">Возвращено</option>
                    <option value="in_repair">В ремонте</option>
                    <option value="written_off">Списано</option>
                  </select>
                  {/* Сброс фильтров */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryFilters({ dateFrom: '', dateTo: '', categoryId: 'all', status: 'all', search: '' })}
                    className="h-9"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Сбросить
                  </Button>
                </div>
                {/* Даты */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">С:</span>
                    <Input
                      type="date"
                      value={historyFilters.dateFrom}
                      onChange={(e) => setHistoryFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="h-8 w-32 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">По:</span>
                    <Input
                      type="date"
                      value={historyFilters.dateTo}
                      onChange={(e) => setHistoryFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="h-8 w-32 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* История ремонтов */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  🔧 История ремонтов
                  {(() => {
                    const filteredRepairs = repairs.filter(r => {
                      const matchesSearch = !historyFilters.search || r.equipment_name.toLowerCase().includes(historyFilters.search.toLowerCase());
                      const matchesCategory = historyFilters.categoryId === 'all' || r.category_id === historyFilters.categoryId;
                      const matchesStatus = historyFilters.status === 'all' || 
                        (historyFilters.status === 'in_repair' && r.status === 'in_repair') ||
                        (historyFilters.status === 'written_off' && r.status === 'written_off') ||
                        (historyFilters.status === 'returned' && r.status === 'returned');
                      const date = new Date(r.sent_date);
                      const matchesDateFrom = !historyFilters.dateFrom || date >= new Date(historyFilters.dateFrom);
                      const matchesDateTo = !historyFilters.dateTo || date <= new Date(historyFilters.dateTo + 'T23:59:59');
                      return matchesSearch && matchesCategory && matchesStatus && matchesDateFrom && matchesDateTo;
                    });
                    return <Badge variant="outline" className="text-xs">{filteredRepairs.length}</Badge>;
                  })()}
                </h4>
                {(() => {
                  const filteredRepairs = repairs.filter(r => {
                    const matchesSearch = !historyFilters.search || r.equipment_name.toLowerCase().includes(historyFilters.search.toLowerCase());
                    const matchesCategory = historyFilters.categoryId === 'all' || r.category_id === historyFilters.categoryId;
                    const matchesStatus = historyFilters.status === 'all' || 
                      (historyFilters.status === 'in_repair' && r.status === 'in_repair') ||
                      (historyFilters.status === 'written_off' && r.status === 'written_off') ||
                      (historyFilters.status === 'returned' && r.status === 'returned');
                    const date = new Date(r.sent_date);
                    const matchesDateFrom = !historyFilters.dateFrom || date >= new Date(historyFilters.dateFrom);
                    const matchesDateTo = !historyFilters.dateTo || date <= new Date(historyFilters.dateTo + 'T23:59:59');
                    return matchesSearch && matchesCategory && matchesStatus && matchesDateFrom && matchesDateTo;
                  });
                  
                  if (filteredRepairs.length === 0) {
                    return (
                      <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg">
                        Нет записей о ремонтах
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-2">
                      {filteredRepairs
                        .sort((a, b) => new Date(b.sent_date).getTime() - new Date(a.sent_date).getTime())
                        .map(repair => {
                          const category = categories.find(c => c.id === repair.category_id);
                          const isReturned = repair.status === 'returned';
                          const isWrittenOff = repair.status === 'written_off';
                          return (
                            <div 
                              key={repair.id}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 rounded-lg border gap-2 ${
                                isReturned ? 'bg-green-500/10 border-green-500/30' :
                                isWrittenOff ? 'bg-gray-500/10 border-gray-500/30' :
                                'bg-yellow-500/10 border-yellow-500/30'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm">
                                  <div 
                                    className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: category?.color || '#ccc' }}
                                  />
                                  <span className="font-medium">{repair.equipment_name}</span>
                                  <span className="text-muted-foreground">× {repair.quantity} шт</span>
                                  <Badge className={`${getRepairStatusColor(repair.status)} text-xs`}>
                                    {getRepairStatusLabel(repair.status)}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  <span className="font-medium">Причина:</span> {repair.reason}
                                </div>
                                {repair.notes && (
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium">Примечание:</span> {repair.notes}
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground/70 mt-1">
                                  <span>Отправлено: {format(new Date(repair.sent_date), 'dd.MM.yyyy')}</span>
                                  {repair.returned_date && (
                                    <span className={isReturned ? 'text-green-600 font-medium' : ''}>
                                      {isWrittenOff ? 'Списано' : 'Возвращено'}: {format(new Date(repair.returned_date), 'dd.MM.yyyy')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })()}
              </div>

              <div className="border-t pt-4">
                {/* История выдач */}
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  📦 История выдач
                  {(() => {
                    const filteredMovements = movements.filter(m => {
                      if (!m.created_at) return false;
                      const matchesSearch = !historyFilters.search || (m.equipment_name || '').toLowerCase().includes(historyFilters.search.toLowerCase());
                      const matchesCategory = historyFilters.categoryId === 'all' || m.category_id === historyFilters.categoryId;
                      const matchesStatus = historyFilters.status === 'all' || 
                        (historyFilters.status === 'active' && !m.is_returned) ||
                        (historyFilters.status === 'returned' && m.is_returned);
                      const date = new Date(m.created_at);
                      const matchesDateFrom = !historyFilters.dateFrom || date >= new Date(historyFilters.dateFrom);
                      const matchesDateTo = !historyFilters.dateTo || date <= new Date(historyFilters.dateTo + 'T23:59:59');
                      return matchesSearch && matchesCategory && matchesStatus && matchesDateFrom && matchesDateTo;
                    });
                    return <Badge variant="outline" className="text-xs">{filteredMovements.length}</Badge>;
                  })()}
                </h4>
                {(() => {
                  const filteredMovements = movements.filter(m => {
                    if (!m.created_at) return false;
                    const matchesSearch = !historyFilters.search || (m.equipment_name || '').toLowerCase().includes(historyFilters.search.toLowerCase());
                    const matchesCategory = historyFilters.categoryId === 'all' || m.category_id === historyFilters.categoryId;
                    const matchesStatus = historyFilters.status === 'all' || 
                      (historyFilters.status === 'active' && !m.is_returned) ||
                      (historyFilters.status === 'returned' && m.is_returned);
                    const date = new Date(m.created_at);
                    const matchesDateFrom = !historyFilters.dateFrom || date >= new Date(historyFilters.dateFrom);
                    const matchesDateTo = !historyFilters.dateTo || date <= new Date(historyFilters.dateTo + 'T23:59:59');
                    return matchesSearch && matchesCategory && matchesStatus && matchesDateFrom && matchesDateTo;
                  });
                  
                  if (filteredMovements.length === 0) {
                    return (
                      <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg">
                        Нет записей о выдачах
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-2">
                      {filteredMovements
                        .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
                        .map(movement => {
                          const item = equipmentItems.find(i => i.id === movement.inventory_id) || 
                                     inventory.find(i => i.id === movement.inventory_id);
                          const category = categories.find(c => c.id === (item?.category_id || movement.category_id));
                          const isReturned = movement.is_returned === true;
                          return (
                            <div 
                              key={movement.id}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 rounded-lg border gap-2 ${
                                isReturned ? 'bg-green-500/10 border-green-500/30' : 'bg-blue-500/10 border-blue-500/30'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm">
                                  <div 
                                    className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: category?.color || '#ccc' }}
                                  />
                                  <span className="font-medium">{movement.equipment_name || item?.name || 'Неизвестно'}</span>
                                  <span className="text-muted-foreground">× {movement.quantity} шт</span>
                                  <Badge className={`text-xs ${isReturned ? 'bg-green-500/20 text-green-700' : 'bg-blue-500/20 text-blue-700'}`}>
                                    {isReturned ? '✓ Возвращено' : '→ Выдано'}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  <span className="font-medium">Кому:</span> {movement.issued_to || '—'}
                                  {movement.contact && (
                                    <span className="ml-3"><span className="font-medium">Контакт:</span> {movement.contact}</span>
                                  )}
                                </div>
                                {(movement.issued_by_name || movement.issued_by) && (
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium">Выдал:</span> {formatIssuer(movement.issued_by_name, movement.issued_by)}
                                  </div>
                                )}
                                {movement.notes && (
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium">Примечание:</span> {movement.notes}
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground/70 mt-1">
                                  <span>Дата: {format(new Date(movement.created_at!), 'dd.MM.yyyy HH:mm')}</span>
                                  {movement.returned_at && (
                                    <span className="text-green-600 font-medium">
                                      Возвращено: {format(new Date(movement.returned_at), 'dd.MM.yyyy')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка В ремонте */}
        <TabsContent value="repair" className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                🔧 <span className="hidden sm:inline">Оборудование в ремонте</span>
                <span className="sm:hidden">В ремонте</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {repairs.filter(r => r.status === 'in_repair').length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm sm:text-base">Всё исправно</p>
                  <p className="text-xs sm:text-sm">Нет оборудования в ремонте</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {repairs.filter(r => r.status === 'in_repair').map(repair => {
                    const category = categories.find(c => c.id === repair.category_id);
                    return (
                      <div 
                        key={repair.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30 gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm sm:text-base">
                            <div 
                              className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0"
                              style={{ backgroundColor: category?.color || '#ccc' }}
                            />
                            <span className="font-medium">{repair.equipment_name}</span>
                            <span className="text-muted-foreground text-sm">× {repair.quantity} шт</span>
                            <Badge className={`${getRepairStatusColor(repair.status)} text-xs`}>
                              {getRepairStatusLabel(repair.status)}
                            </Badge>
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                            <span className="font-medium">Причина:</span> {repair.reason}
                          </div>
                          {repair.notes && (
                            <div className="text-xs sm:text-sm text-muted-foreground">
                              <span className="font-medium">Примечание:</span> {repair.notes}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground/70 mt-1">
                            Отправлено: {format(new Date(repair.sent_date), 'dd.MM.yyyy')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 shrink-0 pt-1 sm:pt-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onUpdateRepairStatus?.(repair.id, 'returned', new Date().toISOString())}
                            className="h-7 sm:h-8 px-2 text-xs sm:text-sm"
                          >
                            <span className="hidden sm:inline">📦 Вернуть на склад</span>
                            <span className="sm:hidden">📦 Вернуть</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onUpdateRepairStatus?.(repair.id, 'written_off')}
                            className="h-7 sm:h-8 px-2 text-xs sm:text-sm text-red-600"
                          >
                            <span className="hidden sm:inline">🗑️ Списать</span>
                            <span className="sm:hidden">🗑️</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDeleteRepair?.(repair.id)}
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>

      {/* Диалог отправки в ремонт */}
      <Dialog open={isRepairDialogOpen} onOpenChange={setIsRepairDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6" aria-describedby="repair-dialog-desc">
          <DialogHeader>
            <DialogTitle>Отправить в ремонт</DialogTitle>
            <DialogDescription id="repair-dialog-desc">
              {repairForm.equipment_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Количество</label>
              <Input
                type="number"
                min={1}
                value={repairForm.quantity}
                onChange={(e) => setRepairForm({ ...repairForm, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Причина поломки *</label>
              <Input
                value={repairForm.reason}
                onChange={(e) => setRepairForm({ ...repairForm, reason: e.target.value })}
                placeholder="Например: Обрыв кабеля, неисправный разъем"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Примечание</label>
              <Input
                value={repairForm.notes}
                onChange={(e) => setRepairForm({ ...repairForm, notes: e.target.value })}
                placeholder="Дополнительная информация"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsRepairDialogOpen(false)}>
                Отмена
              </Button>
              <Button 
                onClick={handleSendToRepair}
                disabled={!repairForm.reason.trim()}
              >
                Отправить в ремонт
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог категории */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6" aria-describedby="category-dialog-desc">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Редактировать категорию' : 'Новая категория'}
            </DialogTitle>
            <DialogDescription id="category-dialog-desc">
              {editingCategory ? 'Измените данные категории' : 'Добавьте категорию кабелей'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Название *</label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Например: PowerCon Link"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Описание</label>
              <Input
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Опциональное описание"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Цвет</label>
              <div className="flex gap-2 flex-wrap mt-2 items-center">
                {CABLE_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategoryForm({ ...categoryForm, color: c.value })}
                    className={`w-8 h-8 rounded-full border-2 ${
                      categoryForm.color?.toLowerCase() === c.value.toLowerCase() ? 'border-gray-900 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
                <div className="flex items-center gap-2 ml-2">
                  <input
                    type="color"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                    title="Произвольный цвет"
                  />
                  <span className="text-xs text-muted-foreground">{categoryForm.color}</span>
                </div>
              </div>
            </div>
            
            {/* Выбор родительской категории */}
            <div>
              <label className="text-sm font-medium">Родительская категория</label>
              <select
                value={categoryForm.parent_id || ''}
                onChange={(e) => setCategoryForm({ ...categoryForm, parent_id: e.target.value || undefined })}
                className="w-full border border-border rounded-md p-2 mt-1 bg-card text-foreground"
              >
                <option value="">— Корневая категория —</option>
                {flatCategoriesForSelect
                  .filter(cat => !editingCategory || cat.id !== editingCategory.id) // Нельзя выбрать себя
                  .map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {'  '.repeat(cat.level)}{cat.level > 0 ? '└ ' : ''}{cat.name}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Оставьте пустым для создания корневой категории
              </p>
            </div>
            
            {/* Выбор типа категории */}
            <div>
              <label className="text-sm font-medium">Тип оборудования</label>
              <select
                value={categoryForm.type || 'other'}
                onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value as 'sound' | 'light' | 'other' })}
                className="w-full border border-border rounded-md p-2 mt-1 bg-card text-foreground"
              >
                <option value="sound">🔊 Звуковое оборудование</option>
                <option value="light">💡 Световое оборудование</option>
                <option value="other">🔌 Прочее оборудование</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Тип используется для расчёта общей мощности в чек-листах
              </p>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                Отмена
              </Button>
              <Button 
                onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
                disabled={!categoryForm.name.trim()}
              >
                {editingCategory ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог добавления/редактирования позиции */}
      <Dialog open={isInventoryDialogOpen} onOpenChange={setIsInventoryDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6" aria-describedby="inventory-dialog-desc">
          <DialogHeader>
            <DialogTitle>{editingInventory ? 'Редактировать позицию' : 'Добавить позицию'}</DialogTitle>
            <DialogDescription id="inventory-dialog-desc">
              {editingInventory ? 'Измените данные позиции' : 'Укажите название (для оборудования) или длину (для кабелей) и количество'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Название позиции</label>
              <Input
                value={inventoryForm.name}
                onChange={(e) => setInventoryForm({ ...inventoryForm, name: e.target.value })}
                placeholder="Например: Микрофон Shure SM58 (для оборудования)"
              />
              <p className="text-xs text-muted-foreground mt-1">Для кабелей оставьте пустым, укажите только длину</p>
            </div>
            <div>
              <label className="text-sm font-medium">Длина (м)</label>
              <Input
                type="number"
                step="0.5"
                value={inventoryForm.length}
                onChange={(e) => setInventoryForm({ ...inventoryForm, length: e.target.value })}
                placeholder="Например: 1.5 (для кабелей)"
              />
              <p className="text-xs text-muted-foreground mt-1">Для оборудования без длины оставьте пустым</p>
            </div>
            <div>
              <label className="text-sm font-medium">Количество *</label>
              <Input
                type="number"
                value={inventoryForm.quantity}
                onChange={(e) => setInventoryForm({ ...inventoryForm, quantity: e.target.value })}
                placeholder="Сколько штук"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Минимальный остаток</label>
              <Input
                type="number"
                value={inventoryForm.min_quantity}
                onChange={(e) => setInventoryForm({ ...inventoryForm, min_quantity: e.target.value })}
                placeholder="При каком количестве предупреждать"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Мощность (Вт)</label>
              <Input
                type="number"
                value={inventoryForm.watts}
                onChange={(e) => setInventoryForm({ ...inventoryForm, watts: e.target.value })}
                placeholder="Например: 1500 (для расчёта нагрузки)"
              />
              <p className="text-xs text-muted-foreground mt-1">Укажите мощность для расчёта общей нагрузки</p>
            </div>
            <div>
              <label className="text-sm font-medium">Комментарий</label>
              <Input
                value={inventoryForm.notes}
                onChange={(e) => setInventoryForm({ ...inventoryForm, notes: e.target.value })}
                placeholder="Например: в коробке по 10 шт, IP65"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsInventoryDialogOpen(false)}>
                Отмена
              </Button>
              <Button 
                onClick={editingInventory ? handleEditInventory : handleAddInventory}
                disabled={editingInventory 
                  ? (!inventoryForm.name && !inventoryForm.length)
                  : ((!inventoryForm.name && !inventoryForm.length) || !inventoryForm.quantity)
                }
              >
                {editingInventory ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* ������ �������� ������ */}
      <Dialog open={isBulkIssueDialogOpen} onOpenChange={setIsBulkIssueDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto" aria-describedby="bulk-issue-dialog-desc">
          <DialogHeader>
            <DialogTitle>Выдать оборудование</DialogTitle>
            <DialogDescription id="bulk-issue-dialog-desc">
              Выбрано позиций: {bulkIssueForm.items.length}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Кому выдаётся *</label>
              <Input
                value={bulkIssueForm.issued_to}
                onChange={(e) => setBulkIssueForm({ ...bulkIssueForm, issued_to: e.target.value })}
                placeholder="ФИО или название организации"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Контакт</label>
              <Input
                value={bulkIssueForm.contact}
                onChange={(e) => setBulkIssueForm({ ...bulkIssueForm, contact: e.target.value })}
                placeholder="Телефон для связи"
              />
            </div>
            
            {/* Список выбранных позиций с редактированием количества */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Позиции:</label>
              {bulkIssueForm.items.map((item) => {
                const category = categories.find(c => c.id === item.category_id);
                return (
                  <div key={item.inventory_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <div 
                        className="w-3 h-3 rounded-full mt-1 shrink-0" 
                        style={{ backgroundColor: category?.color || '#ccc' }} 
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{item.name || 'Без названия'}</span>
                        <span className="text-xs text-muted-foreground">
                          {category?.name} {item.length > 0 && `• ${item.length} м`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => updateBulkItemQuantity(item.inventory_id, item.quantity - 1)}
                      >
                        -
                      </Button>
                      <span className="text-sm w-6 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => updateBulkItemQuantity(item.inventory_id, item.quantity + 1)}
                      >
                        +
                      </Button>
                      <span className="text-xs text-muted-foreground/70 ml-1 w-6 text-right">/ {item.available}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsBulkIssueDialogOpen(false)}>
                Отмена
              </Button>
              <Button 
                onClick={handleBulkIssue}
                disabled={!bulkIssueForm.issued_to.trim()}
              >
                Выдать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог импорта из Excel */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-3xl w-[95%] max-h-[90vh] overflow-y-auto rounded-xl p-4 sm:p-6" aria-describedby="import-dialog-desc">
          <DialogHeader>
            <DialogTitle>Импорт из Excel</DialogTitle>
            <DialogDescription id="import-dialog-desc">
              Загрузите Excel файл с колонками: Категория, Название, Длина (м), Количество, Мин. остаток, Мощность (Вт), Комментарий
            </DialogDescription>
          </DialogHeader>
          
          {!importPreview ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground/70" />
                <p className="text-sm text-muted-foreground mb-4">
                  Перетащите файл Excel или нажмите для выбора
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  className="block w-full text-sm text-muted-foreground
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary/10 file:text-blue-700
                    hover:file:bg-blue-100"
                />
              </div>
              <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
                <p className="font-medium mb-2">Формат файла:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Категория - название категории (создастся автоматически если нет)</li>
                  <li>Название - название оборудования (для кабелей можно оставить пустым)</li>
                  <li>Длина (м) - для кабелей, для оборудования оставьте пустым</li>
                  <li>Количество - количество на складе</li>
                  <li>Мин. остаток - при каком количестве предупреждать</li>
                  <li>Мощность (Вт) - для расчёта нагрузки (опционально)</li>
                  <li>Комментарий - дополнительная информация</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm">Найдено записей: <strong>{importData.length}</strong></p>
              
              <div className="overflow-auto border rounded-lg max-h-[40vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Категория</th>
                      <th className="px-3 py-2 text-left">Название</th>
                      <th className="px-3 py-2 text-right">Длина</th>
                      <th className="px-3 py-2 text-right">Кол-во</th>
                      <th className="px-3 py-2 text-right">Мин.</th>
                      <th className="px-3 py-2 text-right">Вт</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {importData.slice(0, 10).map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{row['Категория'] || row['category'] || '-'}</td>
                        <td className="px-3 py-2">{row['Название'] || row['name'] || '-'}</td>
                        <td className="px-3 py-2 text-right">{row['Длина (м)'] || row['length'] || '-'}</td>
                        <td className="px-3 py-2 text-right">{row['Количество'] || row['quantity'] || '0'}</td>
                        <td className="px-3 py-2 text-right">{row['Мин. остаток'] || row['min_quantity'] || '0'}</td>
                        <td className="px-3 py-2 text-right">{row['Мощность (Вт)'] || row['watts'] || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importData.length > 10 && (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    ... и ещё {importData.length - 10} записей
                  </p>
                )}
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setImportPreview(false);
                  setImportData([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}>
                  Отмена
                </Button>
                <Button onClick={handleImport}>
                  Импортировать {importData.length} позиций
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог переноса во вкладку "Оборудование" */}
      {onTransferToEquipment && targetEquipmentCategories && (
        <TransferToInventoryDialog
          open={isTransferDialogOpen}
          onOpenChange={(open) => {
            setIsTransferDialogOpen(open);
            if (!open) {
              setSelectedInventoryIds(new Set());
              setSelectionMode(false);
            }
          }}
          equipment={selectedInventory.map(item => {
            const cableCategory = categories.find(c => c.id === item.category_id);
            return {
              id: item.id,
              name: item.name || '',
              category: cableCategory?.name || 'Общее',
              description: item.notes || '',
              quantity: item.quantity,
              price: item.price || 0,
              unit: item.unit || 'шт',
              user_id: '',
              created_at: item.created_at || '',
              updated_at: item.updated_at || ''
            };
          })}
          targetCategories={targetEquipmentCategories}
          existingInventory={existingEquipment?.map(e => ({ name: e.name, category_id: e.category })) || []}
          onTransfer={async (items) => {
            const result = await onTransferToEquipment(items);
            if (!result.error) {
              setSelectedInventoryIds(new Set());
              setSelectionMode(false);
            }
            return result;
          }}
        />
      )}

      {/* QR Scanner */}
      <QRScanner
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScan={handleQRScan}
        title="Сканировать оборудование"
        subtitle={qrScanMode === 'batch' 
          ? `Режим выдачи: ${selectedItems.length} позиций • Можно сканировать комплекты (${kits.length})` 
          : `Можно сканировать QR оборудования (EQ-*) или комплектов (KIT-*)`
        }
        keepOpen={qrScanMode === 'batch'}
      />

      {/* Диалог с QR-кодом оборудования */}
      <QRCodeDialog
        isOpen={isQRDialogOpen}
        onClose={() => {
          setIsQRDialogOpen(false);
          setSelectedQRItem(null);
        }}
        value={selectedQRItem?.qr_code ?? ''}
        equipmentName={selectedQRItem?.name ?? ''}
        isScanUrl={true}
      />

      {/* Диалог действий после сканирования QR */}
      <Dialog open={isQRActionDialogOpen} onOpenChange={setIsQRActionDialogOpen}>
        <DialogContent className="max-w-sm w-[95%] rounded-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Отсканировано оборудование</DialogTitle>
            <DialogDescription>
              {scannedQRItem?.name || 'Позиция'} ({scannedQRItem?.qr_code})
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-4">
            <Button onClick={() => handleQRAction('info')} variant="outline">
              ℹ️ Информация и QR-код
            </Button>
            <Button onClick={() => handleQRAction('issue')}>
              📦 Добавить в выдачу
            </Button>
            <Button onClick={() => handleQRAction('return')} variant="secondary">
              ↩️ Вернуть на склад
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

// Компонент для сортируемой категории (drag-and-drop)
interface SortableCategoryItemProps {
  category: CableCategory & { children?: CableCategory[] };
  inventory: CableInventory[];
  movements: CableMovement[];
  repairs: EquipmentRepair[];
  stats: Record<string, { totalLength: number; totalQty: number; issuedQty: number; repairQty: number }>;
  selectedItems: SelectedItem[];
  expandedCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  onToggleItem: (item: CableInventory) => void;
  onUpdateInventoryQty: (id: string, newQty: number, length: number) => void;
  onDeleteInventory: (id: string) => Promise<{ error: any }>;
  onAddInventory: (categoryId: string) => void;
  onEditInventory: (item: CableInventory, categoryName: string) => void;
  onEditCategory: (cat: CableCategory) => void;
  onDeleteCategory: (id: string) => Promise<{ error: any }>;
  onSendToRepair?: (categoryId: string, item: CableInventory, categoryName: string) => void;
  onShowQRCode?: (item: CableInventory) => void;
  categoryName?: string;
  level?: number;
  isSortable?: boolean;
  // Для выбора оборудования
  selectionMode?: boolean;
  selectedInventoryIds?: Set<string>;
  onSelectInventory?: (id: string, selected: boolean) => void;
  onSelectAllInCategory?: (categoryId: string, selected: boolean) => void;
}

function SortableCategoryItem({
  category,
  inventory,
  movements,
  repairs,
  stats,
  selectedItems,
  expandedCategories,
  onToggleCategory,
  onToggleItem,
  onUpdateInventoryQty,
  onDeleteInventory,
  onAddInventory,
  onEditInventory,
  onEditCategory,
  onDeleteCategory,
  onSendToRepair,
  onShowQRCode,
  categoryName = '',
  level = 0,
  isSortable = false,
  selectionMode,
  selectedInventoryIds,
  onSelectInventory,
  onSelectAllInCategory,
}: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id, disabled: !isSortable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Рендерим категорию через CategoryItem (вынесем в отдельный компонент)
  return (
    <div ref={setNodeRef} style={style} className={level > 0 ? 'ml-4 sm:ml-6' : ''}>
      <CategoryItem
        category={category}
        inventory={inventory}
        movements={movements}
        repairs={repairs}
        stats={stats}
        selectedItems={selectedItems}
        expandedCategories={expandedCategories}
        onToggleCategory={onToggleCategory}
        onToggleItem={onToggleItem}
        onUpdateInventoryQty={onUpdateInventoryQty}
        onDeleteInventory={onDeleteInventory}
        onAddInventory={onAddInventory}
        onEditInventory={onEditInventory}
        onEditCategory={onEditCategory}
        onDeleteCategory={onDeleteCategory}
        onSendToRepair={onSendToRepair}
        onShowQRCode={onShowQRCode}
        categoryName={categoryName}
        level={level}
        dragHandleProps={isSortable ? { ...attributes, ...listeners } : undefined}
        selectionMode={selectionMode}
        selectedInventoryIds={selectedInventoryIds}
        onSelectInventory={onSelectInventory}
        onSelectAllInCategory={onSelectAllInCategory}
      />
    </div>
  );
}

// Компонент для отображения одной категории (без drag-and-drop логики)
interface CategoryItemProps {
  category: CableCategory & { children?: CableCategory[] };
  inventory: CableInventory[];
  movements: CableMovement[];
  repairs: EquipmentRepair[];
  stats: Record<string, { totalLength: number; totalQty: number; issuedQty: number; repairQty: number }>;
  selectedItems: SelectedItem[];
  expandedCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  onToggleItem: (item: CableInventory) => void;
  onUpdateInventoryQty: (id: string, newQty: number, length: number) => void;
  onDeleteInventory: (id: string) => Promise<{ error: any }>;
  onAddInventory: (categoryId: string) => void;
  onEditInventory: (item: CableInventory, categoryName: string) => void;
  onEditCategory: (cat: CableCategory) => void;
  onDeleteCategory: (id: string) => Promise<{ error: any }>;
  onSendToRepair?: (categoryId: string, item: CableInventory, categoryName: string) => void;
  onShowQRCode?: (item: CableInventory) => void;
  categoryName?: string;
  level?: number;
  dragHandleProps?: any;
  // Для выбора оборудования
  selectionMode?: boolean;
  selectedInventoryIds?: Set<string>;
  onSelectInventory?: (id: string, selected: boolean) => void;
  onSelectAllInCategory?: (categoryId: string, selected: boolean) => void;
}

function CategoryItem({
  category,
  inventory,
  movements,
  repairs,
  stats,
  selectedItems,
  expandedCategories,
  onToggleCategory,
  onToggleItem,
  onUpdateInventoryQty,
  onDeleteInventory,
  onAddInventory,
  onEditInventory,
  onEditCategory,
  onDeleteCategory,
  onSendToRepair,
  onShowQRCode,
  categoryName = '',
  level = 0,
  dragHandleProps,
  selectionMode,
  selectedInventoryIds,
  onSelectInventory,
  onSelectAllInCategory,
}: CategoryItemProps) {
  const catInventory = inventory.filter(i => i.category_id === category.id).sort((a, b) => (a.length || 0) - (b.length || 0));
  const catStats = stats[category.id] || { totalLength: 0, totalQty: 0, issuedQty: 0, repairQty: 0 };
  const isExpanded = expandedCategories.has(category.id);
  const hasLowStock = catInventory.some(i => (i.min_quantity ?? 0) > 0 && i.quantity < (i.min_quantity ?? 0));
  const hasChildren = category.children && category.children.length > 0;
  
  // Проверяем, создана ли категория недавно (менее 24 часов назад)
  const isNewCategory = category.created_at ? 
    ((new Date().getTime() - new Date(category.created_at).getTime()) / (1000 * 60 * 60)) < 24 : 
    false;
  
  // Подсчет выданного и в ремонте
  const getIssuedQtyForItem = (categoryId: string, length: number, name?: string) => {
    return movements
      .filter(m => !m.is_returned && m.category_id === categoryId)
      .filter(m => name ? m.equipment_name === name : m.length === length)
      .reduce((sum, m) => sum + m.quantity, 0);
  };

  const getRepairQtyForItem = (categoryId: string, length: number, name?: string) => {
    return repairs
      .filter(r => r.status === 'in_repair' && r.category_id === categoryId)
      .filter(r => name ? r.equipment_name === name : r.length === length)
      .reduce((sum, r) => sum + r.quantity, 0);
  };

  // Проверяем дочерние категории на low stock
  const checkChildrenLowStock = (cats: CableCategory[]): boolean => {
    return cats.some(cat => {
      const inv = inventory.filter(i => i.category_id === cat.id);
      const hasLow = inv.some(i => (i.min_quantity ?? 0) > 0 && i.quantity < (i.min_quantity ?? 0));
      return hasLow || (cat.children ? checkChildrenLowStock(cat.children) : false);
    });
  };
  const hasChildrenLowStock = category.children ? checkChildrenLowStock(category.children) : false;
  const showLowStock = hasLowStock || hasChildrenLowStock;

  return (
    <Card className={`${showLowStock ? 'border-orange-300' : ''} bg-muted/50 border-border/50`}>
      <CardHeader className="pb-2">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => onToggleCategory(category.id)}
        >
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Drag handle */}
            {dragHandleProps && (
              <button
                {...dragHandleProps}
                className="p-1 hover:bg-muted/80 rounded cursor-grab active:cursor-grabbing shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            {/* Чекбокс выбора всех в категории */}
            {selectionMode && onSelectAllInCategory && (
              <input
                type="checkbox"
                checked={catInventory.length > 0 && catInventory.every(i => selectedInventoryIds?.has(i.id))}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelectAllInCategory(category.id, e.target.checked);
                }}
                className="w-4 h-4 rounded border-border shrink-0"
              />
            )}
            <div 
              className="w-3 h-3 sm:w-4 sm:h-4 rounded-full shrink-0"
              style={{ backgroundColor: category.color }}
            />
            {level > 0 && <span className="text-muted-foreground/70 text-xs sm:text-sm">└</span>}
            <CardTitle className={`${level > 0 ? 'text-sm sm:text-base' : 'text-base sm:text-lg'} truncate`}>
              {category.name}
            </CardTitle>
            {isNewCategory && catInventory.length === 0 && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 shrink-0">
                Новая
              </Badge>
            )}
            {showLowStock && (
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-0 sm:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onAddInventory(category.id)}
              className="h-8 w-8 p-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onEditCategory(category)}
              className="h-8 w-8 p-0 hidden sm:flex"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onDeleteCategory(category.id)}
              className="h-8 w-8 p-0 hidden sm:flex"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleCategory(category.id)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        {category.description && (
          <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
        )}
        <div className="flex gap-2 sm:gap-4 mt-2 text-xs sm:text-sm flex-wrap">
          {catStats.totalLength > 0 && (
            <span className="text-muted-foreground">
              <span className="hidden sm:inline">Общий метраж: </span>
              <span className="sm:hidden">Метраж: </span>
              <strong>{catStats.totalLength.toFixed(1)} м</strong>
            </span>
          )}
          <span className="text-muted-foreground">
            <span className="hidden sm:inline">На складе: </span>
            <span className="sm:hidden">Склад: </span>
            <strong>{catStats.totalQty} шт</strong>
          </span>
          {catStats.issuedQty > 0 && (
            <span className="text-orange-600">
              <span className="hidden sm:inline">Выдано: </span>
              <span className="sm:hidden">Выд: </span>
              <strong>{catStats.issuedQty} шт</strong>
            </span>
          )}
          {catStats.repairQty > 0 && (
            <span className="text-yellow-600">
              <span className="hidden sm:inline">В ремонте: </span>
              <span className="sm:hidden">Рем: </span>
              <strong>{catStats.repairQty} шт</strong>
            </span>
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {catInventory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет позиций</p>
          ) : (
            <div className="space-y-2">
              {catInventory.map(item => {
                const isSelected = selectedItems.some(i => i.inventory_id === item.id);
                const minQty = item.min_quantity ?? 0;
                const issuedQty = getIssuedQtyForItem(category.id, item.length || 0, item.name);
                const repairQty = getRepairQtyForItem(category.id, item.length || 0, item.name);
                const actualQty = item.quantity - issuedQty - repairQty;
                const isLow = minQty > 0 && actualQty < minQty;
                
                return (
                  <div 
                    key={item.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded gap-2 ${
                      isSelected ? 'bg-primary/10 border border-primary/30' : 
                      selectionMode && selectedInventoryIds?.has(item.id) ? 'bg-green-500/10 border border-green-500/30' :
                      isLow ? 'bg-orange-500/10' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      {selectionMode ? (
                        <input
                          type="checkbox"
                          checked={selectedInventoryIds?.has(item.id) || false}
                          onChange={(e) => onSelectInventory?.(item.id, e.target.checked)}
                          className="w-4 h-4 rounded border-border shrink-0"
                        />
                      ) : (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => actualQty > 0 && onToggleItem(item)}
                          disabled={actualQty <= 0}
                          className="shrink-0"
                        />
                      )}
                      {item.name ? (
                        <span className="font-medium truncate text-sm sm:text-base" title={item.name}>{item.name}</span>
                      ) : (
                        <span className="font-medium w-14 sm:w-16 text-sm sm:text-base">{item.length} м</span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => onUpdateInventoryQty(item.id!, item.quantity - 1, item.length || 0)}
                          disabled={item.quantity <= 0}
                        >
                          -
                        </Button>
                        <span className={`text-sm w-8 sm:w-10 text-center ${isLow ? 'text-orange-600 font-medium' : 'text-muted-foreground'}`}>
                          {actualQty}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => onUpdateInventoryQty(item.id!, item.quantity + 1, item.length || 0)}
                        >
                          +
                        </Button>
                      </div>
                      {issuedQty > 0 && (
                        <span className="text-xs text-orange-500 shrink-0 hidden sm:inline">({item.quantity} всего)</span>
                      )}
                      {repairQty > 0 && (
                        <span className="text-xs text-yellow-600 shrink-0" title="В ремонте">
                          🔧 {repairQty}
                        </span>
                      )}
                      {item.watts && item.watts > 0 && (
                        <span className="text-xs text-blue-600 shrink-0" title={`Мощность: ${item.watts} Вт`}>
                          ⚡ {item.watts}Вт
                        </span>
                      )}
                      {isLow && (
                        <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 hidden sm:block" />
                      )}
                      {item.notes && (
                        <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[200px]" title={item.notes}>
                          {item.notes}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-1 pl-6 sm:pl-0">
                      {item.notes && (
                        <span className="text-xs text-muted-foreground truncate flex-1 sm:hidden" title={item.notes}>
                          {item.notes}
                        </span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        {item.qr_code && onShowQRCode && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onShowQRCode(item)}
                            title="Показать QR-код"
                            className="h-7 w-7 sm:h-8 sm:w-auto sm:px-2 p-0"
                          >
                            <span className="hidden sm:inline">📱</span>
                            <span className="sm:hidden text-xs">📱</span>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSendToRepair?.(category.id, item, category.name)}
                          disabled={actualQty <= 0}
                          title="Отправить в ремонт"
                          className="h-7 w-7 sm:h-8 sm:w-auto sm:px-2 p-0"
                        >
                          <span className="hidden sm:inline">🔧</span>
                          <span className="sm:hidden text-xs">🔧</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditInventory(item, category.name)}
                          title="Редактировать"
                          className="h-7 w-7 sm:h-8 p-0"
                        >
                          <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDeleteInventory(item.id!)}
                          title="Удалить"
                          className="h-7 w-7 sm:h-8 p-0"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
      
      {/* Рекурсивный рендеринг подкатегорий */}
      {hasChildren && isExpanded && (
        <div className="mt-2 space-y-2">
          {category.children!.map(child => (
            <CategoryItem
              key={child.id}
              category={child}
              inventory={inventory}
              movements={movements}
              repairs={repairs}
              stats={stats}
              selectedItems={selectedItems}
              expandedCategories={expandedCategories}
              onToggleCategory={onToggleCategory}
              onToggleItem={onToggleItem}
              onUpdateInventoryQty={onUpdateInventoryQty}
              onDeleteInventory={onDeleteInventory}
              onAddInventory={onAddInventory}
              onEditInventory={onEditInventory}
              onEditCategory={onEditCategory}
              onDeleteCategory={onDeleteCategory}
              onSendToRepair={onSendToRepair}
              onShowQRCode={onShowQRCode}
              categoryName={category.name}
              level={level + 1}
              selectionMode={selectionMode}
              selectedInventoryIds={selectedInventoryIds}
              onSelectInventory={onSelectInventory}
              onSelectAllInCategory={onSelectAllInCategory}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// Компонент для отображения списка категорий с поддержкой drag-and-drop
interface CategoryListProps {
  categories: (CableCategory & { children?: CableCategory[]; level?: number })[];
  inventory: CableInventory[];
  movements: CableMovement[];
  repairs: EquipmentRepair[];
  stats: Record<string, { totalLength: number; totalQty: number; issuedQty: number; repairQty: number }>;
  selectedItems: SelectedItem[];
  expandedCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  onToggleItem: (item: CableInventory) => void;
  onUpdateInventoryQty: (id: string, newQty: number, length: number) => void;
  onDeleteInventory: (id: string) => Promise<{ error: any }>;
  onAddInventory: (categoryId: string) => void;
  onEditInventory: (item: CableInventory, categoryName: string) => void;
  onEditCategory: (cat: CableCategory) => void;
  onDeleteCategory: (id: string) => Promise<{ error: any }>;
  onSendToRepair?: (categoryId: string, item: CableInventory, categoryName: string) => void;
  onShowQRCode?: (item: CableInventory) => void;
  onReorderCategories?: (categoryIds: string[]) => Promise<{ error: any }>;
  categoryName?: string;
  level?: number;
  // Для выбора оборудования
  selectionMode?: boolean;
  selectedInventoryIds?: Set<string>;
  onSelectInventory?: (id: string, selected: boolean) => void;
  onSelectAllInCategory?: (categoryId: string, selected: boolean) => void;
}

function CategoryList({
  categories,
  inventory,
  movements,
  repairs,
  stats,
  selectedItems,
  expandedCategories,
  onToggleCategory,
  onToggleItem,
  onUpdateInventoryQty,
  onDeleteInventory,
  onAddInventory,
  onEditInventory,
  onEditCategory,
  onDeleteCategory,
  onSendToRepair,
  onShowQRCode,
  onReorderCategories,
  categoryName = '',
  level = 0,
  selectionMode,
  selectedInventoryIds,
  onSelectInventory,
  onSelectAllInCategory,
}: CategoryListProps) {
  // Для корневого уровня используем DndContext если есть onReorderCategories
  const isRootLevel = level === 0;
  const canSort = isRootLevel && !!onReorderCategories && categories.length > 1;
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onReorderCategories) {
      const oldIndex = categories.findIndex(c => c.id === active.id);
      const newIndex = categories.findIndex(c => c.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const newCategories = arrayMove(categories, oldIndex, newIndex);
      const newCategoryIds = newCategories.map(c => c.id);
      
      // Вызываем callback для обновления порядка
      onReorderCategories(newCategoryIds);
    }
  };

  // Рендерим категорию
  const renderCategory = (category: CableCategory & { children?: CableCategory[] }) => {
    if (canSort) {
      return (
        <SortableCategoryItem
          key={category.id}
          category={category}
          inventory={inventory}
          movements={movements}
          repairs={repairs}
          stats={stats}
          selectedItems={selectedItems}
          expandedCategories={expandedCategories}
          onToggleCategory={onToggleCategory}
          onToggleItem={onToggleItem}
          onUpdateInventoryQty={onUpdateInventoryQty}
          onDeleteInventory={onDeleteInventory}
          onAddInventory={onAddInventory}
          onEditInventory={onEditInventory}
          onEditCategory={onEditCategory}
          onDeleteCategory={onDeleteCategory}
          onSendToRepair={onSendToRepair}
          onShowQRCode={onShowQRCode}
          categoryName={categoryName}
          level={level}
          isSortable={true}
          selectionMode={selectionMode}
          selectedInventoryIds={selectedInventoryIds}
          onSelectInventory={onSelectInventory}
          onSelectAllInCategory={onSelectAllInCategory}
        />
      );
    }
    
    return (
      <CategoryItem
        key={category.id}
        category={category}
        inventory={inventory}
        movements={movements}
        repairs={repairs}
        stats={stats}
        selectedItems={selectedItems}
        expandedCategories={expandedCategories}
        onToggleCategory={onToggleCategory}
        onToggleItem={onToggleItem}
        onUpdateInventoryQty={onUpdateInventoryQty}
        onDeleteInventory={onDeleteInventory}
        onAddInventory={onAddInventory}
        onEditInventory={onEditInventory}
        onEditCategory={onEditCategory}
        onDeleteCategory={onDeleteCategory}
        onSendToRepair={onSendToRepair}
        onShowQRCode={onShowQRCode}
        categoryName={categoryName}
        level={level}
        selectionMode={selectionMode}
        selectedInventoryIds={selectedInventoryIds}
        onSelectInventory={onSelectInventory}
        onSelectAllInCategory={onSelectAllInCategory}
      />
    );
  };

  if (canSort) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={categories.map(c => c.id)} 
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {categories.map(renderCategory)}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  return (
    <>
      {categories.map(renderCategory)}
    </>
  );
}

// Вспомогательная функция для подсчета статистики категории
function getCategoryStatsWithChildren(
  cat: CableCategory & { children?: CableCategory[] },
  inventory: CableInventory[],
  movements: CableMovement[],
  repairs: EquipmentRepair[]
) {
  const allIds = getAllCategoryIds(cat);
  const catInventory = inventory.filter(i => allIds.includes(i.category_id));
  
  const totalLength = catInventory.reduce((sum, i) => sum + ((i.length || 0) * i.quantity), 0);
  const totalQty = catInventory.reduce((sum, i) => sum + i.quantity, 0);
  const hasCables = catInventory.some(i => i.length && i.length > 0);
  const hasEquipment = catInventory.some(i => !i.length);
  
  const issuedQty = movements
    .filter(m => !m.is_returned && allIds.includes(m.category_id))
    .reduce((sum, m) => sum + m.quantity, 0);
  
  const repairQty = repairs
    .filter(r => r.status === 'in_repair' && allIds.includes(r.category_id))
    .reduce((sum, r) => sum + r.quantity, 0);
  
  return { totalLength, totalQty, issuedQty, repairQty, hasCables, hasEquipment };
}

function getAllCategoryIds(cat: CableCategory & { children?: CableCategory[] }): string[] {
  const ids = [cat.id];
  if (cat.children) {
    cat.children.forEach(child => {
      ids.push(...getAllCategoryIds(child));
    });
  }
  return ids;
}

export default CableManager;
