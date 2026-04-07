import { useState, useEffect, useCallback } from 'react';
import { QRScanner } from './QRScanner';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  Scan, 
  Package, 
  ClipboardCheck, 
  Info,
  ArrowLeft,
  Plus,
  Minus,
  CheckCircle2,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { CableInventory, EquipmentKit, CableCategory } from '../types';
import type { ChecklistV2 } from '../types/checklist';

interface QRScanPageProps {
  companyId: string;
  categories?: CableCategory[];
  checklists?: ChecklistV2[];
  onTabChange?: (tab: string) => void;
}

type ScanResult = 
  | { type: 'inventory'; data: CableInventory; category?: CableCategory }
  | { type: 'kit'; data: EquipmentKit }
  | { type: 'not_found'; qrCode: string }
  | null;

export function QRScanPage({ companyId, categories = [], checklists = [], onTabChange }: QRScanPageProps) {
  const [isScanning, setIsScanning] = useState(true);
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [inventory, setInventory] = useState<CableInventory[]>([]);
  const [kits, setKits] = useState<EquipmentKit[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleScan = useCallback((qrCode: string) => {
    // Ищем комплект
    const kit = kits.find(k => k.qr_code === qrCode);
    if (kit) {
      setScanResult({ type: 'kit', data: kit });
      setIsScanning(false);
      return;
    }
    
    // Ищем оборудование
    const item = inventory.find(i => i.qr_code === qrCode);
    if (item) {
      const category = categories.find(c => c.id === item.category_id);
      setScanResult({ type: 'inventory', data: item, category });
      setIsScanning(false);
      return;
    }
    
    // Не найдено
    setScanResult({ type: 'not_found', qrCode });
    setIsScanning(false);
    toast.error('QR-код не найден', { 
      description: `${qrCode} не найден в базе` 
    });
  }, [inventory, kits, categories]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
          onClose={() => onTabChange?.('dashboard')}
          onScan={handleScan}
          title="Наведите камеру на QR-код"
          subtitle="Сканируйте оборудование или комплект"
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
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">На складе</p>
                <p className="text-2xl font-bold">{item.quantity}</p>
                <p className="text-xs text-muted-foreground">шт</p>
              </div>
              {item.length && (
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Длина</p>
                  <p className="text-2xl font-bold">{item.length}</p>
                  <p className="text-xs text-muted-foreground">м</p>
                </div>
              )}
            </div>
            
            {item.qr_code && (
              <div className="text-sm text-muted-foreground">
                QR: <code className="bg-muted px-2 py-1 rounded">{item.qr_code}</code>
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

  return null;
}
