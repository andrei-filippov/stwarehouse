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
  ArrowUpRight
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
  | { type: 'inventory'; data: CableInventory; category?: CableCategory; stats?: { total: number; inStock: number; issued: number; inRepair: number } }
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
  const [submitting, setSubmitting] = useState(false);

  // Загружаем инвентарь и комплекты
  useEffect(() => {
    const fetchData = async () => {
      if (!companyId) return;
      
      setLoading(true);
      const [{ data: invData }, { data: kitsData }] = await Promise.all([
        supabase.from('cable_inventory').select('*').eq('company_id', companyId),
        supabase.from('equipment_kits').select('*, items:kit_items(*)').eq('company_id', companyId)
      ]);
      
      if (invData) setInventory(invData);
      if (kitsData) setKits(kitsData);
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
        const [{ data: movements }, { data: repairs }] = await Promise.all([
          supabase
            .from('cable_movements')
            .select('quantity')
            .eq('inventory_id', item.id)
            .eq('type', 'issue'),
          supabase
            .from('equipment_repairs')
            .select('quantity')
            .eq('inventory_id', item.id)
            .not('status', 'eq', 'returned')
        ]);
        
        console.log('[QRScan] Stats received:', { movements: movements?.length || 0, repairs: repairs?.length || 0 });
        
        const issuedQty = movements?.reduce((sum, m) => sum + (m.quantity || 0), 0) || 0;
        const repairQty = repairs?.reduce((sum, r) => sum + (r.quantity || 0), 0) || 0;
        
        console.log('[QRScan] Setting isScanning to false FIRST');
        setIsScanning(false);
        
        console.log('[QRScan] Setting scan result...');
        setScanResult({ 
          type: 'inventory', 
          data: item, 
          category,
          stats: {
            total: item.quantity + issuedQty + repairQty,
            inStock: item.quantity,
            issued: issuedQty,
            inRepair: repairQty
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
            total: item.quantity,
            inStock: item.quantity,
            issued: 0,
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
    if (issueForm.quantity > item.quantity) {
      toast.error('Нельзя выдать больше, чем есть на складе');
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

  console.log('[QRScan] Render state:', { loading, isScanning, scanResultType: scanResult?.type });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Результат сканирования - отображаем ПЕРЕД режимом сканирования
  // если есть результат, показываем его
  if (scanResult?.type === 'inventory') {
    const item = scanResult.data;
    const category = scanResult.category;
    
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={handleScanAgain}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Новое сканирование
          </Button>
          <Badge>{category?.name || 'Оборудование'}</Badge>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {item.name || 'Оборудование'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Статистика по оборудованию */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                <p className="text-xs text-blue-600 dark:text-blue-400">Всего</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{scanResult.stats?.total || item.quantity}</p>
                <p className="text-xs text-blue-500">шт</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                <p className="text-xs text-green-600 dark:text-green-400">На складе</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">{scanResult.stats?.inStock || item.quantity}</p>
                <p className="text-xs text-green-500">шт</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg text-center">
                <p className="text-xs text-amber-600 dark:text-amber-400">Выдано</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{scanResult.stats?.issued || 0}</p>
                <p className="text-xs text-amber-500">шт</p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg text-center">
                <p className="text-xs text-red-600 dark:text-red-400">В ремонте</p>
                <p className="text-xl font-bold text-red-700 dark:text-red-300">{scanResult.stats?.inRepair || 0}</p>
                <p className="text-xs text-red-500">шт</p>
              </div>
            </div>
            
            {item.length && (
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Длина</p>
                <p className="text-xl font-bold">{item.length} м</p>
              </div>
            )}
            
            {item.qr_code && (
              <div className="text-sm text-muted-foreground text-center">
                QR: <code className="bg-muted px-2 py-1 rounded">{item.qr_code}</code>
              </div>
            )}
            
            <div className="pt-4 border-t space-y-2">
              <h4 className="font-medium text-sm">Быстрые действия:</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setActiveAction('info')}>
                  <Info className="w-4 h-4 mr-2" />
                  Информация
                </Button>
                <Button variant="outline" onClick={() => setActiveAction('checklist')}>
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  В чеклист
                </Button>
                <Button variant="outline" onClick={() => setActiveAction('issue')}>
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Выдать
                </Button>
                <Button variant="outline" onClick={() => setActiveAction('repair')}>
                  <Wrench className="w-4 h-4 mr-2" />
                  В ремонт
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Диалог выдачи */}
        <Dialog open={activeAction === 'issue'} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Выдача оборудования</DialogTitle>
              <DialogDescription>
                {item.name || 'Оборудование'} — на складе {item.quantity} шт
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Кому выдаётся *</Label>
                <Input
                  placeholder="ФИО или название"
                  value={issueForm.issued_to}
                  onChange={(e) => setIssueForm({ ...issueForm, issued_to: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Контакт</Label>
                <Input
                  placeholder="Телефон или email"
                  value={issueForm.contact}
                  onChange={(e) => setIssueForm({ ...issueForm, contact: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Количество</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIssueForm({ ...issueForm, quantity: Math.max(1, issueForm.quantity - 1) })}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={item.quantity}
                    value={issueForm.quantity}
                    onChange={(e) => setIssueForm({ ...issueForm, quantity: parseInt(e.target.value) || 1 })}
                    className="text-center"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIssueForm({ ...issueForm, quantity: Math.min(item.quantity, issueForm.quantity + 1) })}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveAction(null)}>
                Отмена
              </Button>
              <Button 
                onClick={handleIssue}
                disabled={!issueForm.issued_to.trim() || submitting}
              >
                {submitting ? 'Выдача...' : 'Выдать'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Диалог ремонта */}
        <Dialog open={activeAction === 'repair'} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Передача в ремонт</DialogTitle>
              <DialogDescription>
                {item.name || 'Оборудование'} — на складе {item.quantity} шт
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Причина ремонта</Label>
                <Input
                  placeholder="Описание неисправности"
                  value={repairForm.reason}
                  onChange={(e) => setRepairForm({ ...repairForm, reason: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Количество</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRepairForm({ ...repairForm, quantity: Math.max(1, repairForm.quantity - 1) })}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={item.quantity}
                    value={repairForm.quantity}
                    onChange={(e) => setRepairForm({ ...repairForm, quantity: parseInt(e.target.value) || 1 })}
                    className="text-center"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRepairForm({ ...repairForm, quantity: Math.min(item.quantity, repairForm.quantity + 1) })}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveAction(null)}>
                Отмена
              </Button>
              <Button 
                variant="destructive"
                onClick={handleRepair}
                disabled={submitting}
              >
                {submitting ? 'Отправка...' : 'В ремонт'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Диалог информации */}
        <Dialog open={activeAction === 'info'} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Информация об оборудовании</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Наименование</p>
                  <p className="font-medium">{item.name || '—'}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Категория</p>
                  <p className="font-medium">{category?.name || '—'}</p>
                </div>
                {item.length && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Длина</p>
                    <p className="font-medium">{item.length} м</p>
                  </div>
                )}
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">QR-код</p>
                  <p className="font-medium">{item.qr_code || '—'}</p>
                </div>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">ID в системе</p>
                <code className="text-xs">{item.id}</code>
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={() => setActiveAction(null)}>
                Закрыть
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Диалог чеклиста */}
        <Dialog open={activeAction === 'checklist'} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Добавить в чеклист</DialogTitle>
              <DialogDescription>
                Выберите чеклист для добавления оборудования
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {checklists.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Нет активных чеклистов
                </p>
              ) : (
                checklists.map((checklist) => (
                  <Button
                    key={checklist.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleAddToChecklist(checklist.id)}
                  >
                    <ClipboardCheck className="w-4 h-4 mr-2" />
                    {checklist.event_name}
                  </Button>
                ))
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveAction(null)}>
                Отмена
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Режим сканирования
  if (isScanning) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Scan className="w-6 h-6" />
            Сканер QR-кода
          </h2>
        </div>
        
        <QRScanner
          isOpen={true}
          onClose={() => {
            // При закрытии сканера сбрасываем состояние
            console.log('[QRScan] QRScanner onClose called, scanResult:', scanResult?.type);
            setIsScanning(false);
            onTabChange?.('dashboard');
          }}
          onScan={handleScan}
          title="Наведите камеру на QR-код"
          subtitle="Сканируйте оборудование или комплект"
          keepOpen={true}
        />
        
        <div className="text-center text-muted-foreground text-sm">
          <p>Наведите камеру на QR-код оборудования</p>
          <p className="text-xs mt-1">или введите код вручную</p>
        </div>
      </div>
    );
  }

  // Результат сканирования - не найдено
  if (scanResult?.type === 'not_found') {
    return (
      <div className="space-y-4 max-w-md mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={handleScanAgain}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
        </div>
        
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <X className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">QR-код не найден</h3>
            <p className="text-muted-foreground mb-4">
              <code className="bg-muted px-2 py-1 rounded">{scanResult.qrCode}</code>
            </p>
            <p className="text-sm text-muted-foreground">
              Этот QR-код не зарегистрирован в системе
            </p>
          </CardContent>
        </Card>
        
        <div className="flex gap-2">
          <Button onClick={handleScanAgain} className="flex-1">
            <Scan className="w-4 h-4 mr-2" />
            Сканировать снова
          </Button>
          <Button variant="outline" onClick={goToInventory}>
            <Package className="w-4 h-4 mr-2" />
            На склад
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
                <Button variant="outline" onClick={goToChecklists}>
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  В чеклист
                </Button>
                <Button variant="outline" onClick={goToInventory}>
                  <Package className="w-4 h-4 mr-2" />
                  На склад
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Результат сканирования - оборудование
  if (scanResult?.type === 'inventory') {
    const item = scanResult.data;
    const category = scanResult.category;
    
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={handleScanAgain}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Новое сканирование
          </Button>
          <Badge>{category?.name || 'Оборудование'}</Badge>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {item.name || 'Оборудование'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Статистика по оборудованию */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                <p className="text-xs text-blue-600 dark:text-blue-400">Всего</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{scanResult.stats?.total || item.quantity}</p>
                <p className="text-xs text-blue-500">шт</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                <p className="text-xs text-green-600 dark:text-green-400">На складе</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">{scanResult.stats?.inStock || item.quantity}</p>
                <p className="text-xs text-green-500">шт</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg text-center">
                <p className="text-xs text-amber-600 dark:text-amber-400">Выдано</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{scanResult.stats?.issued || 0}</p>
                <p className="text-xs text-amber-500">шт</p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg text-center">
                <p className="text-xs text-red-600 dark:text-red-400">В ремонте</p>
                <p className="text-xl font-bold text-red-700 dark:text-red-300">{scanResult.stats?.inRepair || 0}</p>
                <p className="text-xs text-red-500">шт</p>
              </div>
            </div>
            
            {item.length && (
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Длина</p>
                <p className="text-xl font-bold">{item.length} м</p>
              </div>
            )}
            
            {item.qr_code && (
              <div className="text-sm text-muted-foreground text-center">
                QR: <code className="bg-muted px-2 py-1 rounded">{item.qr_code}</code>
              </div>
            )}
            
            <div className="pt-4 border-t space-y-2">
              <h4 className="font-medium text-sm">Быстрые действия:</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setActiveAction('info')}>
                  <Info className="w-4 h-4 mr-2" />
                  Информация
                </Button>
                <Button variant="outline" onClick={() => setActiveAction('checklist')}>
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  В чеклист
                </Button>
                <Button variant="outline" onClick={() => setActiveAction('issue')}>
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Выдать
                </Button>
                <Button variant="outline" onClick={() => setActiveAction('repair')}>
                  <Wrench className="w-4 h-4 mr-2" />
                  В ремонт
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Диалог выдачи */}
        <Dialog open={activeAction === 'issue'} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Выдача оборудования</DialogTitle>
              <DialogDescription>
                {item.name || 'Оборудование'} — на складе {item.quantity} шт
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Кому выдаётся *</Label>
                <Input
                  placeholder="ФИО или название"
                  value={issueForm.issued_to}
                  onChange={(e) => setIssueForm({ ...issueForm, issued_to: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Контакт</Label>
                <Input
                  placeholder="Телефон или email"
                  value={issueForm.contact}
                  onChange={(e) => setIssueForm({ ...issueForm, contact: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Количество</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIssueForm({ ...issueForm, quantity: Math.max(1, issueForm.quantity - 1) })}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={item.quantity}
                    value={issueForm.quantity}
                    onChange={(e) => setIssueForm({ ...issueForm, quantity: parseInt(e.target.value) || 1 })}
                    className="text-center"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIssueForm({ ...issueForm, quantity: Math.min(item.quantity, issueForm.quantity + 1) })}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveAction(null)}>Отмена</Button>
              <Button onClick={handleQuickIssue} disabled={submitting}>
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Выдать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Диалог ремонта */}
        <Dialog open={activeAction === 'repair'} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Отправка в ремонт</DialogTitle>
              <DialogDescription>
                {item.name || 'Оборудование'} — на складе {item.quantity} шт
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Причина ремонта *</Label>
                <Input
                  placeholder="Описание неисправности"
                  value={repairForm.reason}
                  onChange={(e) => setRepairForm({ ...repairForm, reason: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Количество</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRepairForm({ ...repairForm, quantity: Math.max(1, repairForm.quantity - 1) })}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={item.quantity}
                    value={repairForm.quantity}
                    onChange={(e) => setRepairForm({ ...repairForm, quantity: parseInt(e.target.value) || 1 })}
                    className="text-center"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRepairForm({ ...repairForm, quantity: Math.min(item.quantity, repairForm.quantity + 1) })}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveAction(null)}>Отмена</Button>
              <Button onClick={handleQuickRepair} disabled={submitting}>
                <Wrench className="w-4 h-4 mr-2" />
                В ремонт
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Диалог информации */}
        <Dialog open={activeAction === 'info'} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-sm">
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
