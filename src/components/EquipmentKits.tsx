import { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { QRCodeDisplay } from './QRCodeDisplay';
import { toast } from 'sonner';
import { Package, Plus, Trash2, QrCode, Edit2 } from 'lucide-react';
import type { EquipmentKit, CableInventory } from '../types';

interface EquipmentKitsProps {
  kits: EquipmentKit[];
  inventory: CableInventory[];
  onCreateKit: (kit: Partial<EquipmentKit>, itemIds: string[]) => Promise<{ error: any }>;
  onDeleteKit: (id: string) => Promise<{ error: any }>;
  companyId?: string;
}

export function EquipmentKits({ kits, inventory, onCreateKit, onDeleteKit, companyId }: EquipmentKitsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [kitName, setKitName] = useState('');
  const [kitDescription, setKitDescription] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showQR, setShowQR] = useState<EquipmentKit | null>(null);

  const handleCreate = async () => {
    if (!kitName.trim()) {
      toast.error('Введите название комплекта');
      return;
    }
    if (selectedItems.size === 0) {
      toast.error('Выберите оборудование для комплекта');
      return;
    }

    const result = await onCreateKit(
      { name: kitName, description: kitDescription },
      Array.from(selectedItems)
    );

    if (!result.error) {
      toast.success('Комплект создан');
      setIsDialogOpen(false);
      setKitName('');
      setKitDescription('');
      setSelectedItems(new Set());
    }
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Группировка оборудования по категориям
  const groupedInventory = useMemo(() => {
    const groups: Record<string, CableInventory[]> = {};
    inventory.forEach(item => {
      const cat = item.category_id || 'Без категории';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [inventory]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Комплекты оборудования</h3>
          <p className="text-sm text-gray-500">
            Создайте кофры для быстрой погрузки. Один QR-код = всё содержимое.
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Новый комплект
        </Button>
      </div>

      {/* Список комплектов */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kits.map(kit => (
          <Card key={kit.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-500" />
                  <CardTitle className="text-base">{kit.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  {kit.qr_code && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={() => setShowQR(kit)}
                    >
                      <QrCode className="w-4 h-4" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-red-500"
                    onClick={() => onDeleteKit(kit.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {kit.description && (
                <p className="text-sm text-gray-500 mb-2">{kit.description}</p>
              )}
              {kit.qr_code && (
                <p className="text-xs font-mono text-gray-400">{kit.qr_code}</p>
              )}
              <p className="text-sm text-gray-600 mt-2">
                {kit.items?.length || 0} позиций
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Диалог создания */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Создать комплект</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Название комплекта *</label>
              <Input 
                value={kitName}
                onChange={(e) => setKitName(e.target.value)}
                placeholder="Например: Кофр звук #1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Описание</label>
              <Input 
                value={kitDescription}
                onChange={(e) => setKitDescription(e.target.value)}
                placeholder="Что внутри, примечания"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Выберите оборудование * ({selectedItems.size} выбрано)
              </label>
              
              <div className="space-y-3 mt-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                {Object.entries(groupedInventory).map(([catId, items]) => (
                  <div key={catId}>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                      {catId === 'Без категории' ? catId : `Категория ${catId}`}
                    </p>
                    <div className="space-y-1">
                      {items.map(item => (
                        <label 
                          key={item.id} 
                          className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id!)}
                            onChange={() => toggleItem(item.id!)}
                            className="rounded"
                          />
                          <span className="text-sm">{item.name}</span>
                          <span className="text-xs text-gray-400 ml-auto">
                            {item.quantity} шт.
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreate} disabled={!kitName || selectedItems.size === 0}>
                Создать комплект
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR-код комплекта */}
      {showQR && showQR.qr_code && (
        <QRCodeDisplay
          value={showQR.qr_code}
          title={showQR.name}
          size={200}
        />
      )}
    </div>
  );
}
