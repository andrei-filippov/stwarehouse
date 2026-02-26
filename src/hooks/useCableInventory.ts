import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { CableCategory, CableInventory, CableMovement } from '../types/cable';

export function useCableInventory(userId: string | undefined) {
  const [categories, setCategories] = useState<CableCategory[]>([]);
  const [inventory, setInventory] = useState<CableInventory[]>([]);
  const [movements, setMovements] = useState<CableMovement[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    
    // Загружаем категории
    const { data: catData, error: catError } = await supabase
      .from('cable_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name');
    
    if (catError) {
      toast.error('Ошибка загрузки категорий', { description: catError.message });
    } else {
      setCategories(catData as CableCategory[]);
    }

    // Загружаем инвентарь
    const { data: invData, error: invError } = await supabase
      .from('cable_inventory')
      .select('*')
      .order('length');
    
    if (invError) {
      toast.error('Ошибка загрузки инвентаря', { description: invError.message });
    } else {
      setInventory(invData as CableInventory[]);
    }

    // Загружаем движение (только невозвращённые)
    const { data: movData, error: movError } = await supabase
      .from('cable_movements')
      .select('*')
      .eq('is_returned', false)
      .order('created_at', { ascending: false });
    
    if (movError) {
      toast.error('Ошибка загрузки движения', { description: movError.message });
    } else {
      setMovements(movData as CableMovement[]);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();

    // Realtime подписки
    const categoriesChannel = supabase
      .channel('cable_categories_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cable_categories' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setCategories(prev => [...prev, payload.new as CableCategory].sort((a, b) => a.sort_order - b.sort_order));
        } else if (payload.eventType === 'UPDATE') {
          setCategories(prev => prev.map(c => c.id === payload.new.id ? payload.new as CableCategory : c).sort((a, b) => a.sort_order - b.sort_order));
        } else if (payload.eventType === 'DELETE') {
          setCategories(prev => prev.filter(c => c.id !== payload.old.id));
        }
      })
      .subscribe();

    const inventoryChannel = supabase
      .channel('cable_inventory_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cable_inventory' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setInventory(prev => [...prev, payload.new as CableInventory].sort((a, b) => a.length - b.length));
        } else if (payload.eventType === 'UPDATE') {
          setInventory(prev => prev.map(i => i.id === payload.new.id ? payload.new as CableInventory : i));
        } else if (payload.eventType === 'DELETE') {
          setInventory(prev => prev.filter(i => i.id !== payload.old.id));
        }
      })
      .subscribe();

    const movementsChannel = supabase
      .channel('cable_movements_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cable_movements' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          if (!(payload.new as CableMovement).is_returned) {
            setMovements(prev => [payload.new as CableMovement, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
          const mov = payload.new as CableMovement;
          setMovements(prev => {
            if (mov.is_returned) {
              return prev.filter(m => m.id !== mov.id);
            }
            return prev.map(m => m.id === mov.id ? mov : m);
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(categoriesChannel);
      supabase.removeChannel(inventoryChannel);
      supabase.removeChannel(movementsChannel);
    };
  }, [fetchAll]);

  // Добавить категорию
  const addCategory = async (data: Omit<CableCategory, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    const { data: result, error } = await supabase
      .from('cable_categories')
      .insert([{ ...data, user_id: userId }])
      .select()
      .single();
    
    if (error) {
      toast.error('Ошибка добавления категории', { description: error.message });
      return { error };
    }
    toast.success('Категория добавлена');
    return { data: result };
  };

  // Обновить категорию
  const updateCategory = async (id: string, updates: Partial<CableCategory>) => {
    const { error } = await supabase
      .from('cable_categories')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка обновления', { description: error.message });
      return { error };
    }
    toast.success('Категория обновлена');
    return { error: null };
  };

  // Удалить категорию
  const deleteCategory = async (id: string) => {
    const { error } = await supabase
      .from('cable_categories')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка удаления', { description: error.message });
      return { error };
    }
    toast.success('Категория удалена');
    return { error: null };
  };

  // Добавить/обновить позицию инвентаря
  const upsertInventory = async (data: Omit<CableInventory, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: existing } = await supabase
      .from('cable_inventory')
      .select('id')
      .eq('category_id', data.category_id)
      .eq('length', data.length)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('cable_inventory')
        .update({ 
          quantity: data.quantity, 
          min_quantity: data.min_quantity, 
          notes: data.notes,
          updated_at: new Date().toISOString() 
        })
        .eq('id', existing.id);
      
      if (error) {
        toast.error('Ошибка обновления', { description: error.message });
        return { error };
      }
      toast.success('Количество обновлено');
    } else {
      const { error } = await supabase
        .from('cable_inventory')
        .insert([data]);
      
      if (error) {
        toast.error('Ошибка добавления', { description: error.message });
        return { error };
      }
      toast.success('Позиция добавлена');
    }
    return { error: null };
  };

  // Удалить позицию инвентаря
  const deleteInventory = async (id: string) => {
    const { error } = await supabase
      .from('cable_inventory')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка удаления', { description: error.message });
      return { error };
    }
    toast.success('Позиция удалена');
    return { error: null };
  };

  // Выдать кабель
  const issueCable = async (data: {
    category_id: string;
    inventory_id: string;
    length: number;
    quantity: number;
    issued_to: string;
    contact?: string;
  }) => {
    // Создаём запись о выдаче
    const { data: movement, error: movError } = await supabase
      .from('cable_movements')
      .insert([{
        ...data,
        type: 'issue',
        issued_by: userId,
        returned_quantity: 0,
        is_returned: false,
      }])
      .select()
      .single();

    if (movError) {
      toast.error('Ошибка выдачи', { description: movError.message });
      return { error: movError };
    }

    // Уменьшаем количество на складе
    const invItem = inventory.find(i => i.id === data.inventory_id);
    if (invItem) {
      const { error: updError } = await supabase
        .from('cable_inventory')
        .update({ quantity: Math.max(0, invItem.quantity - data.quantity) })
        .eq('id', data.inventory_id);
      
      if (updError) {
        toast.error('Ошибка обновления склада', { description: updError.message });
      }
    }

    toast.success('Кабель выдан');
    return { data: movement };
  };

  // Вернуть кабель (чекбокс)
  const returnCable = async (movementId: string) => {
    const movement = movements.find(m => m.id === movementId);
    if (!movement) return { error: new Error('Запись не найдена') };

    // Помечаем как возвращённое
    const { error } = await supabase
      .from('cable_movements')
      .update({ 
        is_returned: true, 
        returned_at: new Date().toISOString(),
        returned_quantity: movement.quantity 
      })
      .eq('id', movementId);

    if (error) {
      toast.error('Ошибка возврата', { description: error.message });
      return { error };
    }

    // Возвращаем на склад
    const invItem = inventory.find(i => i.id === movement.inventory_id);
    if (invItem) {
      const { error: updError } = await supabase
        .from('cable_inventory')
        .update({ quantity: invItem.quantity + movement.quantity })
        .eq('id', movement.inventory_id);
      
      if (updError) {
        toast.error('Ошибка обновления склада', { description: updError.message });
      }
    }

    toast.success('Кабель возвращён');
    return { error: null };
  };

  // Статистики
  const stats = useMemo(() => {
    const result: Record<string, { totalLength: number; totalQty: number; issuedQty: number }> = {};
    
    categories.forEach(cat => {
      const catInventory = inventory.filter(i => i.category_id === cat.id);
      const catMovements = movements.filter(m => m.category_id === cat.id);
      
      result[cat.id] = {
        totalLength: catInventory.reduce((sum, i) => sum + (i.length * i.quantity), 0),
        totalQty: catInventory.reduce((sum, i) => sum + i.quantity, 0),
        issuedQty: catMovements.reduce((sum, m) => sum + m.quantity, 0),
      };
    });
    
    return result;
  }, [categories, inventory, movements]);

  return {
    categories,
    inventory,
    movements,
    loading,
    stats,
    addCategory,
    updateCategory,
    deleteCategory,
    upsertInventory,
    deleteInventory,
    issueCable,
    returnCable,
    refresh: fetchAll,
  };
}
