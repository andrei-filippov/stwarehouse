import { useState, useMemo, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { QRScanner } from './QRScanner';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  QrCode, 
  Package, 
  Truck, 
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { ChecklistV2, ChecklistItemV2, ChecklistScanMode } from '../types/checklist';
import { supabase } from '../lib/supabase';

interface ChecklistDetailProps {
  checklist: ChecklistV2;
  onBack: () => void;
  onUpdate: () => void; // Обновить данные
}

export function ChecklistDetail({ checklist, onBack, onUpdate }: ChecklistDetailProps) {
  const [scanMode, setScanMode] = useState<ChecklistScanMode>('view');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanningKit, setScanningKit] = useState(false);

  // Статистика
  const stats = useMemo(() => {
    const items = checklist.items || [];
    return {
      total: items.length,
      loaded: items.filter(i => i.loaded).length,
      unloaded: items.filter(i => i.unloaded).length,
      byCategory: items.reduce((acc, item) => {
        const cat = item.category || 'Без категории';
        if (!acc[cat]) acc[cat] = { total: 0, loaded: 0, unloaded: 0 };
        acc[cat].total++;
        if (item.loaded) acc[cat].loaded++;
        if (item.unloaded) acc[cat].unloaded++;
        return acc;
      }, {} as Record<string, { total: number; loaded: number; unloaded: number }>)
    };
  }, [checklist.items]);

  // Обработка сканирования QR
  const handleQRScan = useCallback(async (qrCode: string) => {
    try {
      if (scanningKit) {
        // Сканируем комплект
        const { data, error } = await supabase.rpc('mark_kit_loaded', {
          p_kit_qr: qrCode,
          p_checklist_id: checklist.id
        });
        
        if (error) throw error;
        
        const count = data?.[0]?.item_count || 0;
        toast.success(`Комплект отмечен`, { description: `Отмечено ${count} позиций` });
      } else if (scanMode === 'load') {
        // Отмечаем погрузку
        const { data, error } = await supabase.rpc('mark_item_loaded', {
          p_qr_code: qrCode,
          p_checklist_id: checklist.id
        });
        
        if (error) throw error;
        
        const result = data?.[0];
        if (result?.already_loaded) {
          toast.info('Уже погружено', { description: result.item_name });
        } else {
          toast.success('Погружено', { description: result?.item_name });
        }
      } else if (scanMode === 'unload') {
        // Отмечаем разгрузку
        const { data, error } = await supabase.rpc('mark_item_unloaded', {
          p_qr_code: qrCode,
          p_checklist_id: checklist.id
        });
        
        if (error) throw error;
        
        const result = data?.[0];
        if (result?.already_unloaded) {
          toast.info('Уже разгружено', { description: result.item_name });
        } else {
          toast.success('Разгружено', { description: result?.item_name });
        }
      }
      
      // Обновляем данные
      onUpdate();
    } catch (err: any) {
      toast.error('Ошибка', { description: err.message });
    }
  }, [checklist.id, scanMode, scanningKit, onUpdate]);

  // Группировка по категориям
  const groupedItems = useMemo(() => {
    const groups: Record<string, ChecklistItemV2[]> = {};
    checklist.items?.forEach(item => {
      const cat = item.category || 'Без категории';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [checklist.items]);

  const canLoad = scanMode === 'load';
  const canUnload = scanMode === 'unload';

  return (
    <div className="space-y-4">
      {/* Шапка */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{checklist.event_name}</h2>
          <p className="text-sm text-gray-500">{checklist.event_date}</p>
        </div>
      </div>

      {/* Прогресс */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Погрузка
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={(stats.loaded / stats.total) * 100} className="mb-2" />
            <p className="text-sm text-gray-600">
              {stats.loaded} / {stats.total} позиций
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Разгрузка
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={(stats.unloaded / stats.total) * 100} className="mb-2" />
            <p className="text-sm text-gray-600">
              {stats.unloaded} / {stats.total} позиций
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Режимы сканирования */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={scanMode === 'load' ? 'default' : 'outline'}
          onClick={() => {
            setScanMode('load');
            setScanningKit(false);
            setIsScannerOpen(true);
          }}
          disabled={stats.loaded === stats.total}
        >
          <Truck className="w-4 h-4 mr-2" />
          Сканировать погрузку
        </Button>
        
        <Button
          variant={scanMode === 'unload' ? 'default' : 'outline'}
          onClick={() => {
            setScanMode('unload');
            setScanningKit(false);
            setIsScannerOpen(true);
          }}
          disabled={stats.unloaded === stats.total}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Сканировать разгрузку
        </Button>

        <Button
          variant={scanningKit ? 'default' : 'outline'}
          onClick={() => {
            setScanningKit(true);
            setIsScannerOpen(true);
          }}
        >
          <Package className="w-4 h-4 mr-2" />
          Сканировать комплект
        </Button>
      </div>

      {/* Список по категориям */}
      <div className="space-y-4">
        {Object.entries(groupedItems).map(([category, items]) => (
          <Card key={category}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{category}</CardTitle>
                <Badge variant="outline">
                  {items.filter(i => i.loaded).length}/{items.length} погружено
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map(item => (
                <div 
                  key={item.id} 
                  className={`flex items-center justify-between p-2 rounded-lg border ${
                    item.unloaded ? 'bg-green-50 border-green-200' :
                    item.loaded ? 'bg-blue-50 border-blue-200' :
                    'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Чекбокс погрузки */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">Погр.</span>
                      {item.loaded ? (
                        <CheckCircle2 className="w-5 h-5 text-blue-500" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
                      )}
                    </div>
                    
                    {/* Чекбокс разгрузки */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">Разгр.</span>
                      {item.unloaded ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
                      )}
                    </div>

                    <div className="ml-2">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} шт.
                        {item.qr_code && ` • ${item.qr_code}`}
                        {item.kit_name && ` • Комплект: ${item.kit_name}`}
                      </p>
                    </div>
                  </div>

                  {/* Иконки статуса */}
                  <div className="flex gap-1">
                    {item.kit_id && (
                      <Package className="w-4 h-4 text-purple-500" title="В комплекте" />
                    )}
                    {item.qr_code && (
                      <QrCode className="w-4 h-4 text-gray-400" title="Есть QR-код" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* QR Scanner */}
      <QRScanner
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          setScanMode('view');
          setScanningKit(false);
        }}
        onScan={handleQRScan}
        title={scanningKit ? 'Сканировать комплект' : canLoad ? 'Погрузка' : canUnload ? 'Разгрузка' : 'Сканирование'}
        subtitle={scanningKit ? 'Наведите на QR-код кофра' : 'Наведите на QR-код оборудования'}
        keepOpen={true}
      />
    </div>
  );
}
