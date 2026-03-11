import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Estimate, EstimateItem } from '../types';

// Генерируем уникальный ID сессии для этой вкладки
const SESSION_ID = Math.random().toString(36).substring(2, 15);

export function useEstimates(companyId: string | undefined) {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(false);
  const currentEditingIdRef = useRef<string | null>(null);

  const fetchEstimates = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    
    // Загружаем сметы с фильтром по company_id
    const { data, error } = await supabase
      .from('estimates')
      .select(`
        *,
        items:estimate_items(*)
      `)
      .eq('company_id', companyId)
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
          });;
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
  }, [companyId]);

  // Устанавливаем статус "редактируется" при открытии сметы
  const startEditing = useCallback(async (estimateId: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    currentEditingIdRef.current = estimateId;
    
    const { error } = await supabase
      .from('estimates')
      .update({
        is_editing: true,
        editing_by: (await supabase.auth.getUser()).data.user?.id,
        editing_since: new Date().toISOString(),
        editing_session_id: SESSION_ID
      })
      .eq('id', estimateId);
    
    return { error };
  }, [companyId]);

  // Снимаем статус "редактируется" при закрытии сметы
  const stopEditing = useCallback(async (estimateId: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    if (currentEditingIdRef.current === estimateId) {
      currentEditingIdRef.current = null;
    }
    
    const { error } = await supabase
      .from('estimates')
      .update({
        is_editing: false,
        editing_by: null,
        editing_since: null,
        editing_session_id: null
      })
      .eq('id', estimateId);
    
    return { error };
  }, [companyId]);

  // Создание сметы с company_id
  const createEstimate = useCallback(async (
    estimate: Partial<Estimate>, 
    items: Partial<EstimateItem>[],
    userId: string,
    creatorName?: string,
    categoryOrder?: string[]
  ) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      // Создаём смету с company_id
      const { data: newEstimate, error: estimateError } = await supabase
        .from('estimates')
        .insert({
          ...estimate,
          company_id: companyId,
          user_id: userId,
          creator_name: creatorName,
          category_order: categoryOrder || []
        })
        .select()
        .single();

      if (estimateError) throw estimateError;

      // Создаём позиции с company_id
      if (items.length > 0) {
        const itemsWithIds = items.map((item, index) => {
          // Удаляем id, чтобы PostgreSQL сгенерировал новый UUID
          // и оставляем только валидные поля
          const { id, ...itemWithoutId } = item;
          return {
            ...itemWithoutId,
            estimate_id: newEstimate.id,
            company_id: companyId,
            order_index: index
          };
        });;

        const { error: itemsError } = await supabase
          .from('estimate_items')
          .insert(itemsWithIds);

        if (itemsError) throw itemsError;
      }

      await fetchEstimates();
      toast.success('Смета создана');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при создании сметы', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchEstimates]);

  // Обновление сметы
  const updateEstimate = useCallback(async (
    id: string, 
    estimate: Partial<Estimate>, 
    items: Partial<EstimateItem>[],
    userId: string,
    categoryOrder?: string[]
  ) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      // Обновляем смету
      const { error: estimateError } = await supabase
        .from('estimates')
        .update({
          ...estimate,
          category_order: categoryOrder || []
        })
        .eq('id', id)
        .eq('company_id', companyId); // Дополнительная проверка

      if (estimateError) throw estimateError;

      // Удаляем старые позиции
      await supabase
        .from('estimate_items')
        .delete()
        .eq('estimate_id', id);

      // Создаём новые позиции
      if (items.length > 0) {
        const itemsWithIds = items.map((item, index) => {
          // Удаляем id, чтобы PostgreSQL сгенерировал новый UUID
          // и оставляем только валидные поля
          const { id: _, ...itemWithoutId } = item;
          return {
            ...itemWithoutId,
            estimate_id: id,
            company_id: companyId,
            order_index: index
          };
        })

        const { error: itemsError } = await supabase
          .from('estimate_items')
          .insert(itemsWithIds);

        if (itemsError) throw itemsError;
      }

      await fetchEstimates();
      toast.success('Смета обновлена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении сметы', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchEstimates]);

  // Удаление сметы
  const deleteEstimate = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('estimates')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId); // Дополнительная проверка

      if (error) throw error;

      await fetchEstimates();
      toast.success('Смета удалена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении сметы', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchEstimates]);

  useEffect(() => {
    fetchEstimates();
  }, [fetchEstimates]);

  // Подписка на изменения с фильтром по company_id
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('estimates-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'estimates',
          filter: `company_id=eq.${companyId}`
        },
        () => fetchEstimates()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEstimates, companyId]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (currentEditingIdRef.current) {
        stopEditing(currentEditingIdRef.current);
      }
    };
  }, [stopEditing]);

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
