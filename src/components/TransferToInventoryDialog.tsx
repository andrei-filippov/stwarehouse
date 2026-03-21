import { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Package, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Equipment } from '../types';

interface TransferItem {
  equipment: Equipment;
  price: number;
  selected: boolean;
}

interface TransferToInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment[];
  targetCategories: { id: string; name: string }[];
  existingInventory: { name: string; category_id: string }[];
  onTransfer: (items: { 
    name: string; 
    description: string; 
    quantity: number; 
    category_id: string;
    price: number;
    unit: string;
  }[]) => Promise<{ error: any }>;
}

export function TransferToInventoryDialog({
  open,
  onOpenChange,
  equipment,
  targetCategories,
  existingInventory,
  onTransfer
}: TransferToInventoryDialogProps) {
  const [items, setItems] = useState<TransferItem[]>(() => 
    equipment.map(eq => ({
      equipment: eq,
      price: 0,
      selected: true
    }))
  );
  const [isTransferring, setIsTransferring] = useState(false);

  // Проверка на дубли (по названию + категории)
  const duplicates = useMemo(() => {
    const existingSet = new Set(existingInventory.map(i => `${i.name.toLowerCase()}_${i.category_id}`));
    
    return items.reduce((acc, item) => {
      const categoryId = targetCategories.find(c => c.name === item.equipment.category)?.id;
      if (categoryId) {
        const key = `${item.equipment.name.toLowerCase()}_${categoryId}`;
        acc[item.equipment.id] = existingSet.has(key);
      }
      return acc;
    }, {} as Record<string, boolean>);
  }, [items, targetCategories, existingInventory]);

  // Группировка по категориям
  const groupedByCategory = useMemo(() => {
    return items.reduce((acc, item) => {
      const category = item.equipment.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {} as Record<string, TransferItem[]>);
  }, [items]);

  const selectedCount = items.filter(i => i.selected).length;
  const duplicatesCount = items.filter(i => i.selected && duplicates[i.equipment.id]).length;

  const toggleSelection = (equipmentId: string) => {
    setItems(prev => prev.map(item => 
      item.equipment.id === equipmentId 
        ? { ...item, selected: !item.selected }
        : item
    ));
  };

  const updatePrice = (equipmentId: string, price: number) => {
    setItems(prev => prev.map(item => 
      item.equipment.id === equipmentId 
        ? { ...item, price }
        : item
    ));
  };

  const handleTransfer = async () => {
    const selectedItems = items.filter(i => i.selected);
    
    if (selectedItems.length === 0) {
      toast.error('Выберите оборудование для переноса');
      return;
    }

    // Проверка что все выбранные позиции имеют цену
    const withoutPrice = selectedItems.filter(i => i.price <= 0);
    if (withoutPrice.length > 0) {
      toast.error(`Укажите цену для ${withoutPrice.length} позиций`);
      return;
    }

    // Формируем данные для переноса
    const transferData = selectedItems.map(item => {
      const category = targetCategories.find(c => c.name === item.equipment.category);
      return {
        name: item.equipment.name,
        description: item.equipment.description,
        quantity: item.equipment.quantity,
        category_id: category?.id || '',
        price: item.price,
        unit: item.equipment.unit || 'шт'
      };
    });

    setIsTransferring(true);
    const { error } = await onTransfer(transferData);
    setIsTransferring(false);

    if (!error) {
      toast.success(`Перенесено ${selectedItems.length} позиций`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95%] max-h-[85vh] overflow-y-auto rounded-xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Перенос во вкладку "Оборудование"
          </DialogTitle>
          <DialogDescription>
            Выберите оборудование и укажите цены аренды. 
            Данные будут перенесены с сохранением категории, описания и количества.
          </DialogDescription>
        </DialogHeader>

        {duplicatesCount > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <strong>Внимание:</strong> {duplicatesCount} позиций уже существуют во вкладке "Оборудование".
              При переносе будут созданы дубликаты.
            </div>
          </div>
        )}

        <div className="space-y-4">
          {Object.entries(groupedByCategory).map(([category, categoryItems]) => (
            <div key={category} className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 font-medium text-sm border-b">
                Категория: {category}
              </div>
              <div className="divide-y">
                {categoryItems.map((item) => {
                  const isDuplicate = duplicates[item.equipment.id];
                  return (
                    <div 
                      key={item.equipment.id}
                      className={`p-4 flex items-center gap-4 ${!item.selected ? 'opacity-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleSelection(item.equipment.id)}
                        className="w-5 h-5 rounded border-gray-300"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{item.equipment.name}</span>
                          {isDuplicate && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Уже есть
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {item.equipment.description || '—'}
                        </p>
                        <p className="text-xs text-gray-400">
                          Количество: {item.equipment.quantity} {item.equipment.unit || 'шт'}
                        </p>
                      </div>

                      <div className="w-32 shrink-0">
                        <Label className="text-xs text-gray-500">Цена аренды (₽)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.price || ''}
                          onChange={(e) => updatePrice(item.equipment.id, parseFloat(e.target.value) || 0)}
                          disabled={!item.selected}
                          placeholder="0"
                          className="h-8"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex justify-between items-center sm:justify-between">
          <div className="text-sm text-gray-500">
            Выбрано: <strong>{selectedCount}</strong> из {items.length}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleTransfer}
              disabled={selectedCount === 0 || isTransferring}
            >
              {isTransferring ? 'Перенос...' : `Перенести ${selectedCount}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
