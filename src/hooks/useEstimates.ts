import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Estimate, EstimateItem } from '../types';
import {
  isOnline,
  saveEstimateLocal,
  getEstimatesLocal,
  deleteEstimateLocal,
  addToSyncQueue,
  getSyncQueue,
  markEstimateDeleted,
  getDeletedEstimates,
  clearDeletedEstimates
} from '../lib/offlineDB';

// Генерируем уникальный ID сессии для этой вкладки
const SESSION_ID = Math.random().toString(36).substring(2, 15);

export function useEstimates(companyId: string | undefined) {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!isOnline());
  const currentEditingIdRef = useRef<string | null>(null);

  // Загрузка смет - в онлайн с сервера + локальные несинхронизированные, в оффлайн из кэша
  const fetchEstimates = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    
    // Всегда загружаем локальные сметы (на случай если есть несинхронизированные)
    const localEstimates = await getEstimatesLocal(companyId);
    const localOnly = localEstimates.map(e => e.data);
    
    // Загружаем список удалённых локально смет (чтобы не показывать их снова)
    const deletedIds = await getDeletedEstimates();
    const isDeleted = (id: string) => deletedIds.includes(id);
    
    if (isOnline()) {
      // ОНЛАЙН: загружаем с сервера и мержим с локальными
      try {
        const { data, error } = await supabase
          .from('estimates')
          .select(`
            *,
            items:estimate_items(*)
          `)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });
        
        if (error) {
          throw error;
        }
        
        // Фильтруем серверные данные - убираем удалённые локально
        const filteredServer = (data || []).filter(e => !isDeleted(e.id));
        
        // Мержим: серверные (без удалённых) + локальные которых нет на сервере
        const serverIds = new Set((data || []).map(e => e.id));
        const unsyncedLocal = localOnly.filter(e => !serverIds.has(e.id));
        
        // Сначала локальные (новые), потом серверные
        setEstimates([...unsyncedLocal, ...(filteredServer as Estimate[])]);
      } catch (err) {
        // Ошибка сети (503 и т.д.) - показываем только локальные
        setEstimates(localOnly);
      }
    } else {
      // ОФФЛАЙН: показываем только локальные сметы (без удалённых)
      setEstimates(localOnly.filter(e => !isDeleted(e.id)));
    }
    
    setLoading(false);
  }, [companyId]);

  // Устанавливаем статус "редактируется" при открытии сметы
  const startEditing = useCallback(async (estimateId: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    currentEditingIdRef.current = estimateId;
    
    // Пропускаем для локальных смет или в оффлайн режиме
    const isLocalId = estimateId.startsWith('local_');
    if (isLocalId || !isOnline()) return { error: null };
    
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
    
    // Пропускаем для локальных смет или в оффлайн режиме
    const isLocalId = estimateId.startsWith('local_');
    if (isLocalId || !isOnline()) return { error: null };
    
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

  // Создание сметы с поддержкой оффлайн
  const createEstimate = useCallback(async (
    estimate: Partial<Estimate>, 
    items: Partial<EstimateItem>[],
    userId: string,
    creatorName?: string,
    categoryOrder?: string[]
  ) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      // Генерируем локальный ID для оффлайн-создания
      const localId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const estimateData = {
        ...estimate,
        id: localId,
        company_id: companyId,
        user_id: userId,
        creator_name: creatorName,
        category_order: categoryOrder || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: items.map((item, index) => ({
          ...item,
          id: `local_item_${Date.now()}_${index}`,
          estimate_id: localId,
          company_id: companyId,
          order_index: index
        }))
      };
      
      if (isOnline()) {
        try {
          // Пробуем сохранить на сервер
          const { id, items: _, ...estimateClean } = estimateData;
          
          const { data: newEstimate, error: estimateError } = await supabase
            .from('estimates')
            .insert({
              ...estimateClean,
              company_id: companyId,
              user_id: userId,
              creator_name: creatorName,
              category_order: categoryOrder || []
            })
            .select()
            .single();

          if (estimateError) throw estimateError;

          // Создаём позиции
          if (items.length > 0) {
            const itemsWithIds = items.map((item, index) => {
              const { id, ...itemWithoutId } = item;
              return {
                ...itemWithoutId,
                estimate_id: newEstimate.id,
                company_id: companyId,
                order_index: index
              };
            });

            const { error: itemsError } = await supabase
              .from('estimate_items')
              .insert(itemsWithIds);

            if (itemsError) throw itemsError;
          }

          await fetchEstimates();
          toast.success('Смета создана');
          return { error: null, data: newEstimate };
        } catch (err: any) {
          // Если ошибка сети - переключаемся на оффлайн режим
          console.log('Network error, switching to offline mode:', err);
          // Продолжаем в оффлайн-блок ниже
        }
      }
      
      // ОФФЛАЙН режим (или fallback при ошибке сети)
        console.log('Creating estimate offline, localId:', localId);
        try {
          // ОФФЛАЙН - сохраняем только локально и в очередь
          await saveEstimateLocal(estimateData, companyId);
          console.log('Saved to local DB, adding to sync queue...');
          await addToSyncQueue('estimates', 'create', estimateData);
          console.log('Added estimates to queue');
        } catch (e) {
          console.error('Error saving offline:', e);
        }
        if (items.length > 0) {
          await addToSyncQueue('estimate_items', 'create', { 
            estimateId: localId,
            items: estimateData.items,
            company_id: companyId
          });
        }
        
        // Обновляем UI только локальными данными
        setEstimates(prev => [estimateData as Estimate, ...prev]);
        
        toast.info('Смета сохранена офлайн', {
          description: 'Будет синхронизирована при подключении'
        });
        return { error: null, data: estimateData, queued: true };
    } catch (err: any) {
      toast.error('Ошибка при создании сметы', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchEstimates]);

  // Обновление сметы с поддержкой оффлайн
  const updateEstimate = useCallback(async (
    id: string, 
    estimate: Partial<Estimate>, 
    items: Partial<EstimateItem>[],
    userId: string,
    categoryOrder?: string[]
  ) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const estimateData = {
        ...estimate,
        id,
        company_id: companyId,
        category_order: categoryOrder || [],
        updated_at: new Date().toISOString(),
        items: items.map((item, index) => ({
          ...item,
          estimate_id: id,
          company_id: companyId,
          order_index: index
        }))
      };
      
      // Проверяем, локальная ли это смета
      const isLocalId = id.startsWith('local_');
      
      if (isOnline() && !isLocalId) {
        try {
          // Пробуем обновить на сервере
          const { error: estimateError } = await supabase
            .from('estimates')
            .update({
              ...estimate,
              category_order: categoryOrder || []
            })
            .eq('id', id)
            .eq('company_id', companyId);

          if (estimateError) throw estimateError;

          // Удаляем старые позиции
          await supabase
            .from('estimate_items')
            .delete()
            .eq('estimate_id', id);

          // Создаём новые позиции
          if (items.length > 0) {
            const itemsWithIds = items.map((item, index) => {
              const { id: _, ...itemWithoutId } = item;
              return {
                ...itemWithoutId,
                estimate_id: id,
                company_id: companyId,
                order_index: index
              };
            });

            const { error: itemsError } = await supabase
              .from('estimate_items')
              .insert(itemsWithIds);

            if (itemsError) throw itemsError;
          }

          await fetchEstimates();
          toast.success('Смета обновлена');
          return { error: null };
        } catch (err) {
          // При ошибке сети продолжаем в оффлайн-режиме
          console.log('Network error, switching to offline mode:', err);
        }
      }
      
      // ОФФЛАЙН режим (или fallback)
        // ОФФЛАЙН или локальная смета - обновляем локально
        await saveEstimateLocal(estimateData, companyId);
        await addToSyncQueue('estimates', isLocalId ? 'create' : 'update', estimateData);
        await addToSyncQueue('estimate_items', 'create', {
          estimateId: id,
          items: estimateData.items,
          company_id: companyId
        });
        
        // Обновляем UI
        setEstimates(prev => prev.map(e => e.id === id ? estimateData as Estimate : e));
        
        toast.info('Смета обновлена офлайн', {
          description: 'Будет синхронизирована при подключении'
        });
        return { error: null, queued: true };
    } catch (err: any) {
      toast.error('Ошибка при обновлении сметы', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchEstimates]);

  // Удаление сметы с поддержкой оффлайн
  const deleteEstimate = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const isLocalId = id.startsWith('local_');
      
      if (isOnline() && !isLocalId) {
        try {
          // Онлайн - удаляем с сервера
          const { error } = await supabase
            .from('estimates')
            .delete()
            .eq('id', id)
            .eq('company_id', companyId);

          if (error) throw error;
          
          // Успешно удалено на сервере
          setEstimates(prev => prev.filter(e => e.id !== id));
          toast.success('Смета удалена');
          return { error: null };
        } catch (err) {
          console.log('Network error, switching to offline mode:', err);
        }
      }
      
      // Оффлайн или fallback
      await deleteEstimateLocal(id);
      
      // Помечаем как удалённую (чтобы не появлялась снова при загрузке)
      await markEstimateDeleted(id);
      
      if (!isLocalId) {
        await addToSyncQueue('estimates', 'delete', { id });
      }
      
      // Обновляем UI
      setEstimates(prev => prev.filter(e => e.id !== id));
      
      toast.success('Смета удалена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении сметы', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  // Обновление статуса сметы (для аналитики)
  const updateEstimateStatus = useCallback(async (id: string, status: 'draft' | 'pending' | 'completed' | 'cancelled') => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const isLocalId = id.startsWith('local_');
      
      if (isOnline() && !isLocalId) {
        try {
          const { error } = await supabase
            .from('estimates')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('company_id', companyId);

          if (error) throw error;
          
          // Обновляем UI
          setEstimates(prev => prev.map(e => e.id === id ? { ...e, status } as Estimate : e));
          toast.success('Статус обновлён');
          return { error: null };
        } catch (err) {
          // Fallback к локальному обновлению
        }
      }
      
      // Офлайн режим - обновляем локально
      const localEstimates = await getEstimatesLocal(companyId);
      const estimate = localEstimates.find(e => e.data.id === id);
      
      if (estimate) {
        const updatedEstimate = { ...estimate.data, status, updated_at: new Date().toISOString() };
        await saveEstimateLocal(updatedEstimate, companyId);
        await addToSyncQueue('estimates', 'update', updatedEstimate);
        
        setEstimates(prev => prev.map(e => e.id === id ? updatedEstimate as Estimate : e));
        toast.info('Статус обновлён офлайн');
        return { error: null, queued: true };
      }
      
      return { error: new Error('Смета не найдена') };
    } catch (err: any) {
      toast.error('Ошибка при обновлении статуса', { description: err.message });
      return { error: err };
    }
  }, [companyId]);

  // Отслеживание статуса сети
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Подключение восстановлено');
      // Переключаемся на серверные данные
      fetchEstimates();
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      toast.warning('Нет подключения');
      // Переключаемся на локальные данные
      fetchEstimates();
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchEstimates]);

  useEffect(() => {
    fetchEstimates();
  }, [fetchEstimates]);

  // Подписка на изменения (только в онлайн режиме)
  useEffect(() => {
    if (!companyId || !isOnline()) return;

    const channel = supabase
      .channel('estimates-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'estimates',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newEstimate = payload.new as Estimate;
            if (newEstimate.creator_name) {
              toast.info('Новая смета создана', { 
                description: `${newEstimate.event_name} — ${newEstimate.creator_name}` 
              });
            }
          }
          fetchEstimates();
        }
      )
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estimate_items',
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
      if (currentEditingIdRef.current && isOnline()) {
        stopEditing(currentEditingIdRef.current);
      }
    };
  }, [stopEditing]);

  return {
    estimates,
    loading,
    isOffline,
    createEstimate,
    updateEstimate,
    deleteEstimate,
    updateEstimateStatus,
    startEditing,
    stopEditing,
    refresh: fetchEstimates
  };
}
