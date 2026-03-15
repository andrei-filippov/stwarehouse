import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Estimate, EstimateItem } from '../types';
import {
  initOfflineDB,
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
  const fetchInProgressRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Загрузка смет - в онлайн с сервера + локальные несинхронизированные, в оффлайн из кэша
  const fetchEstimates = useCallback(async () => {
    if (!companyId) return;
    if (fetchInProgressRef.current) {
      console.log('[fetchEstimates] Already in progress, skipping');
      return;
    }
    fetchInProgressRef.current = true;
    setLoading(true);
    
    console.log('[fetchEstimates] ========== START ==========', new Date().toISOString());
    
    try {
      // Всегда загружаем локальные сметы (на случай если есть несинхронизированные)
      console.log('[fetchEstimates] Loading local estimates for company:', companyId);
      const localEstimates = await getEstimatesLocal(companyId);
      console.log('[fetchEstimates] Local estimates:', localEstimates);
      const localOnly = localEstimates.filter(e => e && e.id); // Убираем пустые записи
      console.log('[fetchEstimates] Filtered local estimates:', localOnly.length, localOnly);
      
      // Загружаем список удалённых локально смет (чтобы не показывать их снова)
      const deletedIds = await getDeletedEstimates();
      console.log('[fetchEstimates] Deleted estimate IDs:', deletedIds);
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
          
          // Дедуплицируем серверные данные по сигнатуре (event_name + event_date)
          // Если есть дубликаты, оставляем только первый (самый новый по created_at)
          const seenSignatures = new Set<string>();
          const deduplicatedServer = filteredServer.filter(e => {
            const signature = `${e.event_name?.toLowerCase().trim()}_${e.event_date}`;
            if (seenSignatures.has(signature)) {
              console.log('[fetchEstimates] Removing server duplicate:', e.id, signature);
              return false;
            }
            seenSignatures.add(signature);
            return true;
          });
          
          // Мержим: серверные (без удалённых) + локальные НОВЫЕ (с local_* ID) которых нет на сервере
          // + локальные с серверными ID которые были изменены оффлайн (новее чем на сервере)
          const serverIds = new Set(deduplicatedServer.map(e => e.id));
          const serverDataMap = new Map(deduplicatedServer.map(e => [e.id, e]));
          
          // Разделяем локальные записи:
          // 1. Новые созданные офлайн (local_*) - показываем если нет на сервере
          // 2. Скопированные с сервера (обычные ID) - удаляем из локальной базы если нет на сервере
          // 3. Изменённые оффлайн (серверный ID но новая дата) - показываем локальную версию
          const modifiedOffline: Estimate[] = [];
          const newLocal = localOnly.filter(e => {
            const isNewOffline = e.id?.startsWith('local_');
            const existsOnServer = serverIds.has(e.id);
            
            if (isNewOffline && !existsOnServer) {
              return true; // Новая офлайн запись - показываем
            }
            
            if (!isNewOffline && !existsOnServer) {
              // Запись была удалена на сервере - удаляем из локальной базы
              console.log('[fetchEstimates] Removing locally cached estimate deleted on server:', e.id);
              deleteEstimateLocal(e.id).catch(console.error);
              return false;
            }
            
            // Смета с серверным ID существует на сервере
            // Проверяем, была ли она изменена оффлайн (локальная версия новее)
            if (!isNewOffline && existsOnServer) {
              const serverVersion = serverDataMap.get(e.id);
              const localUpdated = new Date(e.updated_at || 0).getTime();
              const serverUpdated = new Date(serverVersion?.updated_at || 0).getTime();
              
              // Если локальная версия новее на более чем 5 секунд - используем её
              if (localUpdated > serverUpdated + 5000) {
                console.log('[fetchEstimates] Local version is newer, will use local:', e.id);
                modifiedOffline.push(e);
                return false; // Не включаем в newLocal, добавим отдельно
              }
            }
            
            return false; // Уже есть на сервере
          });
          
          // Убираем дубликаты: если локальная запись похожа на серверную (по имени события и дате),
          // считаем что это дубль и удаляем из локальной базы
          const serverSignatures = new Set(
            deduplicatedServer.map(e => `${e.event_name?.toLowerCase().trim()}_${e.event_date}`)
          );
          const uniqueLocal = newLocal.filter(local => {
            const signature = `${local.event_name?.toLowerCase().trim()}_${local.event_date}`;
            // Если есть такая же на сервере - удаляем локальную из базы и пропускаем
            if (serverSignatures.has(signature)) {
              console.log('[fetchEstimates] Removing duplicate local estimate:', local.id);
              deleteEstimateLocal(local.id).catch(console.error);
              return false;
            }
            return true;
          });
          
          // Сначала локальные изменённые оффлайн (приоритет), потом новые local_*, потом серверные
          const modifiedOfflineIds = new Set(modifiedOffline.map(e => e.id));
          const serverWithoutModified = deduplicatedServer.filter(e => !modifiedOfflineIds.has(e.id));
          const merged = [...modifiedOffline, ...uniqueLocal, ...serverWithoutModified];
          
          // Финальная защита: убираем дубликаты по ID (первый имеет приоритет)
          const seenIds = new Set<string>();
          const deduplicated = merged.filter(e => {
            if (seenIds.has(e.id)) {
              console.log('[fetchEstimates] Removing duplicate by ID:', e.id);
              return false;
            }
            seenIds.add(e.id);
            return true;
          });
          
          setEstimates(deduplicated);
          
          // СОХРАНЯЕМ серверные данные в локальную базу для офлайн-доступа
          // (только серверные ID, без перезаписи существующих локальных)
          const localIds = new Set(localOnly.map(e => e.id));
          
          // Удаляем локальные дубликаты (по содержимому) перед кэшированием
          for (const localEstimate of localOnly) {
            if (localEstimate.id?.startsWith('local_')) {
              // Ищем серверную копию по названию и дате
              const serverDuplicate = deduplicatedServer.find(
                e => e.event_name === localEstimate.event_name && 
                     e.event_date === localEstimate.event_date
              );
              if (serverDuplicate) {
                console.log('[fetchEstimates] Removing local duplicate:', localEstimate.id);
                await deleteEstimateLocal(localEstimate.id);
              }
            }
          }
          
          // Кэшируем серверные данные
          // НЕ кэшируем сметы, которые были изменены оффлайн (modifiedOffline)
          // Используем уже созданный modifiedOfflineIds
          
          for (const estimate of deduplicatedServer) {
            // Сохраняем только если:
            // 1. Это серверный ID (не local_*)
            // 2. Такой записи ещё нет локально
            // 3. Это не смета, изменённая оффлайн (не в modifiedOffline)
            if (!estimate.id?.startsWith('local_') && 
                !localIds.has(estimate.id) && 
                !modifiedOfflineIds.has(estimate.id)) {
              try {
                await saveEstimateLocal(estimate, companyId);
                console.log('[fetchEstimates] Cached server estimate:', estimate.id);
              } catch (saveErr) {
                console.warn('[fetchEstimates] Failed to cache estimate:', estimate.id, saveErr);
              }
            }
          }
        } catch (err) {
          // Ошибка сети (503 и т.д.) - показываем только локальные
          console.log('[fetchEstimates] Network error, showing local data');
          setEstimates(localOnly);
        }
      } else {
        // ОФФЛАЙН: показываем только локальные сметы (без удалённых)
        console.log('[fetchEstimates] Offline mode, showing local data');
        setEstimates(localOnly.filter(e => !isDeleted(e.id)));
      }
    } catch (e) {
      console.error('[fetchEstimates] Error loading estimates:', e);
      setEstimates([]);
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
      console.log('[fetchEstimates] ========== END ==========', new Date().toISOString());
    }
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
    
    // Убедимся что IndexedDB инициализирован
    await initOfflineDB();
    
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
        console.log('[createEstimate] Creating estimate offline, localId:', localId, 'items count:', items?.length || 0);
        try {
          // ОФФЛАЙН - сохраняем только локально и в очередь
          console.log('[createEstimate] Calling saveEstimateLocal...');
          await saveEstimateLocal(estimateData, companyId);
          console.log('[createEstimate] Saved to local DB successfully');
          console.log('[createEstimate] Calling addToSyncQueue...');
          await addToSyncQueue('estimates', 'create', estimateData);
          console.log('[createEstimate] Added to sync queue successfully');
        } catch (e) {
          console.error('[createEstimate] Error saving offline:', e);
          toast.error('Ошибка сохранения офлайн', { description: String(e) });
        }
        // Фильтруем пустые позиции и добавляем в очередь только если есть валидные
        const validItems = items.filter(item => item.name || item.equipment_id);
        if (validItems.length > 0) {
          console.log('[createEstimate] Adding items to sync queue:', validItems.length);
          await addToSyncQueue('estimate_items', 'create', { 
            estimateId: localId,
            items: estimateData.items,
            company_id: companyId
          });
        } else {
          console.log('[createEstimate] No valid items to add to queue');
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
      let useOffline = false;
      
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

          // Удаляем локальную версию если была (чтобы не было конфликтов)
          await deleteEstimateLocal(id).catch(() => {});
          
          await fetchEstimates();
          toast.success('Смета обновлена');
          return { error: null };
        } catch (err: any) {
          // Проверяем тип ошибки
          const isNetworkError = err.message?.includes('fetch') || 
                                err.message?.includes('network') || 
                                err.code === 'NETWORK_ERROR';
          const isServerError = err.status === 500 || err.status === 503;
          
          // Если это ошибка клиента (400), показываем ошибку и не переходим в офлайн
          if (err.status === 400) {
            console.error('Validation error (400):', err);
            toast.error('Ошибка сохранения', { 
              description: err.message || 'Проверьте данные и попробуйте снова' 
            });
            return { error: err };
          }
          
          // Только при сетевых ошибках переходим в офлайн
          if (isNetworkError || isServerError) {
            console.log('Network error, switching to offline mode:', err);
            useOffline = true;
          } else {
            // Другие ошибки - показываем и выходим
            throw err;
          }
        }
      } else {
        // Нет сети или локальная смета
        useOffline = true;
      }
      
      // ОФФЛАЙН режим (только если useOffline = true)
      if (useOffline) {
        await saveEstimateLocal(estimateData, companyId);
        await addToSyncQueue('estimates', isLocalId ? 'create' : 'update', estimateData);
        console.log('[updateEstimate] Adding estimate_items to queue:', id, 'items:', estimateData.items?.length);
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
      }
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
      const estimate = localEstimates.find(e => e.id === id);
      
      if (estimate) {
        const updatedEstimate = { ...estimate, status, updated_at: new Date().toISOString() };
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
      // Задержка перед fetchEstimates чтобы дать время на синхронизацию
      // (useOfflineSync запускает syncData при восстановлении сети)
      setTimeout(() => {
        // Проверяем что синхронизация не в процессе
        if (!(window as any).__syncing) {
          fetchEstimates();
        } else {
          console.log('[handleOnline] Sync in progress, skipping fetchEstimates');
        }
      }, 2000);
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

  // Debounced fetch для realtime подписки
  // Задержка увеличена до 1.5с чтобы избежать race condition с синхронизацией
  const debouncedFetchEstimates = useCallback(() => {
    // Проверяем глобальный флаг синхронизации из useOfflineSync
    if ((window as any).__syncing) {
      console.log('[debouncedFetchEstimates] Sync in progress (global), skipping');
      return;
    }
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      if (!(window as any).__syncing) {
        fetchEstimates();
      }
    }, 1500);
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
          debouncedFetchEstimates();
        }
      )
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estimate_items',
          filter: `company_id=eq.${companyId}`
        },
        () => debouncedFetchEstimates()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [debouncedFetchEstimates, companyId]);

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
