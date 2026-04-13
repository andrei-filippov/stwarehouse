import { useState, useMemo, useCallback, useEffect } from 'react';
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

  // Загружаем профили пользователей для отображения кто погрузил/разгрузил
  const [actorProfiles, setActorProfiles] = useState<Record<string, { email?: string; full_name?: string }>>({});
  
  useEffect(() => {
    const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    
    const loadProfiles = async () => {
      const actorIds = [...new Set(
        (checklist.items || []).flatMap(i => [i.loaded_by, i.unloaded_by]).filter(Boolean)
      )] as string[];
      const uuidIds = actorIds.filter(isUuid);
      if (uuidIds.length === 0) return;
      
      const unknownIds = uuidIds.filter(id => !actorProfiles[id]);
      if (unknownIds.length === 0) return;
      
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', unknownIds);
        
        if (data) {
          setActorProfiles(prev => {
            const next = { ...prev };
            data.forEach((p: any) => {
              next[p.id] = { email: p.email, full_name: p.full_name };
            });
            return next;
          });
        }
      } catch {
        // ignore
      }
    };
    
    loadProfiles();
  }, [checklist.items]);
  
  const formatActor = (actorId?: string) => {
    if (!actorId) return null;
    const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    if (!isUuid(actorId)) return actorId;
    const profile = actorProfiles[actorId];
    return profile?.full_name || profile?.email || actorId.slice(0, 8);
  };

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
      const { getCurrentUserDisplayName } = await import('../lib/utils');
      const actor = await getCurrentUserDisplayName();
      const now = new Date().toISOString();
      
      if (scanningKit) {
        // Сканируем комплект - находим по QR и отмечаем все связанные позиции
        const { data: kitData, error: kitError } = await supabase
          .from('equipment_kits')
          .select('id, name')
          .eq('qr_code', qrCode.toUpperCase())
          .single();
        
        if (kitError || !kitData) throw new Error('Комплект не найден');
        
        // Загружаем содержимое комплекта
        const { data: kitItemsData } = await supabase
          .from('kit_items')
          .select('inventory_id, quantity, cable_inventory(name)')
          .eq('kit_id', kitData.id);
        
        const kitEquipmentNames = new Map<string, number>();
        kitItemsData?.forEach((item: any) => {
          const name = (item.cable_inventory as any)?.name?.toLowerCase().trim();
          if (name) kitEquipmentNames.set(name, (kitEquipmentNames.get(name) || 0) + (item.quantity || 1));
        });
        
        const checklistItemsByName = new Map<string, ChecklistItemV2[]>();
        for (const item of checklist.items || []) {
          const name = item.name.toLowerCase().trim();
          if (!checklistItemsByName.has(name)) checklistItemsByName.set(name, []);
          checklistItemsByName.get(name)!.push(item);
        }
        
        let updatedCount = 0;
        for (const [eqName, requiredQty] of kitEquipmentNames) {
          const matching = checklistItemsByName.get(eqName) || [];
          const byKitId = (checklist.items || []).filter(i => i.kit_id === kitData.id);
          const unique = [...matching, ...byKitId].filter((item, idx, self) => 
            idx === self.findIndex(i => i.id === item.id)
          );
          
          let remaining = requiredQty;
          for (const item of unique) {
            if (remaining <= 0) break;
            const target = item.quantity || 1;
            const current = item.loaded_quantity || (item.loaded ? target : 0);
            const canAdd = Math.min(remaining, target - current);
            if (canAdd > 0) {
              const newQty = current + canAdd;
              const { error } = await supabase.from('checklist_items').update({
                loaded: newQty >= target,
                loaded_quantity: newQty,
                loaded_by: actor,
                loaded_at: now
              }).eq('id', item.id!);
              if (!error) updatedCount++;
              remaining -= canAdd;
            }
          }
        }
        
        toast.success(`Комплект отмечен`, { description: `Отмечено ${updatedCount} позиций` });
      } else if (scanMode === 'load') {
        // Отмечаем погрузку
        const item = checklist.items?.find(i => i.qr_code?.toUpperCase() === qrCode.toUpperCase());
        if (!item) throw new Error('Позиция не найдена в чеклисте');
        
        const target = item.quantity || 1;
        const current = item.loaded_quantity || (item.loaded ? target : 0);
        
        if (current >= target) {
          toast.info('Уже погружено', { description: item.name });
        } else {
          const newQty = current + 1;
          const { error } = await supabase.from('checklist_items').update({
            loaded: newQty >= target,
            loaded_quantity: newQty,
            loaded_by: actor,
            loaded_at: now
          }).eq('id', item.id!);
          
          if (error) throw error;
          toast.success('Погружено', { description: item.name });
        }
      } else if (scanMode === 'unload') {
        // Отмечаем разгрузку
        const item = checklist.items?.find(i => i.qr_code?.toUpperCase() === qrCode.toUpperCase());
        if (!item) throw new Error('Позиция не найдена в чеклисте');
        
        const target = item.quantity || 1;
        const current = item.unloaded_quantity || (item.unloaded ? target : 0);
        
        if (current >= target) {
          toast.info('Уже разгружено', { description: item.name });
        } else {
          const newQty = current + 1;
          const { error } = await supabase.from('checklist_items').update({
            unloaded: newQty >= target,
            unloaded_quantity: newQty,
            unloaded_by: actor,
            unloaded_at: now,
            loaded: true,
            loaded_quantity: item.loaded_quantity || target
          }).eq('id', item.id!);
          
          if (error) throw error;
          toast.success('Разгружено', { description: item.name });
        }
      }
      
      // Обновляем данные
      onUpdate();
    } catch (err: any) {
      toast.error('Ошибка', { description: err.message });
    }
  }, [checklist.id, checklist.items, scanMode, scanningKit, onUpdate]);

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
                      {(item.loaded_by || item.unloaded_by) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.unloaded_by ? `Разгрузил: ${formatActor(item.unloaded_by)}` : item.loaded_by ? `Загрузил: ${formatActor(item.loaded_by)}` : ''}
                        </p>
                      )}
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
