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
    // Подготавливаем данные сметы с датами и user_id
    const estimateToSave: any = {
      ...estimate,
      user_id: userId,
      event_date: estimate.event_start_date || estimate.event_date,
      creator_name: creatorName
    };
    
    // Добавляем порядок категорий если есть
    if (categoryOrder && categoryOrder.length > 0) {
      estimateToSave.category_order = categoryOrder;
    }
    
    // Создаем смету
    const { data: estimateData, error: estimateError } = await supabase
      .from('estimates')
      .insert([estimateToSave])
      .select()
      .single();
    
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
    // Подготавливаем данные для обновления
    const estimateToUpdate: any = {
      ...estimate,
      event_date: estimate.event_start_date || estimate.event_date,
      updated_at: new Date().toISOString()
    };
    
    // Добавляем порядок категорий если передан
    if (categoryOrder && categoryOrder.length > 0) {
      estimateToUpdate.category_order = categoryOrder;
    } else if (estimate.category_order) {
      estimateToUpdate.category_order = estimate.category_order;
    }
    
    // Добавляем user_id если передан (для новых записей)
    if (userId) {
      estimateToUpdate.user_id = userId;
    }
    
    // Обновляем смету
    const { error: estimateError } = await supabase
      .from('estimates')
      .update(estimateToUpdate)
      .eq('id', id);
    
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
