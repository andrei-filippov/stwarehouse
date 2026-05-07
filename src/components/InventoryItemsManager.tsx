import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  QrCode,
  Package,
  Search,
  X,
  Printer,
  Save,
  RotateCcw,
  Wrench,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { CableInventory } from '../types';
import type { InventoryItem, ItemComment } from '../types/inventoryItem';
import { 
  getItemStatusLabel, 
  getItemStatusColor, 
  getItemConditionLabel,
  ITEM_CONDITION_LABELS
} from '../types/inventoryItem';
import { QRCodeDisplay } from './QRCodeDisplay';

interface InventoryItemsManagerProps {
  inventory: CableInventory;
  companyId: string;
  onRefresh?: () => void;
}

export default function InventoryItemsManager({ inventory, companyId, onRefresh }: InventoryItemsManagerProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addCount, setAddCount] = useState(1);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({ serial_number: '', notes: '', condition: 'good' as InventoryItem['condition'] });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isQRPrintOpen, setIsQRPrintOpen] = useState(false);
  const [comments, setComments] = useState<ItemComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('inventory_id', inventory.id)
      .eq('company_id', companyId)
      .order('qr_code');
    
    if (error) {
      toast.error('Ошибка загрузки экземпляров', { description: error.message });
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [inventory.id, companyId]);

  const handleCreateItems = async () => {
    if (addCount < 1 || addCount > 100) {
      toast.error('Количество должно быть от 1 до 100');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('create_inventory_items', {
        p_company_id: companyId,
        p_inventory_id: inventory.id,
        p_count: addCount,
      });

      if (error) throw error;

      toast.success('Экземпляры созданы', { description: `Создано: ${data || addCount}` });
      setIsAddDialogOpen(false);
      setAddCount(1);
      await fetchItems();
      onRefresh?.();
    } catch (err: any) {
      // Fallback: создаём вручную
      try {
        const existingCount = items.length;
        const groupQr = inventory.qr_code || `EQ-${inventory.id.slice(0, 6).toUpperCase()}`;
        const newItems: InventoryItem[] = [];

        for (let i = 1; i <= addCount; i++) {
          const index = existingCount + i;
          const qrCode = `${groupQr}-${String(index).padStart(2, '0')}`;

          const { data: inserted, error: insertError } = await supabase
            .from('inventory_items')
            .insert({
              company_id: companyId,
              inventory_id: inventory.id,
              qr_code: qrCode,
              status: 'available',
              condition: 'good',
            })
            .select()
            .single();

          if (insertError) throw insertError;
          if (inserted) newItems.push(inserted);
        }

        setItems(prev => [...prev, ...newItems]);
        toast.success('Экземпляры созданы', { description: `Создано: ${newItems.length}` });
        setIsAddDialogOpen(false);
        setAddCount(1);
        onRefresh?.();
      } catch (fallbackErr: any) {
        toast.error('Ошибка при создании', { description: fallbackErr.message });
      }
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    const { error } = await supabase
      .from('inventory_items')
      .update({
        serial_number: editForm.serial_number || null,
        notes: editForm.notes || null,
        condition: editForm.condition,
      })
      .eq('id', editingItem.id)
      .eq('company_id', companyId);

    if (error) {
      toast.error('Ошибка при обновлении', { description: error.message });
    } else {
      toast.success('Экземпляр обновлён');
      setItems(prev => prev.map(item => 
        item.id === editingItem.id 
          ? { ...item, serial_number: editForm.serial_number, notes: editForm.notes, condition: editForm.condition }
          : item
      ));
      setEditingItem(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Удалить экземпляр? Это действие нельзя отменить.')) return;

    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', itemId)
      .eq('company_id', companyId);

    if (error) {
      toast.error('Ошибка при удалении', { description: error.message });
    } else {
      toast.success('Экземпляр удалён');
      setItems(prev => prev.filter(i => i.id !== itemId));
      onRefresh?.();
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: InventoryItem['status']) => {
    const { error } = await supabase
      .from('inventory_items')
      .update({ status: newStatus })
      .eq('id', itemId)
      .eq('company_id', companyId);

    if (error) {
      toast.error('Ошибка при изменении статуса', { description: error.message });
    } else {
      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, status: newStatus } : item
      ));
      toast.success('Статус обновлён');
      onRefresh?.();
    }
  };

  const fetchComments = async (itemId: string) => {
    const { data, error } = await supabase
      .from('item_comments')
      .select('*, profiles:author_id(name)')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });

    if (!error) {
      setComments((data || []).map((c: any) => ({ ...c, author_name: c.profiles?.name })));
    }
  };

  const handleAddComment = async () => {
    if (!viewingItem || !newComment.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('item_comments')
      .insert({
        item_id: viewingItem.id,
        author_id: user?.id,
        text: newComment.trim(),
      })
      .select()
      .single();

    if (error) {
      toast.error('Ошибка при добавлении комментария');
    } else {
      setComments(prev => [data, ...prev]);
      setNewComment('');
      toast.success('Комментарий добавлен');
    }
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setEditForm({
      serial_number: item.serial_number || '',
      notes: item.notes || '',
      condition: item.condition,
    });
  };

  const openView = (item: InventoryItem) => {
    setViewingItem(item);
    fetchComments(item.id);
  };

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      item.qr_code.toLowerCase().includes(q) ||
      (item.serial_number?.toLowerCase() || '').includes(q) ||
      (item.notes?.toLowerCase() || '').includes(q)
    );
  });

  const stats = {
    total: items.length,
    available: items.filter(i => i.status === 'available').length,
    issued: items.filter(i => i.status === 'issued').length,
    repair: items.filter(i => i.status === 'repair').length,
    writtenOff: items.filter(i => i.status === 'written_off').length,
  };

  return (
    <div className="space-y-4">
      {/* Статистика */}
      <div className="grid grid-cols-5 gap-2">
        <Card className="p-2">
          <div className="text-xs text-muted-foreground">Всего</div>
          <div className="text-lg font-bold">{stats.total}</div>
        </Card>
        <Card className="p-2 border-green-200">
          <div className="text-xs text-green-600">На складе</div>
          <div className="text-lg font-bold text-green-700">{stats.available}</div>
        </Card>
        <Card className="p-2 border-blue-200">
          <div className="text-xs text-blue-600">Выдано</div>
          <div className="text-lg font-bold text-blue-700">{stats.issued}</div>
        </Card>
        <Card className="p-2 border-red-200">
          <div className="text-xs text-red-600">В ремонте</div>
          <div className="text-lg font-bold text-red-700">{stats.repair}</div>
        </Card>
        <Card className="p-2 border-gray-200">
          <div className="text-xs text-gray-600">Списано</div>
          <div className="text-lg font-bold text-gray-700">{stats.writtenOff}</div>
        </Card>
      </div>

      {/* Панель управления */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по QR, серийному номеру..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Добавить экземпляры
        </Button>
        {selectedItems.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setIsQRPrintOpen(true)}>
            <Printer className="h-4 w-4 mr-1" />
            Печать QR ({selectedItems.length})
          </Button>
        )}
      </div>

      {/* Список экземпляров */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? 'Ничего не найдено' : 'Нет экземпляров. Нажмите "Добавить экземпляры"'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => (
            <Card key={item.id} className="p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(item.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedItems(prev => [...prev, item.id]);
                    } else {
                      setSelectedItems(prev => prev.filter(id => id !== item.id));
                    }
                  }}
                  className="h-4 w-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono text-xs">
                      <QrCode className="h-3 w-3 mr-1" />
                      {item.qr_code}
                    </Badge>
                    <Badge className={getItemStatusColor(item.status)}>
                      {getItemStatusLabel(item.status)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {getItemConditionLabel(item.condition)}
                    </span>
                  </div>
                  {item.serial_number && (
                    <div className="text-sm mt-1">
                      <span className="text-muted-foreground">S/N:</span> {item.serial_number}
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-sm text-muted-foreground mt-1 truncate">{item.notes}</div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openView(item)}>
                    <Package className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  {item.status === 'available' && (
                    <Button variant="ghost" size="sm" onClick={() => handleStatusChange(item.id, 'repair')}>
                      <Wrench className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                  {item.status === 'repair' && (
                    <Button variant="ghost" size="sm" onClick={() => handleStatusChange(item.id, 'available')}>
                      <RotateCcw className="h-4 w-4 text-green-500" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Диалог добавления */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить экземпляры</DialogTitle>
            <DialogDescription>
              Группа: {inventory.name || 'Без названия'}
              <br />
              QR группы: {inventory.qr_code || '—'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Количество экземпляров</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={addCount}
                onChange={(e) => setAddCount(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Будут созданы QR-коды: {inventory.qr_code || `EQ-${inventory.id.slice(0, 6).toUpperCase()}`}-01 ... 
                {inventory.qr_code || `EQ-${inventory.id.slice(0, 6).toUpperCase()}`}-{String(addCount).padStart(2, '0')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateItems}>Создать</Button>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Отмена</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать экземпляр</DialogTitle>
            <DialogDescription>QR: {editingItem?.qr_code}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Серийный номер</label>
              <Input
                value={editForm.serial_number}
                onChange={(e) => setEditForm({ ...editForm, serial_number: e.target.value })}
                placeholder="Например: SN123456"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Состояние</label>
              <select
                value={editForm.condition}
                onChange={(e) => setEditForm({ ...editForm, condition: e.target.value as InventoryItem['condition'] })}
                className="w-full border rounded-md p-2 text-sm"
              >
                {Object.entries(ITEM_CONDITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Комментарий</label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Примечания к экземпляру"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpdateItem}><Save className="h-4 w-4 mr-1" /> Сохранить</Button>
              <Button variant="outline" onClick={() => setEditingItem(null)}>Отмена</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог просмотра экземпляра */}
      <Dialog open={!!viewingItem} onOpenChange={() => setViewingItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Экземпляр {viewingItem?.qr_code}</DialogTitle>
          </DialogHeader>
          {viewingItem && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge className={getItemStatusColor(viewingItem.status)}>
                  {getItemStatusLabel(viewingItem.status)}
                </Badge>
                <Badge variant="outline">{getItemConditionLabel(viewingItem.condition)}</Badge>
              </div>
              {viewingItem.serial_number && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Серийный номер:</span> {viewingItem.serial_number}
                </div>
              )}
              {viewingItem.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Комментарий:</span> {viewingItem.notes}
                </div>
              )}
              
              {/* QR код */}
              <div className="flex justify-center py-2">
                <QRCodeDisplay value={viewingItem.qr_code} size={150} />
              </div>

              {/* Комментарии */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2">Комментарии</h4>
                <div className="flex gap-2 mb-3">
                  <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Добавить комментарий..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  />
                  <Button size="sm" onClick={handleAddComment}>Добавить</Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {comments.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Нет комментариев</div>
                  ) : (
                    comments.map(comment => (
                      <div key={comment.id} className="text-sm bg-muted p-2 rounded">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{comment.author_name || 'Аноним'}</span>
                          <span>{new Date(comment.created_at || '').toLocaleDateString('ru-RU')}</span>
                        </div>
                        <div>{comment.text}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог печати QR */}
      <Dialog open={isQRPrintOpen} onOpenChange={setIsQRPrintOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Печать QR-кодов</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4">
            {items
              .filter(i => selectedItems.includes(i.id))
              .map(item => (
                <div key={item.id} className="text-center p-2 border rounded">
                  <QRCodeDisplay value={item.qr_code} size={120} />
                  <div className="text-xs font-mono mt-1">{item.qr_code}</div>
                  {item.serial_number && (
                    <div className="text-xs text-muted-foreground">{item.serial_number}</div>
                  )}
                </div>
              ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Печать</Button>
            <Button variant="outline" onClick={() => setIsQRPrintOpen(false)}>Закрыть</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
