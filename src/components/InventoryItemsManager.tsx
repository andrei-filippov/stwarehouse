import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  QrCode,
  Package,
  Search,
  Printer,
  Save,
  RotateCcw,
  Wrench,
  MessageSquare,
  X
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
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [comments, setComments] = useState<ItemComment[]>([]);
  const [newComment, setNewComment] = useState('');
  
  // Диалог ремонта
  const [repairItem, setRepairItem] = useState<InventoryItem | null>(null);
  const [repairReason, setRepairReason] = useState('');
  const [repairNotes, setRepairNotes] = useState('');

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

    // Polling каждые 15 секунд (realtime не работает через Yandex Cloud прокси)
    const interval = setInterval(() => {
      fetchItems();
    }, 15000);

    return () => clearInterval(interval);
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
      // Fallback
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

  // Отправка в ремонт с созданием записи в equipment_repairs
  const handleSendToRepair = async () => {
    if (!repairItem || !repairReason.trim()) {
      toast.error('Укажите причину ремонта');
      return;
    }

    try {
      const { error } = await supabase.from('equipment_repairs').insert({
        company_id: companyId,
        category_id: inventory.category_id,
        inventory_id: inventory.id,
        item_id: repairItem.id,
        equipment_name: inventory.name || 'Оборудование',
        quantity: 1,
        reason: repairReason.trim(),
        notes: repairNotes.trim() || undefined,
        status: 'in_repair',
        sent_date: new Date().toISOString().split('T')[0],
      });

      if (error) throw error;

      // Обновляем статус экземпляра
      await supabase
        .from('inventory_items')
        .update({ status: 'repair' })
        .eq('id', repairItem.id)
        .eq('company_id', companyId);

      setItems(prev => prev.map(item => 
        item.id === repairItem.id ? { ...item, status: 'repair' } : item
      ));

      toast.success('Экземпляр отправлен в ремонт');
      setRepairItem(null);
      setRepairReason('');
      setRepairNotes('');
      onRefresh?.();
    } catch (err: any) {
      toast.error('Ошибка при отправке в ремонт', { description: err.message });
    }
  };

  // Возврат из ремонта
  const handleReturnFromRepair = async (item: InventoryItem) => {
    try {
      // Находим активную запись о ремонте
      const { data: repairs } = await supabase
        .from('equipment_repairs')
        .select('*')
        .eq('item_id', item.id)
        .eq('status', 'in_repair')
        .order('created_at', { ascending: false })
        .limit(1);

      if (repairs && repairs.length > 0) {
        await supabase.from('equipment_repairs').update({
          status: 'returned',
          returned_date: new Date().toISOString().split('T')[0],
        }).eq('id', repairs[0].id);
      }

      await supabase
        .from('inventory_items')
        .update({ status: 'available' })
        .eq('id', item.id)
        .eq('company_id', companyId);

      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: 'available' } : i
      ));

      toast.success('Экземпляр возвращён на склад');
      onRefresh?.();
    } catch (err: any) {
      toast.error('Ошибка при возврате', { description: err.message });
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
    <div className="space-y-3">
      {/* Компактная статистика */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <span>Всего: <strong className="text-foreground">{stats.total}</strong></span>
        <span className="text-green-600">На складе: <strong>{stats.available}</strong></span>
        <span className="text-blue-600">Выдано: <strong>{stats.issued}</strong></span>
        <span className="text-red-600">В ремонте: <strong>{stats.repair}</strong></span>
        {stats.writtenOff > 0 && <span className="text-gray-600">Списано: <strong>{stats.writtenOff}</strong></span>}
      </div>

      {/* Панель управления */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Поиск по QR, S/N..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-8 text-sm"
          />
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} size="sm" className="h-8 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" />
          Добавить
        </Button>
        {selectedItems.length > 0 && (
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsQRPrintOpen(true)}>
            <Printer className="h-3.5 w-3.5 mr-1" />
            Печать ({selectedItems.length})
          </Button>
        )}
      </div>

      {/* Список экземпляров — компактный */}
      {loading ? (
        <div className="text-center py-4 text-sm text-muted-foreground">Загрузка...</div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground">
          {searchQuery ? 'Ничего не найдено' : 'Нет экземпляров'}
        </div>
      ) : (
        <div className="space-y-1">
          {filteredItems.map(item => (
            <div 
              key={item.id} 
              className="flex items-center gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors"
            >
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
                className="h-3.5 w-3.5 shrink-0"
              />
              <Badge variant="outline" className="font-mono text-[10px] h-5 px-1.5 shrink-0">
                {item.qr_code}
              </Badge>
              <Badge className={`text-[10px] h-5 px-1.5 ${getItemStatusColor(item.status)}`}>
                {getItemStatusLabel(item.status)}
              </Badge>
              <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                {getItemConditionLabel(item.condition)}
              </span>
              {item.serial_number && (
                <span className="text-xs truncate hidden md:inline">
                  <span className="text-muted-foreground">S/N:</span> {item.serial_number}
                </span>
              )}
              {item.notes && (
                <span className="text-xs text-muted-foreground truncate flex-1 hidden lg:inline">{item.notes}</span>
              )}
              <div className="flex gap-0.5 ml-auto shrink-0">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openView(item)} title="Просмотр">
                  <Package className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(item)} title="Редактировать">
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                {item.status === 'available' && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0" 
                    onClick={() => setRepairItem(item)}
                    title="В ремонт"
                  >
                    <Wrench className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                )}
                {item.status === 'repair' && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0" 
                    onClick={() => handleReturnFromRepair(item)}
                    title="Вернуть на склад"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-green-500" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDeleteItem(item.id)} title="Удалить">
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </div>
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
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Количество</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={addCount}
                onChange={(e) => setAddCount(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                QR: {inventory.qr_code || `EQ-${inventory.id.slice(0, 6).toUpperCase()}`}-01 ... 
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

      {/* Диалог ремонта */}
      <Dialog open={!!repairItem} onOpenChange={() => { setRepairItem(null); setRepairReason(''); setRepairNotes(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отправить в ремонт</DialogTitle>
            <DialogDescription>
              {inventory.name} — {repairItem?.qr_code}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Причина поломки *</label>
              <Input
                value={repairReason}
                onChange={(e) => setRepairReason(e.target.value)}
                placeholder="Что сломалось?"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Комментарий к ремонту</label>
              <Input
                value={repairNotes}
                onChange={(e) => setRepairNotes(e.target.value)}
                placeholder="Дополнительная информация"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSendToRepair} disabled={!repairReason.trim()}>
                <Wrench className="h-4 w-4 mr-1" /> В ремонт
              </Button>
              <Button variant="outline" onClick={() => { setRepairItem(null); setRepairReason(''); setRepairNotes(''); }}>
                Отмена
              </Button>
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
                <QRCodeDisplay value={viewingItem.qr_code} size={120} />
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
                    className="h-8 text-sm"
                  />
                  <Button size="sm" className="h-8" onClick={handleAddComment}>Добавить</Button>
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
