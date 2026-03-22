import { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { QRCodeDisplay } from './QRCodeDisplay';
import { toast } from 'sonner';
import { Package, Plus, Trash2, QrCode, Edit2, Download, Printer } from 'lucide-react';
import type { EquipmentKit, CableInventory, CableCategory } from '../types';

interface EquipmentKitsProps {
  kits: EquipmentKit[];
  inventory: CableInventory[];
  categories: CableCategory[];
  onCreateKit: (kit: Partial<EquipmentKit>, itemIds: string[]) => Promise<{ error: any }>;
  onUpdateKit: (id: string, kit: Partial<EquipmentKit>, itemIds?: string[]) => Promise<{ error: any }>;
  onDeleteKit: (id: string) => Promise<{ error: any }>;
  companyId?: string;
}

export function EquipmentKits({ kits, inventory, categories, onCreateKit, onUpdateKit, onDeleteKit, companyId }: EquipmentKitsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingKitId, setEditingKitId] = useState<string | null>(null);
  const [kitName, setKitName] = useState('');
  const [kitDescription, setKitDescription] = useState('');
  // Map: inventory_id -> quantity (количество единиц в комплекте)
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
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

    // Преобразуем Map в массив с повторениями для сохранения в БД
    const itemIdsWithQuantity: string[] = [];
    selectedItems.forEach((quantity, inventoryId) => {
      for (let i = 0; i < quantity; i++) {
        itemIdsWithQuantity.push(inventoryId);
      }
    });

    const result = await onCreateKit(
      { name: kitName, description: kitDescription },
      itemIdsWithQuantity
    );

    if (!result.error) {
      toast.success('Комплект создан');
      closeDialog();
    }
  };

  const handleUpdate = async () => {
    if (!editingKitId) return;
    if (!kitName.trim()) {
      toast.error('Введите название комплекта');
      return;
    }

    // Преобразуем Map в массив с повторениями для сохранения в БД
    const itemIdsWithQuantity: string[] = [];
    selectedItems.forEach((quantity, inventoryId) => {
      for (let i = 0; i < quantity; i++) {
        itemIdsWithQuantity.push(inventoryId);
      }
    });

    const result = await onUpdateKit(
      editingKitId,
      { name: kitName, description: kitDescription },
      itemIdsWithQuantity
    );

    if (!result.error) {
      toast.success('Комплект обновлен');
      closeDialog();
    }
  };

  const openEditDialog = (kit: EquipmentKit) => {
    setIsEditMode(true);
    setEditingKitId(kit.id);
    setKitName(kit.name);
    setKitDescription(kit.description || '');
    // Устанавливаем выбранные items с количеством
    const kitItemsMap = new Map<string, number>();
    kit.items?.forEach(item => {
      const current = kitItemsMap.get(item.inventory_id) || 0;
      kitItemsMap.set(item.inventory_id, current + 1);
    });
    setSelectedItems(kitItemsMap);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setIsEditMode(false);
    setEditingKitId(null);
    setKitName('');
    setKitDescription('');
    setSelectedItems(new Map());
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setIsEditMode(false);
    setEditingKitId(null);
    setKitName('');
    setKitDescription('');
    setSelectedItems(new Map());
  };

  // Скачивание QR-кода
  const downloadQR = (kit: EquipmentKit) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 500;

    // Белый фон
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Рисуем QR-код (используем существующий компонент для генерации)
    const qrCanvas = document.querySelector(`[data-kit-qr="${kit.id}""] canvas`) as HTMLCanvasElement;
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, 50, 50, 300, 300);
    }

    // Добавляем текст
    ctx.fillStyle = 'black';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(kit.name, 200, 380);
    
    if (kit.qr_code) {
      ctx.font = '16px monospace';
      ctx.fillText(kit.qr_code, 200, 410);
    }

    // Скачиваем
    const link = document.createElement('a');
    link.download = `qr-${kit.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // Печать QR-кода
  const printQR = (kit: EquipmentKit) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>QR-код ${kit.name}</title>
        <style>
          body { 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            min-height: 100vh; 
            margin: 0;
            font-family: Arial, sans-serif;
          }
          .qr-container { text-align: center; }
          .kit-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .kit-code { font-size: 14px; color: #666; font-family: monospace; }
          @media print {
            body { min-height: auto; }
          }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <div class="kit-name">${kit.name}</div>
          <img src="${document.querySelector(`[data-kit-qr="${kit.id}""] img`)?.getAttribute('src') || ''}" width="300" height="300" />
          ${kit.qr_code ? `<div class="kit-code">${kit.qr_code}</div>` : ''}
        </div>
        <script>window.onload = () => { setTimeout(() => window.print(), 500); };</script>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Получить количество для item
  const getItemQuantity = (id: string) => selectedItems.get(id) || 0;

  // Увеличить количество
  const incrementItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      const current = next.get(id) || 0;
      next.set(id, current + 1);
      return next;
    });
  };

  // Уменьшить количество
  const decrementItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      const current = next.get(id) || 0;
      if (current <= 1) {
        next.delete(id);
      } else {
        next.set(id, current - 1);
      }
      return next;
    });
  };

  // Установить количество вручную
  const setItemQuantity = (id: string, quantity: number) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      if (quantity <= 0) {
        next.delete(id);
      } else {
        next.set(id, quantity);
      }
      return next;
    });
  };

  // Получить общее количество выбранных единиц
  const getTotalSelectedCount = () => {
    let total = 0;
    selectedItems.forEach(quantity => {
      total += quantity;
    });
    return total;
  };

  // Map для быстрого поиска названия категории по ID
  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(cat => {
      map[cat.id] = cat.name;
    });
    return map;
  }, [categories]);

  // Группировка оборудования по категориям (с названиями)
  const groupedInventory = useMemo(() => {
    const groups: Record<string, { name: string; items: CableInventory[] }> = {};
    inventory.forEach(item => {
      const catId = item.category_id || 'Без категории';
      const catName = categoryMap[catId] || 'Без категории';
      if (!groups[catId]) groups[catId] = { name: catName, items: [] };
      groups[catId].items.push(item);
    });
    return groups;
  }, [inventory, categoryMap]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Комплекты оборудования</h3>
          <p className="text-sm text-gray-500">
            Создайте кофры для быстрой погрузки. Один QR-код = всё содержимое.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
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
                  {/* Редактировать */}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => openEditDialog(kit)}
                    title="Редактировать"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  {kit.qr_code && (
                    <>
                      {/* Показать QR */}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => setShowQR(kit)}
                        title="Показать QR-код"
                      >
                        <QrCode className="w-4 h-4" />
                      </Button>
                      {/* Скачать QR */}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => downloadQR(kit)}
                        title="Скачать QR-код"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      {/* Печать QR */}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => printQR(kit)}
                        title="Печать QR-кода"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-red-500"
                    onClick={() => onDeleteKit(kit.id)}
                    title="Удалить"
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
                <>
                  <p className="text-xs font-mono text-gray-400">{kit.qr_code}</p>
                  {/* Скрытый элемент для получения QR-кода */}
                  <div data-kit-qr={kit.id} className="hidden">
                    <QRCodeDisplay value={kit.qr_code} size={300} />
                  </div>
                </>
              )}
              <p className="text-sm text-gray-600 mt-2">
                {kit.items?.length || 0} наименований
                {kit.items && kit.items.length > 0 && (
                  <span className="text-gray-400">
                    {' '}({kit.items.reduce((sum, i) => sum + (i.quantity || 1), 0)} единиц)
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Диалог создания/редактирования */}
      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Редактировать комплект' : 'Создать комплект'}</DialogTitle>
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
                Выберите оборудование * ({getTotalSelectedCount()} единиц, {selectedItems.size} позиций)
              </label>
              
              <div className="space-y-3 mt-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                {Object.entries(groupedInventory).map(([catId, group]) => (
                  <div key={catId}>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                      {group.name}
                    </p>
                    <div className="space-y-1">
                      {group.items.map(item => {
                        const qty = getItemQuantity(item.id!);
                        return (
                          <div 
                            key={item.id} 
                            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded"
                          >
                            <span className="text-sm flex-1">{item.name}</span>
                            <span className="text-xs text-gray-400">
                              на складе: {item.quantity} шт.
                            </span>
                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => decrementItem(item.id!)}
                                disabled={qty === 0}
                              >
                                -
                              </Button>
                              <span className="w-8 text-center text-sm font-medium">
                                {qty}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => incrementItem(item.id!)}
                                disabled={qty >= item.quantity}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>
                Отмена
              </Button>
              {isEditMode ? (
                <Button onClick={handleUpdate} disabled={!kitName || selectedItems.size === 0}>
                  Сохранить изменения
                </Button>
              ) : (
                <Button onClick={handleCreate} disabled={!kitName || selectedItems.size === 0}>
                  Создать комплект
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR-код комплекта */}
      <Dialog open={!!showQR} onOpenChange={() => setShowQR(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR-код: {showQR?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {showQR?.qr_code && (
              <QRCodeDisplay
                value={showQR.qr_code}
                size={250}
              />
            )}
            <p className="text-xs font-mono text-gray-500">{showQR?.qr_code}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowQR(null)}>
                Закрыть
              </Button>
              {showQR && (
                <>
                  <Button variant="outline" onClick={() => downloadQR(showQR)}>
                    <Download className="w-4 h-4 mr-2" />
                    Скачать
                  </Button>
                  <Button onClick={() => printQR(showQR)}>
                    <Printer className="w-4 h-4 mr-2" />
                    Печать
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
