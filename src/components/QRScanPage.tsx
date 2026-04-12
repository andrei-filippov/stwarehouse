import { useState, useEffect, useRef } from 'react';
import { QRScanner } from './QRScanner';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { 
  Scan, 
  Package, 
  ClipboardCheck, 
  Info,
  ArrowLeft,
  Plus,
  Minus,
  CheckCircle2,
  X,
  User,
  Wrench,
  ArrowUpRight,
  Keyboard,
  Camera,
  Monitor,
  Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { CableInventory, EquipmentKit, CableCategory } from '../types';
import type { ChecklistV2 } from '../types/checklist';
import { useUrlScanCode, clearUrlScanCode } from '../hooks/useUrlScanCode';

interface QRScanPageProps {
  companyId: string;
  categories?: CableCategory[];
  checklists?: ChecklistV2[];
  onTabChange?: (tab: string) => void;
  initialCode?: string | null; // QR-код из URL
}

type ScanResult = 
  | { type: 'inventory'; data: CableInventory; category?: CableCategory; stats?: { inStock: number; issued: number; reserved: number; inRepair: number } }
  | { type: 'kit'; data: EquipmentKit }
  | { type: 'not_found'; qrCode: string }
  | null;

type QuickAction = 'info' | 'checklist' | 'issue' | 'repair' | null;

export default function QRScanPage({ companyId, categories = [], checklists = [], onTabChange, initialCode }: QRScanPageProps) {
  // Читаем URL параметр через хук
  const urlScanCode = useUrlScanCode();
  const processedUrlScan = useRef(false);
  
  const effectiveInitialCode = initialCode || urlScanCode;
  
  console.log('[QRScan] Component rendering, initialCode:', initialCode, 'urlScanCode:', urlScanCode, 'effective:', effectiveInitialCode);
  
  const [isScanning, setIsScanning] = useState(!effectiveInitialCode); // Если есть initialCode - не сканируем
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [inventory, setInventory] = useState<CableInventory[]>([]);
  const [kits, setKits] = useState<EquipmentKit[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Диалоги быстрых действий
  const [activeAction, setActiveAction] = useState<QuickAction>(null);
  const [issueForm, setIssueForm] = useState({ issued_to: '', contact: '', quantity: 1 });
  const [repairForm, setRepairForm] = useState({ reason: '', quantity: 1 });
  const [kitIssueForm, setKitIssueForm] = useState({ issued_to: '', contact: '' });
  const [submitting, setSubmitting] = useState(false);
  
  // Детали для просмотра информации
  const [movementsDetails, setMovementsDetails] = useState<any[]>([]);
  const [reservationsDetails, setReservationsDetails] = useState<any[]>([]);
  const [checklistLoadsDetails, setChecklistLoadsDetails] = useState<any[]>([]);
  const [repairsDetails, setRepairsDetails] = useState<any[]>([]);

  // Загружаем инвентарь и комплекты
  useEffect(() => {
    const fetchData = async () => {
      if (!companyId) return;
      
      setLoading(true);
      
      // Загружаем инвентарь
      const { data: invData } = await supabase
        .from('cable_inventory')
        .select('*')
        .eq('company_id', companyId);
      
      if (invData) setInventory(invData);
      
      // Загружаем комплекты с items и названиями оборудования
      const { data: kitsData } = await supabase
        .from('equipment_kits')
        .select('*')
        .eq('company_id', companyId);
      
      // Загружаем items для каждого комплекта с названиями
      const kitsWithItems = await Promise.all((kitsData || []).map(async (kit: any) => {
        const { data: itemsData } = await supabase
          .from('kit_items')
          .select(`
            *,
            cable_inventory:inventory_id(name)
          `)
          .eq('kit_id', kit.id);
        
        return {
          ...kit,
          items: (itemsData || []).map((item: any) => ({
            ...item,
            inventory_name: item.inventory_name || item.cable_inventory?.name || 'Неизвестно'
          }))
        };
      }));
      
      setKits(kitsWithItems);
      setLoading(false);
    };
    
    fetchData();
  }, [companyId]);

  // Отслеживаем размонтирование
  useEffect(() => {
    console.log('[QRScan] Component MOUNTED');
    return () => {
      console.log('[QRScan] Component UNMOUNTED');
    };
  }, []);

  // Real-time подписка на изменения инвентаря
  useEffect(() => {
    if (!companyId) return;
    
    const inventoryChannel = supabase
      .channel('qr_scan_inventory_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cable_inventory',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          // Обновляем инвентарь
          setInventory((prev) => {
            const newInventory = [...prev];
            const index = newInventory.findIndex((item) => item.id === payload.new.id);
            
            if (payload.eventType === 'DELETE') {
              return newInventory.filter((item) => item.id !== payload.old.id);
            }
            
            if (index >= 0) {
              newInventory[index] = payload.new as CableInventory;
            } else {
              newInventory.push(payload.new as CableInventory);
            }
            
            // Если это отсканированное оборудование — показываем уведомление
            if (scanResult?.type === 'inventory' && scanResult.data.id === payload.new.id) {
              const oldQty = scanResult.data.quantity;
              const newQty = payload.new.quantity;
              if (oldQty !== newQty) {
                toast.info(`Количество обновлено: ${newQty} шт`, {
                  description: 'Другой пользователь изменил остаток',
                });
                // Обновляем scanResult
                setScanResult({
                  ...scanResult,
                  data: { ...scanResult.data, quantity: newQty },
                });
              }
            }
            
            return newInventory;
          });
        }
      )
      .subscribe();
    
    return () => {
      inventoryChannel.unsubscribe();
    };
  }, [companyId, scanResult]);

  // Обработка initialCode из URL - вызываем только один раз при загрузке данных
  useEffect(() => {
    if (effectiveInitialCode && inventory.length > 0 && !scanResult && !processedUrlScan.current) {
      console.log('[QRScan] Processing initialCode:', effectiveInitialCode);
      processedUrlScan.current = true;
      // Небольшая задержка чтобы убедиться что handleScan инициализирован
      const timer = setTimeout(() => {
        handleScan(effectiveInitialCode);
        clearUrlScanCode();
      }, 100);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveInitialCode, inventory]);
  


  // Извлекаем QR-код из URL или возвращаем как есть
  const extractQRCode = (input: string): string => {
    // Приводим к нижнему регистру для case-insensitive поиска
    const lowerInput = input.toLowerCase();
    
    // Если это URL с параметром scan (поддержка ?scan= и ?SCAN=)
    try {
      const url = new URL(input);
      // Ищем параметр scan без учета регистра
      for (const [key, value] of url.searchParams) {
        if (key.toLowerCase() === 'scan') {
          return value.toUpperCase();
        }
      }
    } catch {
      // Не URL, пробуем найти ?scan= вручную
      const scanMatch = lowerInput.match(/[?&]scan=([^&]+)/);
      if (scanMatch) {
        return scanMatch[1].toUpperCase();
      }
    }
    return input.toUpperCase();
  };

  const handleScan = async (qrCode: string) => {
    console.log('[QRScan] handleScan STARTED, input:', qrCode, 'current scanResult:', scanResult?.type);
    
    // Извлекаем код из URL если нужно
    const cleanCode = extractQRCode(qrCode);
    console.log('[QRScan] Clean code:', cleanCode);
    
    // Ищем комплект (case-insensitive)
    const kit = kits.find(k => k.qr_code?.toUpperCase() === cleanCode);
    if (kit) {
      console.log('[QRScan] Found kit:', kit.name);
      setScanResult({ type: 'kit', data: kit });
      setIsScanning(false);
      return;
    }
    
    // Ищем оборудование (case-insensitive)
    const item = inventory.find(i => i.qr_code?.toUpperCase() === cleanCode);
    console.log('[QRScan] Inventory search:', { found: !!item, totalItems: inventory.length, itemId: item?.id });
    if (item) {
      console.log('[QRScan] Found item:', item.name, 'category_id:', item.category_id);
      const category = categories.find(c => c.id === item.category_id);
      console.log('[QRScan] Category:', category?.name || 'not found');
      
      // Получаем статистику по оборудованию
      console.log('[QRScan] Fetching stats from supabase...');
      try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        const [{ data: movements }, { data: repairs }, { data: estimateReservations }, { data: checklistItems }] = await Promise.all([
          supabase
            .from('cable_movements')
            .select('quantity, is_returned')
            .eq('inventory_id', item.id)
            .eq('type', 'issue'),
          supabase
            .from('equipment_repairs')
            .select('quantity')
            .eq('inventory_id', item.id)
            .not('status', 'eq', 'returned'),
          // Запрос резервов из смет - активные (не закончившиеся) мероприятия
          // Прямой запрос по equipment_id без join (связь не настроена в схеме)
          supabase
            .from('estimate_items')
            .select('quantity, estimates!inner(event_date, event_end_date, company_id)')
            .eq('equipment_id', item.equipment_id || 'null')
            .gte('estimates.event_end_date', today),
          // Запрос выдач через чек-листы
          supabase
            .from('checklist_items')
            .select('loaded_quantity')
            .eq('inventory_id', item.id)
            .eq('loaded', true)
        ]);
        
        console.log('[QRScan] Stats received:', { 
          movements: movements?.length || 0, 
          repairs: repairs?.length || 0,
          reservations: estimateReservations?.length || 0,
          checklistItems: checklistItems?.length || 0,
          itemEquipmentId: item.equipment_id,
          itemName: item.name
        });
        
        // Активные выдачи (не возвращённые) из cable_movements
        const activeIssued = movements?.filter(m => !m.is_returned).reduce((sum, m) => sum + (m.quantity || 0), 0) || 0;
        const repairQty = repairs?.reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;
        
        // Считаем зарезервированное количество из смет (для информации, не влияет на свободное)
        const filteredReservations = estimateReservations?.filter(r => r.estimates?.company_id === companyId) || [];
        const reservedQty = filteredReservations.reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;
        
        // Свободно = всего на складе - активная выдача - в ремонте (резерв не учитываем)
        const availableQty = Math.max(0, item.quantity - activeIssued - repairQty);
        
        console.log('[QRScan] Calculated quantities:', { 
          total: item.quantity, 
          activeIssued: activeIssued, 
          repair: repairQty, 
          reserved: reservedQty,
          available: availableQty 
        });
        
        console.log('[QRScan] Setting isScanning to false FIRST');
        setIsScanning(false);
        
        console.log('[QRScan] Setting scan result...');
        setScanResult({ 
          type: 'inventory', 
          data: item, 
          category,
          stats: {
            inStock: availableQty, // Свободно для выдачи
            issued: activeIssued,  // Активно выдано (не возвращено)
            reserved: reservedQty, // Зарезервировано (информационно)
            inRepair: repairQty    // В ремонте
          }
        });
      } catch (err) {
        console.error('[QRScan] Error fetching stats:', err);
        // Показываем без статистики
        setScanResult({ 
          type: 'inventory', 
          data: item, 
          category,
          stats: {
            inStock: item.quantity,
            issued: 0,
            reserved: 0,
            inRepair: 0
          }
        });
        setIsScanning(false);
      }
      return;
    }
    
    // Не найдено
    console.log('[QRScan] Not found. Available codes:', {
      kits: kits.map(k => k.qr_code),
      inventory: inventory.map(i => i.qr_code)
    });
    setScanResult({ type: 'not_found', qrCode: cleanCode });
    setIsScanning(false);
    toast.error('QR-код не найден', { 
      description: `${cleanCode} не найден в базе` 
    });
  };

  const handleScanAgain = () => {
    setScanResult(null);
    setIsScanning(true);
  };

  const goToInventory = () => {
    onTabChange?.('cable');
  };

  const goToChecklists = () => {
    onTabChange?.('checklists');
  };
  
  // Быстрая выдача оборудования
  const handleQuickIssue = async () => {
    if (!scanResult || scanResult.type !== 'inventory') return;
    if (!issueForm.issued_to.trim()) {
      toast.error('Укажите, кому выдаётся оборудование');
      return;
    }
    
    const item = scanResult.data;
    const availableQty = scanResult.stats?.inStock ?? item.quantity;
    if (issueForm.quantity > availableQty) {
      toast.error(`Нельзя выдать больше, чем есть на складе (доступно: ${availableQty})`);
      return;
    }
    
    setSubmitting(true);
    const { error } = await supabase.from('cable_movements').insert({
      company_id: companyId,
      category_id: item.category_id,
      inventory_id: item.id,
      equipment_name: item.name || 'Оборудование',
      length: item.length || 0,
      quantity: issueForm.quantity,
      issued_to: issueForm.issued_to,
      contact: issueForm.contact || undefined,
      type: 'issue'
    });
    
    if (error) {
      toast.error('Ошибка при выдаче', { description: error.message });
    } else {
      toast.success('Оборудование выдано', { 
        description: `${item.name || 'Оборудование'} — ${issueForm.quantity} шт` 
      });
      setActiveAction(null);
      setIssueForm({ issued_to: '', contact: '', quantity: 1 });
      // Обновляем данные
      const { data } = await supabase.from('cable_inventory').select('*').eq('company_id', companyId);
      if (data) setInventory(data);
    }
    setSubmitting(false);
  };
  
  // Выдача комплекта (все позиции одному получателю)
  const handleIssueKit = async () => {
    if (!scanResult || scanResult.type !== 'kit') return;
    if (!kitIssueForm.issued_to.trim()) {
      toast.error('Укажите, кому выдаётся комплект');
      return;
    }
    
    const kit = scanResult.data;
    if (!kit.items || kit.items.length === 0) {
      toast.error('Комплект пуст');
      return;
    }
    
    setSubmitting(true);
    
    // Выдаём каждую позицию комплекта
    const errors: string[] = [];
    for (const kitItem of kit.items) {
      // Находим инвентарь по ID
      const inventoryItem = inventory.find(i => i.id === kitItem.inventory_id);
      if (!inventoryItem) {
        errors.push(`Не найдено: ${kitItem.inventory_name}`);
        continue;
      }
      
      // Проверяем достаточно ли на складе
      if ((kitItem.quantity || 1) > inventoryItem.quantity) {
        errors.push(`Недостаточно: ${kitItem.inventory_name} (нужно ${kitItem.quantity || 1}, есть ${inventoryItem.quantity})`);
        continue;
      }
      
      const { error } = await supabase.from('cable_movements').insert({
        company_id: companyId,
        category_id: inventoryItem.category_id,
        inventory_id: inventoryItem.id,
        equipment_name: inventoryItem.name || kitItem.inventory_name || 'Оборудование',
        length: inventoryItem.length || 0,
        quantity: kitItem.quantity || 1,
        issued_to: kitIssueForm.issued_to,
        contact: kitIssueForm.contact || undefined,
        type: 'issue',
        notes: `Из комплекта: ${kit.name}`
      });
      
      if (error) {
        errors.push(`${kitItem.inventory_name}: ${error.message}`);
      }
    }
    
    if (errors.length > 0) {
      toast.error('Частичная выдача', { description: errors.join('; ') });
    } else {
      toast.success('Комплект выдан', { 
        description: `${kit.name} — ${kit.items.length} позиций` 
      });
      setActiveAction(null);
      setKitIssueForm({ issued_to: '', contact: '' });
      
      // Обновляем данные
      const { data } = await supabase.from('cable_inventory').select('*').eq('company_id', companyId);
      if (data) setInventory(data);
    }
    setSubmitting(false);
  };
  
  // Быстрая отправка в ремонт
  const handleQuickRepair = async () => {
    if (!scanResult || scanResult.type !== 'inventory') return;
    if (!repairForm.reason.trim()) {
      toast.error('Укажите причину ремонта');
      return;
    }
    
    const item = scanResult.data;
    if (repairForm.quantity > item.quantity) {
      toast.error('Нельзя отправить в ремонт больше, чем есть на складе');
      return;
    }
    
    setSubmitting(true);
    const { error } = await supabase.from('equipment_repairs').insert({
      company_id: companyId,
      category_id: item.category_id,
      inventory_id: item.id,
      equipment_name: item.name || 'Оборудование',
      length: item.length || 0,
      quantity: repairForm.quantity,
      reason: repairForm.reason,
      status: 'in_repair'
    });
    
    if (error) {
      toast.error('Ошибка при отправке в ремонт', { description: error.message });
    } else {
      toast.success('Отправлено в ремонт', { 
        description: `${item.name || 'Оборудование'} — ${repairForm.quantity} шт` 
      });
      setActiveAction(null);
      setRepairForm({ reason: '', quantity: 1 });
      // Обновляем данные
      const { data } = await supabase.from('cable_inventory').select('*').eq('company_id', companyId);
      if (data) setInventory(data);
    }
    setSubmitting(false);
  };

  // Возврат из ремонта
  const handleReturnFromRepair = async (repairId: string) => {
    setSubmitting(true);
    
    const { error } = await supabase
      .from('equipment_repairs')
      .update({ status: 'returned', returned_date: new Date().toISOString() })
      .eq('id', repairId);
    
    if (error) {
      toast.error('Ошибка при возврате', { description: error.message });
    } else {
      toast.success('Оборудование возвращено', { description: 'Со склада' });
      // Обновляем данные
      const { data } = await supabase.from('cable_inventory').select('*').eq('company_id', companyId);
      if (data) setInventory(data);
      // Перезагружаем информацию
      if (scanResult?.type === 'inventory') {
        handleShowInfo();
      }
    }
    setSubmitting(false);
  };

  // Добавление оборудования в чеклист
  const handleAddToChecklist = async (checklistId: string) => {
    if (!scanResult || scanResult.type !== 'inventory') return;
    
    const item = scanResult.data;
    const category = scanResult.category;
    setSubmitting(true);
    
    console.log('[QRScan] Adding to checklist:', { checklistId, item: item.name, category: category?.name });
    
    try {
      const insertData = {
        checklist_id: checklistId,
        name: item.name || 'Оборудование',
        category: category?.name || 'Без категории',
        quantity: 1,
        is_required: true,
        is_checked: false
      };
      
      console.log('[QRScan] Insert data:', insertData);
      
      const { data, error } = await supabase
        .from('checklist_items')
        .insert(insertData)
        .select();
      
      if (error) {
        console.error('[QRScan] Insert error:', error);
        throw error;
      }
      
      console.log('[QRScan] Insert success:', data);
      
      toast.success('Добавлено в чеклист', {
        description: `${item.name || 'Оборудование'} добавлено`
      });
      setActiveAction(null);
    } catch (err: any) {
      console.error('[QRScan] Catch error:', err);
      toast.error('Ошибка', { description: err.message });
    }
    setSubmitting(false);
  };

  // Загрузка деталей выдач для просмотра
  const handleShowInfo = async () => {
    if (!scanResult || scanResult.type !== 'inventory') return;
    
    const item = scanResult.data;
    const today = new Date().toISOString().split('T')[0];
    setSubmitting(true);
    
    try {
      // Загружаем выдачи (ручные + через чек-листы), резервы и ремонты параллельно
      const [{ data: movData, error: movError }, { data: resData, error: resError }, { data: checklistData, error: checklistError }, { data: repairsData, error: repairsError }] = await Promise.all([
        supabase
          .from('cable_movements')
          .select('*')
          .eq('inventory_id', item.id)
          .eq('type', 'issue')
          .order('created_at', { ascending: false }),
        supabase
          .from('estimate_items')
          .select('quantity, estimates!inner(event_name, event_date, event_end_date, company_id)')
          .eq('equipment_id', item.equipment_id || 'null')
          .gte('estimates.event_end_date', today),
        supabase
          .from('checklist_items')
          .select('loaded_quantity, loaded_at, checklists!inner(event_name, event_date)')
          .eq('inventory_id', item.id)
          .eq('loaded', true)
          .order('loaded_at', { ascending: false }),
        supabase
          .from('equipment_repairs')
          .select('*')
          .eq('inventory_id', item.id)
          .order('created_at', { ascending: false })
      ]);
      
      if (movError) throw movError;
      if (resError) console.error('Reservations error:', resError);
      if (checklistError) console.error('Checklist error:', checklistError);
      
      // Объединяем ручные выдачи и выдачи через чек-листы
      const manualMovements = (movData || []).map(m => ({ ...m, source: 'manual' }));
      const checklistMovements = (checklistData || []).map(c => ({
        id: `checklist-${c.checklists?.event_name}`,
        issued_to: c.checklists?.event_name || 'Мероприятие',
        contact: null,
        quantity: c.loaded_quantity || 0,
        created_at: c.loaded_at,
        source: 'checklist'
      }));
      
      const allMovements = [...manualMovements, ...checklistMovements]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Фильтруем резервы по company_id на клиенте
      const filteredReservations = (resData || []).filter(r => r.estimates?.company_id === companyId);
      setMovementsDetails(allMovements);
      setReservationsDetails(filteredReservations);
      setChecklistLoadsDetails(checklistData || []);
      setRepairsDetails(repairsData || []);
      if (repairsError) console.error('Repairs error:', repairsError);
      setActiveAction('info');
    } catch (err: any) {
      toast.error('Ошибка загрузки', { description: err.message });
    }
    setSubmitting(false);
  };

  console.log('[QRScan] Render state:', { loading, isScanning, scanResultType: scanResult?.type });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Режим сканирования - автозапуск при открытии вкладки
  if (isScanning) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Scan className="w-6 h-6" />
            Сканер QR-кода
          </h2>
          <div className="hidden md:flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Monitor className="w-3 h-3" />
              Десктоп режим
            </Badge>
          </div>
        </div>
        
        {/* Адаптивный интерфейс: десктоп - ручной ввод, мобильные - камера */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Левая колонка - Камера */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Камера</span>
              <span className="text-xs text-muted-foreground hidden md:inline">(мобильные)</span>
            </div>
            <QRScanner
              isOpen={true}
              onClose={() => {
                setIsScanning(false);
              }}
              onScan={handleScan}
              title="Наведите камеру на QR-код"
              subtitle="Сканируйте оборудование или комплект"
              keepOpen={true}
            />
          </div>
          
          {/* Правая колонка - Ручной ввод */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Keyboard className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Ручной ввод</span>
              <span className="text-xs text-muted-foreground hidden md:inline">(десктоп)</span>
            </div>
            
            <Card className="border-dashed">
              <CardContent className="p-6 space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                    <Keyboard className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Введите QR-код вручную
                  </p>
                </div>
                
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem('manualQrCode') as HTMLInputElement;
                    if (input.value.trim()) {
                      handleScan(input.value.trim());
                      input.value = '';
                    }
                  }}
                  className="space-y-3"
                >
                  <Input
                    id="manualQrCode"
                    name="manualQrCode"
                    placeholder="Например: EQ-UVE970FM"
                    className="text-center font-mono text-lg"
                    autoComplete="off"
                    autoFocus
                  />
                  <Button type="submit" className="w-full">
                    <ArrowUpRight className="w-4 h-4 mr-2" />
                    Найти оборудование
                  </Button>
                </form>
                
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground text-center">
                    Формат: EQ-* (оборудование) или KIT-* (комплект)
                  </p>
                </div>
              </CardContent>
            </Card>
            
            {/* Быстрые подсказки для десктопа */}
            <div className="hidden md:block space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Горячие клавиши</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 bg-muted rounded">
                  <kbd className="px-1.5 py-0.5 bg-background rounded border text-[10px]">Enter</kbd>
                  <span>Поиск</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted rounded">
                  <kbd className="px-1.5 py-0.5 bg-background rounded border text-[10px]">Esc</kbd>
                  <span>Назад</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => setIsScanning(false)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
        </div>
      </div>
    );
  }

  // Результат сканирования - комплект
  if (scanResult?.type === 'kit') {
    const kit = scanResult.data;
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={handleScanAgain}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Новое сканирование
          </Button>
          <Badge variant="secondary">Комплект</Badge>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {kit.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {kit.qr_code && (
              <div className="text-sm text-muted-foreground">
                QR: <code className="bg-muted px-2 py-1 rounded">{kit.qr_code}</code>
              </div>
            )}
            
            {kit.items && kit.items.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Содержимое:</h4>
                <div className="space-y-2">
                  {kit.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between p-2 bg-muted rounded text-sm">
                      <span>{item.inventory_name}</span>
                      <span className="text-muted-foreground">{item.quantity} шт</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="pt-4 border-t space-y-2">
              <h4 className="font-medium text-sm">Быстрые действия:</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="default" onClick={() => setActiveAction('issue_kit')}>
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Выдать комплект
                </Button>
                <Button variant="outline" onClick={goToChecklists}>
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  В чеклист
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Диалог выдачи комплекта */}
        <Dialog open={activeAction === 'issue_kit'} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Выдача комплекта
              </DialogTitle>
              <DialogDescription>
                {kit.name} — {kit.items?.length || 0} позиций
              </DialogDescription>
            </DialogHeader>
            
            {/* Список позиций комплекта */}
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2 bg-muted/30">
              {kit.items?.map((item, idx) => {
                const inventoryItem = inventory.find(i => i.id === item.inventory_id);
                const available = inventoryItem?.quantity || 0;
                const needed = item.quantity || 1;
                const isAvailable = available >= needed;
                
                return (
                  <div key={idx} className={`flex items-center justify-between p-2 rounded text-sm ${isAvailable ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
                    <span className="flex-1 truncate">{item.inventory_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">× {needed}</span>
                      {!isAvailable && (
                        <span className="text-xs text-red-600">(доступно: {available})</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Кому выдаётся *</Label>
                <Input
                  placeholder="ФИО или название организации"
                  value={kitIssueForm.issued_to}
                  onChange={(e) => setKitIssueForm({ ...kitIssueForm, issued_to: e.target.value })}
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Контакт</Label>
                <Input
                  placeholder="Телефон или email"
                  value={kitIssueForm.contact}
                  onChange={(e) => setKitIssueForm({ ...kitIssueForm, contact: e.target.value })}
                  className="h-11"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveAction(null)}>Отмена</Button>
              <Button 
                onClick={handleIssueKit} 
                disabled={submitting || !kitIssueForm.issued_to.trim()}
              >
                {submitting ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full mr-2" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                )}
                Выдать комплект
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Результат сканирования - оборудование
  if (scanResult?.type === 'inventory') {
    const item = scanResult.data;
    const category = scanResult.category;
    
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        {/* Шапка */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={handleScanAgain}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Новое сканирование
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">
              <Package className="w-3 h-3 mr-1" />
              {category?.name || 'Оборудование'}
            </Badge>
            {item.qr_code && (
              <code className="bg-muted px-2 py-1 rounded text-xs font-mono hidden md:inline">
                {item.qr_code}
              </code>
            )}
          </div>
        </div>
        
        {/* Десктоп: двухколоночный layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Левая колонка: основная информация и статистика */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
                  <Package className="w-6 h-6 text-primary" />
                  {item.name || 'Оборудование'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Статистика по оборудованию */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                    <p className="text-xs text-green-600 dark:text-green-400 mb-1">Свободно</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{scanResult.stats?.inStock ?? 0}</p>
                    <p className="text-xs text-green-500">шт</p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Выдано</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{scanResult.stats?.issued || 0}</p>
                    <p className="text-xs text-blue-500">шт</p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg text-center">
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Зарезерв.</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{scanResult.stats?.reserved || 0}</p>
                    <p className="text-xs text-amber-500">шт</p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg text-center">
                    <p className="text-xs text-red-600 dark:text-red-400 mb-1">В ремонте</p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">{scanResult.stats?.inRepair || 0}</p>
                    <p className="text-xs text-red-500">шт</p>
                  </div>
                </div>
                
                {item.length && (
                  <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                    <div className="w-10 h-10 bg-background rounded-full flex items-center justify-center">
                      <span className="text-lg">📏</span>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Длина кабеля</p>
                      <p className="text-xl font-bold">{item.length} м</p>
                    </div>
                  </div>
                )}
                
                {item.notes && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Примечания</p>
                    <p className="font-medium">{item.notes}</p>
                  </div>
                )}
                
                {item.qr_code && (
                  <div className="text-sm text-muted-foreground md:hidden">
                    QR: <code className="bg-muted px-2 py-1 rounded">{item.qr_code}</code>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* История (видна только на десктопе) */}
            <Card className="hidden lg:block">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Информация и история
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Минимальный остаток */}
                {item.min_quantity > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">Минимальный остаток:</span>
                    <span className="font-medium">{item.min_quantity} шт</span>
                  </div>
                )}
                
                {/* История выдач */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <span>📦</span>
                    История выдач 
                    <Badge variant="secondary">{scanResult.stats?.issued || 0} шт</Badge>
                  </h4>
                  
                  {submitting ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin h-6 w-6 border-b-2 border-primary rounded-full"></div>
                    </div>
                  ) : movementsDetails.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 bg-muted rounded-lg">Нет записей о выдаче</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {movementsDetails.map((m, idx) => (
                        <div key={m.id || idx} className={`p-3 rounded-lg ${m.is_returned ? 'bg-green-50 dark:bg-green-950' : 'bg-blue-50 dark:bg-blue-950'}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{m.issued_to || '—'}</p>
                              <p className="text-xs text-muted-foreground">
                                {m.contact && `Контакт: ${m.contact}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`text-sm font-bold ${m.is_returned ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {m.quantity} шт
                              </span>
                              {m.is_returned && (
                                <p className="text-xs text-green-600">✓ Возвращено</p>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(m.created_at).toLocaleDateString('ru-RU')}
                            {m.is_returned && m.returned_at && (
                              <span className="text-green-600"> → возврат {new Date(m.returned_at).toLocaleDateString('ru-RU')}</span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Резервы */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <span>🔒</span>
                    Зарезервировано в сметах
                    <Badge variant="secondary">{reservationsDetails.reduce((sum, r) => sum + (r.quantity || 0), 0)} шт</Badge>
                  </h4>
                  
                  {reservationsDetails.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 bg-muted rounded-lg">Нет активных резервов</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {reservationsDetails.map((r, idx) => (
                        <div key={idx} className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                          <div className="flex justify-between items-start">
                            <p className="font-medium text-sm">{r.estimates?.event_name || '—'}</p>
                            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                              {r.quantity} шт
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {r.estimates?.event_date && new Date(r.estimates.event_date).toLocaleDateString('ru-RU')}
                            {r.estimates?.event_end_date && r.estimates.event_date !== r.estimates.event_end_date && 
                              ` - ${new Date(r.estimates.event_end_date).toLocaleDateString('ru-RU')}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Правая колонка: быстрые действия */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Быстрые действия</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={handleShowInfo}
                >
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mr-3">
                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Информация</p>
                    <p className="text-xs text-muted-foreground">Подробности и история</p>
                  </div>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={() => setActiveAction('checklist')}
                >
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mr-3">
                    <ClipboardCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">В чеклист</p>
                    <p className="text-xs text-muted-foreground">Добавить в мероприятие</p>
                  </div>
                </Button>
                
                <Button 
                  variant="default" 
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={() => setActiveAction('issue')}
                >
                  <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center mr-3">
                    <ArrowUpRight className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Выдать</p>
                    <p className="text-xs text-muted-foreground">Выдать оборудование</p>
                  </div>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start h-auto py-3 px-4 border-yellow-500/30 hover:bg-yellow-50 dark:hover:bg-yellow-950"
                  onClick={() => setActiveAction('repair')}
                >
                  <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center mr-3">
                    <Wrench className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">В ремонт</p>
                    <p className="text-xs text-muted-foreground">Отправить на ремонт</p>
                  </div>
                </Button>
              </CardContent>
            </Card>
            
            {/* Мобильная история (видна только на мобильных) */}
            <Card className="lg:hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Информация</CardTitle>
              </CardHeader>
              <CardContent>
                {item.min_quantity > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg mb-4">
                    <span className="text-sm text-muted-foreground">Минимальный остаток:</span>
                    <span className="font-medium">{item.min_quantity} шт</span>
                  </div>
                )}
                

              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Диалог выдачи */}
        <Dialog open={activeAction === 'issue'} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-md sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5" />
                Выдача оборудования
              </DialogTitle>
              <DialogDescription>
                {item.name || 'Оборудование'} — доступно {scanResult.stats?.inStock ?? 0} шт
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Кому выдаётся *</Label>
                <Input
                  placeholder="ФИО или название организации"
                  value={issueForm.issued_to}
                  onChange={(e) => setIssueForm({ ...issueForm, issued_to: e.target.value })}
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Контакт</Label>
                <Input
                  placeholder="Телефон или email"
                  value={issueForm.contact}
                  onChange={(e) => setIssueForm({ ...issueForm, contact: e.target.value })}
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Количество (макс. {scanResult.stats?.inStock ?? 0})</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIssueForm({ ...issueForm, quantity: Math.max(1, issueForm.quantity - 1) })}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={scanResult.stats?.inStock ?? 0}
                    value={issueForm.quantity}
                    onChange={(e) => setIssueForm({ ...issueForm, quantity: parseInt(e.target.value) || 1 })}
                    className="text-center h-11"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIssueForm({ ...issueForm, quantity: Math.min(scanResult.stats?.inStock ?? 0, issueForm.quantity + 1) })}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setActiveAction(null)} className="w-full sm:w-auto">Отмена</Button>
              <Button 
                onClick={handleQuickIssue} 
                disabled={submitting || !issueForm.issued_to.trim()}
                className="w-full sm:w-auto"
              >
                {submitting ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full mr-2" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                )}
                Выдать {issueForm.quantity > 1 && `${issueForm.quantity} шт`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Диалог ремонта */}
        <Dialog open={activeAction === 'repair'} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-md sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Отправка в ремонт
              </DialogTitle>
              <DialogDescription>
                {item.name || 'Оборудование'} — доступно {scanResult.stats?.inStock ?? 0} шт
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Причина ремонта *</Label>
                <Input
                  placeholder="Описание неисправности"
                  value={repairForm.reason}
                  onChange={(e) => setRepairForm({ ...repairForm, reason: e.target.value })}
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Количество (макс. {scanResult.stats?.inStock ?? 0})</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setRepairForm({ ...repairForm, quantity: Math.max(1, repairForm.quantity - 1) })}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={scanResult.stats?.inStock ?? 0}
                    value={repairForm.quantity}
                    onChange={(e) => setRepairForm({ ...repairForm, quantity: parseInt(e.target.value) || 1 })}
                    className="text-center h-11"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setRepairForm({ ...repairForm, quantity: Math.min(scanResult.stats?.inStock ?? 0, repairForm.quantity + 1) })}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setActiveAction(null)} className="w-full sm:w-auto">Отмена</Button>
              <Button 
                onClick={handleQuickRepair} 
                disabled={submitting || !repairForm.reason.trim()}
                className="w-full sm:w-auto"
              >
                {submitting ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full mr-2" />
                ) : (
                  <Wrench className="w-4 h-4 mr-2" />
                )}
                В ремонт {repairForm.quantity > 1 && `${repairForm.quantity} шт`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Диалог информации */}
        <Dialog open={activeAction === 'info'} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Информация об оборудовании</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">На складе</p>
                  <p className="text-2xl font-bold">{item.quantity}</p>
                </div>
                {item.length && (
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Длина</p>
                    <p className="text-2xl font-bold">{item.length} м</p>
                  </div>
                )}
              </div>
              
              {item.min_quantity > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Минимальный остаток</p>
                  <p className="font-medium">{item.min_quantity} шт</p>
                </div>
              )}
              
              {item.notes && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Примечания</p>
                  <p className="font-medium">{item.notes}</p>
                </div>
              )}
              
              {item.qr_code && (
                <div className="text-sm text-muted-foreground">
                  QR: <code className="bg-muted px-2 py-1 rounded">{item.qr_code}</code>
                </div>
              )}
              
              {/* Список выдач */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">
                  История выдач 
                  <span className="text-sm text-muted-foreground">
                    (активных: {scanResult.stats?.issued || 0}
                    {scanResult.stats?.totalIssued && scanResult.stats.totalIssued !== scanResult.stats.issued && (
                      <>, всего: {scanResult.stats.totalIssued}</>
                    )})
                  </span>
                </h4>
                
                {submitting ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin h-6 w-6 border-b-2 border-primary rounded-full"></div>
                  </div>
                ) : movementsDetails.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Нет записей о выдаче</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {movementsDetails.map((m, idx) => (
                      <div key={m.id || idx} className={`p-3 rounded-lg ${m.is_returned ? 'bg-green-50 dark:bg-green-950' : 'bg-blue-50 dark:bg-blue-950'}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{m.issued_to || '—'}</p>
                            <p className="text-xs text-muted-foreground">
                              {m.contact && `Контакт: ${m.contact}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-bold ${m.is_returned ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                              {m.quantity} шт
                            </span>
                            {m.is_returned && (
                              <p className="text-xs text-green-600">✓ Возвращено</p>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(m.created_at).toLocaleDateString('ru-RU')}
                          {m.is_returned && m.returned_at && (
                            <span className="text-green-600"> → возврат {new Date(m.returned_at).toLocaleDateString('ru-RU')}</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Список резервов в сметах */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Зарезервировано в сметах ({reservationsDetails.reduce((sum, r) => sum + (r.quantity || 0), 0)} шт)</h4>
                
                {reservationsDetails.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Нет активных резервов</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {reservationsDetails.map((r, idx) => (
                      <div key={idx} className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                        <div className="flex justify-between items-start">
                          <p className="font-medium text-sm">{r.estimates?.event_name || '—'}</p>
                          <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                            {r.quantity} шт
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {r.estimates?.event_date && new Date(r.estimates.event_date).toLocaleDateString('ru-RU')}
                          {r.estimates?.event_end_date && r.estimates.event_date !== r.estimates.event_end_date && 
                            ` - ${new Date(r.estimates.event_end_date).toLocaleDateString('ru-RU')}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Список ремонтов */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">В ремонте ({repairsDetails.filter(r => r.status !== 'returned').reduce((sum, r) => sum + (r.quantity || 0), 0)} шт)</h4>
                
                {repairsDetails.filter(r => r.status !== 'returned').length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Нет оборудования в ремонте</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {repairsDetails.filter(r => r.status !== 'returned').map((r, idx) => (
                      <div key={idx} className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{r.reason || 'Ремонт'}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleDateString('ru-RU')}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-red-600 dark:text-red-400">
                            {r.quantity} шт
                          </span>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full mt-2"
                          onClick={() => handleReturnFromRepair(r.id)}
                          disabled={submitting}
                        >
                          <Package className="w-4 h-4 mr-2" />
                          Вернуть на склад
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={() => setActiveAction(null)}>Закрыть</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Если есть initialCode но результат ещё не получен - показываем загрузку
  if (effectiveInitialCode && !scanResult) {
    return (
      <div className="space-y-4 max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold">QR Сканер</h2>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
          <span className="text-muted-foreground">Поиск оборудования: {initialCode}...</span>
        </div>
        <Button onClick={handleScanAgain} variant="outline" className="w-full">
          <Scan className="w-4 h-4 mr-2" />
          Сканировать снова
        </Button>
      </div>
    );
  }

  // Fallback - если есть scanResult но мы сюда дошли, значит тип неизвестен
  if (scanResult) {
    console.log('[QRScan] Fallback with scanResult:', scanResult.type);
    return (
      <div className="space-y-4 max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold">QR Сканер</h2>
        <p className="text-muted-foreground text-red-500">
          Неизвестный тип результата: {scanResult.type}
        </p>
        <Button onClick={handleScanAgain} variant="outline" className="w-full">
          <Scan className="w-4 h-4 mr-2" />
          Сканировать снова
        </Button>
      </div>
    );
  }

  // Fallback - показываем кнопку для начала сканирования
  return (
    <div className="space-y-4 max-w-md mx-auto text-center">
      <h2 className="text-2xl font-bold">QR Сканер</h2>
      <p className="text-muted-foreground">
        Нажмите кнопку ниже чтобы отсканировать QR-код
      </p>
      <Button onClick={handleScanAgain} className="w-full">
        <Scan className="w-4 h-4 mr-2" />
        Начать сканирование
      </Button>
    </div>
  );
}
