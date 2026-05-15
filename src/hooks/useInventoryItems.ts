import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase, safeChannel } from '../lib/supabase';
import type { InventoryItem, ItemComment, ItemHistory } from '../types/inventoryItem';

export function useInventoryItems(companyId: string | undefined) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [comments, setComments] = useState<Record<string, ItemComment[]>>({});
  const [loading, setLoading] = useState(false);

  // Загрузить экземпляры группы
  const fetchItems = useCallback(async (inventoryId: string) => {
    if (!companyId) return [];
    
    const { data, error } = await supabase
      .from('inventory_items')
      .select(`
        *,
        cable_inventory!inner(name, category_id)
      `)
      .eq('inventory_id', inventoryId)
      .eq('company_id', companyId)
      .order('qr_code');
    
    if (error) {
      toast.error('Ошибка при загрузке экземпляров', { description: error.message });
      return [];
    }
    
    const mapped = (data || []).map((item: any) => ({
      ...item,
      inventory_name: item.cable_inventory?.name,
      inventory_category_id: item.cable_inventory?.category_id,
    }));
    
    setItems(prev => {
      const others = prev.filter(i => i.inventory_id !== inventoryId);
      return [...others, ...mapped];
    });
    
    return mapped;
  }, [companyId]);

  // Найти экземпляр по QR-коду
  const fetchItemByQR = useCallback(async (qrCode: string): Promise<InventoryItem | null> => {
    if (!companyId) return null;
    
    const { data, error } = await supabase
      .from('inventory_items')
      .select(`
        *,
        cable_inventory!inner(name, category_id)
      `)
      .eq('qr_code', qrCode)
      .eq('company_id', companyId)
      .single();
    
    if (error) {
      if (error.code !== 'PGRST116') { // Not found
        console.error('Error fetching item by QR:', error);
      }
      return null;
    }
    
    return {
      ...data,
      inventory_name: data.cable_inventory?.name,
      inventory_category_id: data.cable_inventory?.category_id,
    };
  }, [companyId]);

  // Массовое создание экземпляров
  const createItems = useCallback(async (inventoryId: string, count: number) => {
    if (!companyId) return { error: new Error('No company selected'), items: [] as InventoryItem[] };
    if (count < 1 || count > 100) {
      return { error: new Error('Количество должно быть от 1 до 100'), items: [] as InventoryItem[] };
    }
    
    try {
      const { data, error } = await supabase.rpc('create_inventory_items', {
        p_company_id: companyId,
        p_inventory_id: inventoryId,
        p_count: count,
      });
      
      if (error) throw error;
      
      // Перезагружаем экземпляры
      const newItems = await fetchItems(inventoryId);
      toast.success('Экземпляры созданы', { description: `Создано: ${data || count}` });
      return { error: null, items: newItems };
    } catch (err: any) {
      // Fallback: создаём вручную если RPC не доступна
      try {
        const { data: existing } = await supabase
          .from('inventory_items')
          .select('qr_code')
          .eq('inventory_id', inventoryId)
          .order('qr_code', { ascending: false })
          .limit(1);
        
        const existingCount = existing?.length || 0;
        const { data: groupData } = await supabase
          .from('cable_inventory')
          .select('qr_code')
          .eq('id', inventoryId)
          .single();
        
        const groupQr = groupData?.qr_code || `EQ-${inventoryId.slice(0, 6).toUpperCase()}`;
        const newItems: InventoryItem[] = [];
        
        for (let i = 1; i <= count; i++) {
          const index = existingCount + i;
          const qrCode = `${groupQr}-${String(index).padStart(2, '0')}`;
          
          const { data: inserted, error: insertError } = await supabase
            .from('inventory_items')
            .insert({
              company_id: companyId,
              inventory_id: inventoryId,
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
        return { error: null, items: newItems };
      } catch (fallbackErr: any) {
        toast.error('Ошибка при создании экземпляров', { description: fallbackErr.message });
        return { error: fallbackErr, items: [] as InventoryItem[] };
      }
    }
  }, [companyId, fetchItems]);

  // Обновить экземпляр
  const updateItem = useCallback(async (id: string, updates: Partial<InventoryItem>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('inventory_items')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);
      
      if (error) throw error;
      
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, ...updates } : item
      ));
      
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  // Удалить экземпляр
  const deleteItem = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);
      
      if (error) throw error;
      
      setItems(prev => prev.filter(item => item.id !== id));
      toast.success('Экземпляр удалён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  // Обновить статус экземпляра
  const updateItemStatus = useCallback(async (id: string, status: InventoryItem['status']) => {
    return updateItem(id, { status });
  }, [updateItem]);

  // Загрузить комментарии
  const fetchComments = useCallback(async (itemId: string) => {
    const { data, error } = await supabase
      .from('item_comments')
      .select(`
        *,
        profiles:author_id(name)
      `)
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
    
    const mapped = (data || []).map((c: any) => ({
      ...c,
      author_name: c.profiles?.name,
    }));
    
    setComments(prev => ({ ...prev, [itemId]: mapped }));
    return mapped;
  }, []);

  // Добавить комментарий
  const addComment = useCallback(async (itemId: string, text: string) => {
    if (!text.trim()) return { error: new Error('Комментарий не может быть пустым') };
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('item_comments')
        .insert({
          item_id: itemId,
          author_id: user?.id,
          text: text.trim(),
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Обновляем локальное состояние
      setComments(prev => ({
        ...prev,
        [itemId]: [data, ...(prev[itemId] || [])],
      }));
      
      return { error: null, comment: data };
    } catch (err: any) {
      toast.error('Ошибка при добавлении комментария', { description: err.message });
      return { error: err };
    }
  }, []);

  // Загрузить историю экземпляра (выдачи + ремонты + комментарии)
  const fetchItemHistory = useCallback(async (itemId: string): Promise<ItemHistory[]> => {
    if (!companyId) return [];
    
    const [movementsRes, repairsRes, commentsRes] = await Promise.all([
      supabase
        .from('cable_movements')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('equipment_repairs')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('item_comments')
        .select('*, profiles:author_id(name)')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    
    const history: ItemHistory[] = [];
    
    // Выдачи и возвраты
    (movementsRes.data || []).forEach((m: any) => {
      if (m.type === 'issue') {
        history.push({
          type: 'issue',
          date: m.created_at,
          description: `Выдано ${m.quantity} шт — ${m.issued_to}`,
          author: m.issued_by_name,
          details: m.is_returned ? `Возвращено ${m.returned_quantity || m.quantity} шт` : 'Не возвращено',
        });
      } else if (m.type === 'return') {
        history.push({
          type: 'return',
          date: m.created_at,
          description: `Возврат — ${m.issued_to}`,
          author: m.issued_by_name,
        });
      }
    });
    
    // Ремонты
    (repairsRes.data || []).forEach((r: any) => {
      history.push({
        type: 'repair',
        date: r.created_at,
        description: `Ремонт: ${r.reason}`,
        author: undefined,
        details: r.status === 'returned' ? 'Возвращено после ремонта' : 
                 r.status === 'written_off' ? 'Списано' : 'В ремонте',
      });
    });
    
    // Комментарии
    (commentsRes.data || []).forEach((c: any) => {
      history.push({
        type: 'comment',
        date: c.created_at,
        description: c.text,
        author: c.profiles?.name,
      });
    });
    
    // Сортируем по дате (новые сверху)
    return history.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [companyId]);

  // Получить статистику по экземплярам группы
  const getItemStats = useCallback((inventoryId: string) => {
    const groupItems = items.filter(i => i.inventory_id === inventoryId);
    return {
      total: groupItems.length,
      available: groupItems.filter(i => i.status === 'available').length,
      issued: groupItems.filter(i => i.status === 'issued').length,
      repair: groupItems.filter(i => i.status === 'repair').length,
      writtenOff: groupItems.filter(i => i.status === 'written_off').length,
    };
  }, [items]);

  // Realtime подписка на inventory_items
  useEffect(() => {
    if (!companyId) return;
    
    const channel = safeChannel('inventory_items_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== payload.old.id));
          } else if (payload.eventType === 'INSERT') {
            setItems(prev => [...prev, payload.new as InventoryItem]);
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(i => 
              i.id === payload.new.id ? { ...i, ...payload.new } : i
            ));
          }
        }
      )
      .subscribe();
    
    return () => {
      channel.unsubscribe();
    };
  }, [companyId]);

  return {
    items,
    comments,
    loading,
    fetchItems,
    fetchItemByQR,
    createItems,
    updateItem,
    updateItemStatus,
    deleteItem,
    fetchComments,
    addComment,
    fetchItemHistory,
    getItemStats,
  };
}
