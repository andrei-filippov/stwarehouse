import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Estimate, EstimateItem } from '../types';

// Генерируем уникальный ID сессии для этой вкладки
const SESSION_ID = Math.random().toString(36).substring(2, 15);

export function useEstimates(userId: string | undefined) {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(false);
  const currentEditingIdRef = useRef<string | null>(null);

  const fetchEstimates = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    // Загружаем сметы
    const { data, error } = await supabase
      .from('estimates')
      .select(`
        *,
        items:estimate_items(*)
      `)
      .order('created_at', { ascending: false });
    
    // Если есть сметы в режиме редактирования - загружаем имена редакторов отдельно
    if (data && data.length > 0) {
      const editingUserIds = data
        .filter((e: any) => e.is_editing && e.editing_by)
        .map((e: any) => e.editing_by)
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i); // unique
      
      let editorNames: Record<string, string> = {};
      if (editingUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', editingUserIds);
        
        if (profiles) {
          profiles.forEach((p: any) => {
            editorNames[p.id] = p.name;
          });
        }
      }
      
      // Преобразуем category_order из JSONB в массив и добавляем имя редактора
      data.forEach((estimate: any) => {
        if (estimate.category_order && typeof estimate.category_order === 'string') {
          try {
            estimate.category_order = JSON.parse(estimate.category_order);
          } catch {
            estimate.category_order = [];
          }
        }
        // Добавляем имя редактора если есть
        if (estimate.is_editing && estimate.editing_by && editorNames[estimate.editing_by]) {
          estimate.editor_name = editorNames[estimate.editing_by];
        }
      });
    }
    
    if (error) {
      toast.error('Ошибка при загрузке смет', { description: error.message });
    } else if (data) {
      setEstimates(data as Estimate[]);
    }
    setLoading(false);
  }, [userId]);

  // Устанавливаем статус "редактируется" при открытии сметы
  const startEditing = useCallback(async (estimateId: string) => {
    if (!userId) return { error: new Error('Not authenticated') };
    
    currentEditingIdRef.current = estimateId;
    
    const { error } = await supabase
      .from('estimates')
      .update({
        is_editing: true,
        editing_by: userId,
        editing_since: new Date().toISOString(),
        editing_session_id: SESSION_ID
      })
      .eq('id', estimateId);
    
    return { error };
  }, [userId]);

  // Снимаем статус редактирования при закрытии
  const stopEditing = useCallback(async (estimateId?: string) => {
    const id = estimateId || currentEditingIdRef.current;
    if (!id || !userId) return { error: null };
    
    // Проверяем что мы действительно те, кто редактировал
    const { data: current } = await supabase
      .from('estimates')
      .select('editing_by, editing_session_id')
      .eq('id', id)
      .single();
    
    // Снимаем блокировку только если мы те, кто редактировал
    if (current && (current.editing_by === userId || current.editing_session_id === SESSION_ID)) {
      const { error } = await supabase
        .from('estimates')
        .update({
          is_editing: false,
          editing_by: null,
          editing_since: null,
          editing_session_id: null
        })
        .eq('id', id);
      
      if (!error) {
        currentEditingIdRef.current = null;
      }
      return { error };
    }
    
    return { error: null };
  }, [userId]);

  // Realtime подписка на изменения статуса редактирования
  useEffect(() => {
    if (!userId) return;
    
    fetchEstimates();
    
    // Подписываемся на изменения в сметах (только статус редактирования)
    const channel = supabase
      .channel('estimates_editing_status')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'estimates' },
        async (payload) => {
          const updated = payload.new as Estimate;
          
          // Если изменился статус редактирования - обновляем локально
          if (updated.is_editing !== undefined || updated.editing_by !== undefined) {
            // Загружаем имя редактора если нужно
            let editorName = undefined;
            if (updated.editing_by && updated.editing_by !== userId) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('name')
                .eq('id', updated.editing_by)
                .single();
              if (profile) {
                editorName = profile.name;
              }
            }
            
            setEstimates(prev => prev.map(e => {
              if (e.id === updated.id) {
                return { 
                  ...e, 
                  ...updated,
                  editor_name: editorName
                };
              }
              return e;
            }));
          }
        }
      )
      .subscribe();
    
    // Очистка при размонтировании
    return () => {
      // Снимаем блокировку с текущей сметы если есть
      if (currentEditingIdRef.current) {
        stopEditing(currentEditingIdRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [fetchEstimates, userId, stopEditing]);

  const createEstimate = async (estimate: Omit<Estimate, 'id' | 'created_at' | 'updated_at'>, items: Omit<EstimateItem, 'id' | 'estimate_id'>[], userId: string, creatorName?: string, categoryOrder?: string[]) => {
    // Подготавливаем базовые данные сметы (только поля которые точно есть в БД)
    // Убираем пустые строки для UUID полей
    const customerId = estimate.customer_id?.trim() || null;
    
    const baseEstimate: any = {
      event_name: estimate.event_name,
      venue: estimate.venue,
      event_date: estimate.event_start_date || estimate.event_date,
      customer_id: customerId,
      total: estimate.total,
      user_id: userId,
      creator_name: creatorName
    };
    
    // Пробуем создать смету сначала с новыми полями
    let estimateData: any = null;
    let estimateError: any = null;
    
    // Пробуем с новыми полями (category_order как JSONB)
    const estimateWithNewFields = {
      ...baseEstimate,
      event_start_date: estimate.event_start_date,
      event_end_date: estimate.event_end_date,
      category_order: categoryOrder && categoryOrder.length > 0 ? JSON.stringify(categoryOrder) : null
    };
    
    const result1 = await supabase
      .from('estimates')
      .insert([estimateWithNewFields])
      .select()
      .single();
    
    if (result1.error) {
      console.log('Failed with new fields, trying without:', result1.error.message);
      // Пробуем без новых полей (fallback)
      const result2 = await supabase
        .from('estimates')
        .insert([baseEstimate])
        .select()
        .single();
      
      estimateData = result2.data;
      estimateError = result2.error;
    } else {
      estimateData = result1.data;
    }
    
    if (estimateError || !estimateData) {
      console.error('Create estimate error:', estimateError);
      toast.error('Ошибка при создании сметы', { description: estimateError?.message || 'Неизвестная ошибка' });
      return { error: estimateError };
    }

    // Добавляем позиции
    if (items.length > 0) {
      const itemsWithEstimateId = items.map(item => ({
        equipment_id: item.equipment_id,
        name: item.name,
        description: item.description || '',
        quantity: item.quantity || 1,
        price: item.price || 0,
        unit: item.unit || 'шт',
        coefficient: item.coefficient || 1,
        category: item.category || '',
        estimate_id: estimateData.id
      }));
      
      const { error: itemsError } = await supabase
        .from('estimate_items')
        .insert(itemsWithEstimateId);
      
      if (itemsError) {
        toast.error('Ошибка при добавлении позиций сметы', { description: itemsError.message });
        return { error: itemsError };
      }
    }

    await fetchEstimates();
    toast.success('Смета создана', { description: estimate.name });
    return { error: null, data: estimateData };
  };

  const updateEstimate = async (id: string, estimate: Partial<Estimate>, items?: EstimateItem[], userId?: string, categoryOrder?: string[]) => {
    // Базовые поля для обновления
    // Убираем пустые строки для UUID полей
    const customerId = estimate.customer_id?.trim() || null;
    
    const baseUpdate: any = {
      event_name: estimate.event_name,
      venue: estimate.venue,
      event_date: estimate.event_start_date || estimate.event_date,
      customer_id: customerId,
      total: estimate.total,
      updated_at: new Date().toISOString()
    };
    
    // Пробуем с новыми полями (category_order как JSONB)
    const updateWithNewFields = {
      ...baseUpdate,
      event_start_date: estimate.event_start_date,
      event_end_date: estimate.event_end_date,
      category_order: categoryOrder && categoryOrder.length > 0 ? JSON.stringify(categoryOrder) : 
                       estimate.category_order ? JSON.stringify(estimate.category_order) : null
    };
    
    if (userId) {
      updateWithNewFields.user_id = userId;
      baseUpdate.user_id = userId;
    }
    
    // Обновляем смету
    let { error: estimateError } = await supabase
      .from('estimates')
      .update(updateWithNewFields)
      .eq('id', id);
    
    // Если ошибка - пробуем без новых полей
    if (estimateError) {
      console.log('Update failed with new fields, trying without:', estimateError.message);
      const result = await supabase
        .from('estimates')
        .update(baseUpdate)
        .eq('id', id);
      estimateError = result.error;
    }
    
    if (estimateError) {
      toast.error('Ошибка при обновлении сметы', { description: estimateError.message });
      return { error: estimateError };
    }

    // Если есть позиции — обновляем их
    if (items) {
      // Удаляем старые позиции
      await supabase.from('estimate_items').delete().eq('estimate_id', id);
      
      // Добавляем новые
      if (items.length > 0) {
        const cleanItems = items.map(item => ({
          equipment_id: item.equipment_id,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          unit: item.unit,
          coefficient: item.coefficient,
          category: item.category || '',
          estimate_id: id
        }));
        
        const { error: itemsError } = await supabase
          .from('estimate_items')
          .insert(cleanItems);
        
        if (itemsError) {
          toast.error('Ошибка при обновлении позиций сметы', { description: itemsError.message });
          return { error: itemsError };
        }
      }
    }

    await fetchEstimates();
    toast.success('Смета обновлена');
    return { error: null };
  };

  const deleteEstimate = async (id: string) => {
    const { error } = await supabase
      .from('estimates')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка при удалении сметы', { description: error.message });
    } else {
      setEstimates(prev => prev.filter(e => e.id !== id));
      toast.success('Смета удалена');
    }
    return { error };
  };

  return {
    estimates,
    loading,
    createEstimate,
    updateEstimate,
    deleteEstimate,
    startEditing,
    stopEditing,
    refresh: fetchEstimates
  };
}
