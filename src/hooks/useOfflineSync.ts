import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  initOfflineDB,
  isOnline,
  checkServerStatus,
  updateServerStatus,
  setupNetworkListeners,
  saveEstimateLocal,
  getEstimatesLocal,
  markEstimateSynced,
  addToSyncQueue,
  getSyncQueue,
  removeFromSyncQueue,
  updateSyncQueueRetry,
  saveEquipmentLocal,
  getEquipmentLocal,
  clearEquipmentLocal,
  deleteEstimateLocal,
  deleteChecklistLocal,
  deleteEquipmentLocal,
  clearDeletedEstimates
} from '../lib/offlineDB';
import { supabase } from '../lib/supabase';

export function useOfflineSync(companyId: string | undefined) {
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [serverAvailable, setServerAvailable] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const syncInProgress = useRef(false);
  const onSyncCompleteRef = useRef<(() => void) | null>(null);

  // Инициализация и проверка статуса сервера
  useEffect(() => {
    initOfflineDB();
    
    // Первоначальная проверка сервера
    updateServerStatus().then(setServerAvailable);
    
    // Периодическая проверка статуса сервера (каждые 30 сек)
    const statusInterval = setInterval(async () => {
      const available = await checkServerStatus();
      setServerAvailable(available);
    }, 30000);
    
    const cleanup = setupNetworkListeners(
      () => {
        // Проверяем сервер перед показом "восстановлено"
        updateServerStatus().then(available => {
          setServerAvailable(available);
          if (available) {
            setIsOffline(false);
            toast.success('Подключение восстановлено', {
              description: 'Синхронизация данных...'
            });
            if (companyId) {
              syncData();
            }
          }
        });
      },
      () => {
        setServerAvailable(false);
        setIsOffline(true);
        toast.warning('Нет подключения', {
          description: 'Работаем в офлайн-режиме'
        });
      }
    );

    // Первоначальная загрузка с небольшой задержкой
    if (companyId && isOnline()) {
      setTimeout(() => {
        getSyncQueue().then(queue => {
          if (queue.length > 0) {
            syncData();
          } else {
            cacheEquipment();
          }
        });
      }, 1000);
    }

    return () => {
      cleanup();
      clearInterval(statusInterval);
    };

    return cleanup;
  }, [companyId]);

  // Кэширование оборудования
  const cacheEquipment = useCallback(async () => {
    if (!companyId || !isOnline()) return;
    
    try {
      const { data } = await supabase
        .from('equipment')
        .select('*')
        .eq('company_id', companyId);
      
      if (data) {
        await clearEquipmentLocal(companyId);
        for (const item of data) {
          await saveEquipmentLocal(item, companyId);
        }
      }
    } catch (err) {
      // Silent fail
    }
  }, [companyId]);

  // Синхронизация данных
  const syncData = useCallback(async (onComplete?: () => void) => {
    if (syncInProgress.current || !isOnline() || !companyId) {
      return;
    }
    
    syncInProgress.current = true;
    setSyncing(true);
    if (onComplete) onSyncCompleteRef.current = onComplete;
    
    try {
      const queue = await getSyncQueue();
      setPendingChanges(queue.length);
      
      if (queue.length === 0) {
        setSyncing(false);
        syncInProgress.current = false;
        onSyncCompleteRef.current?.();
        onSyncCompleteRef.current = null;
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      
      // Фильтруем очередь по текущей компании
      const companyQueue = queue.filter(item => 
        item.data?.company_id === companyId || 
        item.data?.company_id === undefined
      );
      
      // Добавляем company_id к записям где его нет
      for (const item of companyQueue) {
        if (item.data && item.data.company_id === undefined) {
          item.data.company_id = companyId;
        }
      }
      
      // Сортируем очередь: сначала equipment, потом estimates/checklists, потом estimate_items
      // Внутри одной таблицы: сначала create, потом update, потом delete
      // Это важно для маппинга ID
      const sortedQueue = [...companyQueue].sort((a, b) => {
        const tablePriority: Record<string, number> = {
          'equipment': 1,      // Сначала оборудование
          'checklists': 2,     // Потом чек-листы
          'estimates': 3,      // Потом сметы
          'estimate_items': 4  // В конце позиции смет
        };
        
        const opPriority: Record<string, number> = {
          'create': 1,
          'update': 2,
          'delete': 3
        };
        
        // Сначала по таблице
        const tableDiff = (tablePriority[a.table] || 5) - (tablePriority[b.table] || 5);
        if (tableDiff !== 0) return tableDiff;
        
        // Потом по операции (внутри одной таблицы)
        return (opPriority[a.operation] || 4) - (opPriority[b.operation] || 4);
      });
      
      console.log('[Sync] Sorted queue:', sortedQueue.map(i => `${i.table}(${i.operation})`));
      
      // Карта для отслеживания соответствия local_id -> server_id
      const idMapping: Record<string, string> = {};

      // Первый проход: создаём основные записи (estimates, equipment)
      for (const item of sortedQueue) {
        if (item.retryCount > 3) {
          await removeFromSyncQueue(item.id!);
          errorCount++;
          continue;
        }

        // Пропускаем дочерние записи на первом проходе
        if (item.table === 'estimate_items') continue;

        try {
          let result: any;
          const localId = item.data.id;
          
          switch (item.table) {
            case 'estimates':
              if (item.operation === 'create') {
                const { id, items, ...data } = item.data;
                result = await supabase.from('estimates').insert({
                  ...data,
                  company_id: companyId
                }).select().single();
              } else if (item.operation === 'update') {
                const { id, items, created_at, updated_at, user_id, company_id, ...data } = item.data;
                console.log('[Sync] Estimate update - original ID:', id);
                
                let serverId = id?.startsWith('local_') ? idMapping[id] : id;
                
                // Если нет маппинга и ID локальный - ищем на сервере по названию и дате
                if (!serverId && id?.startsWith('local_')) {
                  console.log('[Sync] No mapping found, searching on server...');
                  const { data: existing } = await supabase
                    .from('estimates')
                    .select('id')
                    .eq('company_id', companyId)
                    .eq('event_name', data.event_name)
                    .eq('event_date', data.event_date)
                    .limit(1);
                  
                  if (existing && existing.length > 0) {
                    serverId = existing[0].id;
                    idMapping[id] = serverId; // Сохраняем для будущего использования
                    console.log('[Sync] Found on server:', serverId);
                  }
                }
                
                if (!serverId) {
                  console.warn('[Sync] Cannot update estimate - no server ID found for:', id);
                  throw new Error('No server ID for update');
                }
                
                console.log('[Sync] Updating estimate - server ID:', serverId);
                result = await supabase.from('estimates').update(data).eq('id', serverId);
              } else if (item.operation === 'delete') {
                const { id, event_name, event_date } = item.data;
                let serverId = id?.startsWith('local_') ? idMapping[id] : id;
                
                // Если нет маппинга и ID локальный - ищем на сервере
                if (!serverId && id?.startsWith('local_')) {
                  const { data: existing } = await supabase
                    .from('estimates')
                    .select('id')
                    .eq('company_id', companyId)
                    .eq('event_name', event_name)
                    .eq('event_date', event_date)
                    .limit(1);
                  
                  if (existing && existing.length > 0) {
                    serverId = existing[0].id;
                  }
                }
                
                if (!serverId) {
                  console.warn('[Sync] Cannot delete estimate - no server ID found for:', id);
                  throw new Error('No server ID for delete');
                }
                result = await supabase.from('estimates').delete().eq('id', serverId);
              }
              break;
              
            case 'equipment':
              if (item.operation === 'create') {
                const { id, company_id, created_at, ...data } = item.data;
                result = await supabase.from('equipment').insert({
                  ...data,
                  company_id: companyId
                }).select().single();
              } else if (item.operation === 'update') {
                const { id, ...data } = item.data;
                result = await supabase.from('equipment').update(data).eq('id', id);
              } else if (item.operation === 'delete') {
                result = await supabase.from('equipment').delete().eq('id', item.data.id);
              }
              break;
              
            case 'checklists':
              if (item.operation === 'create') {
                const { id, ...data } = item.data;
                result = await supabase.from('checklists').insert({
                  ...data,
                  company_id: companyId
                }).select().single();
              } else if (item.operation === 'update') {
                const { id, ...data } = item.data;
                result = await supabase.from('checklists').update(data).eq('id', id);
              } else if (item.operation === 'delete') {
                result = await supabase.from('checklists').delete().eq('id', item.data.id);
              }
              break;
          }

          if (result?.error) {
            throw result.error;
          }

          // Для create операции - сохраняем маппинг
          if (item.operation === 'create' && result?.data?.id && localId?.startsWith('local_')) {
            idMapping[localId] = result.data.id;
            console.log('[Sync] Created on server, mapping:', localId, '->', result.data.id);
          }

          // Удаляем локальную запись после успешной синхронизации (для всех операций)
          if (localId?.startsWith('local_')) {
            if (item.table === 'estimates') {
              await deleteEstimateLocal(localId);
              console.log('[Sync] Deleted local estimate:', localId);
            } else if (item.table === 'equipment') {
              await deleteEquipmentLocal(localId);
              console.log('[Sync] Deleted local equipment:', localId);
            } else if (item.table === 'checklists') {
              await deleteChecklistLocal(localId);
              console.log('[Sync] Deleted local checklist:', localId);
            }
          }

          await removeFromSyncQueue(item.id!);
          successCount++;
          
        } catch (err) {
          await updateSyncQueueRetry(item.id!, item.retryCount + 1);
          errorCount++;
        }
      }

      // Второй проход: создаём дочерние записи (estimate_items)
      for (const item of sortedQueue) {
        if (item.table !== 'estimate_items') continue;
        if (item.retryCount > 3) {
          await removeFromSyncQueue(item.id!);
          continue;
        }

        try {
          let result: any;
          
          if (item.operation === 'create') {
            const { estimateId, items } = item.data;
            
            // Заменяем local_id на server_id
            let serverEstimateId = idMapping[estimateId];
            
            // Если маппинг не найден - пропускаем
            if (!serverEstimateId) {
              await updateSyncQueueRetry(item.id!, item.retryCount + 1);
              errorCount++;
              continue;
            }
            
            if (items && items.length > 0) {
              // Проверяем что все equipment_id замаплены
              const hasUnmappedEquipment = items.some((item: any) => 
                item.equipment_id?.startsWith('local_') && !idMapping[item.equipment_id]
              );
              
              if (hasUnmappedEquipment) {
                console.warn('[Sync] Some equipment not yet synced, retrying later');
                await updateSyncQueueRetry(item.id!, item.retryCount + 1);
                errorCount++;
                continue;
              }
              
              const validItems = items
                .filter((item: any) => item.name || item.equipment_id)
                .map((item: any, idx: number) => {
                  const { id, estimate_id, ...itemData } = item;
                  
                  // Заменяем equipment_id если он локальный
                  let serverEquipmentId = itemData.equipment_id;
                  if (itemData.equipment_id?.startsWith('local_')) {
                    serverEquipmentId = idMapping[itemData.equipment_id];
                    console.log('[Sync] Mapped equipment:', itemData.equipment_id, '->', serverEquipmentId);
                  }
                  
                  return {
                    ...itemData,
                    equipment_id: serverEquipmentId || itemData.equipment_id,
                    estimate_id: serverEstimateId,
                    company_id: companyId,
                    order_index: idx
                  };
                });
              
              if (validItems.length > 0) {
                console.log('[Sync] Inserting estimate_items:', validItems.length);
                result = await supabase.from('estimate_items').insert(validItems);
              }
            }
          }

          if (result?.error) {
            throw result.error;
          }

          await removeFromSyncQueue(item.id!);
          successCount++;
          console.log('[Sync] Successfully synced estimate_items');
          
        } catch (err) {
          console.error('[Sync] Error syncing estimate_items:', err);
          await updateSyncQueueRetry(item.id!, item.retryCount + 1);
          errorCount++;
        }
      }

      // Обновляем счётчик
      const remaining = await getSyncQueue();
      setPendingChanges(remaining.length);

      if (successCount > 0) {
        toast.success(`Синхронизировано: ${successCount} изменений`);
      }
      if (errorCount > 0) {
        toast.error(`Ошибок синхронизации: ${errorCount}`);
      }

      // Обновляем кэш
      await cacheEquipment();
      
      // Очищаем список удалённых смет (если синхронизация успешна)
      if (successCount > 0 && errorCount === 0) {
        await clearDeletedEstimates();
      }
      
      // Вызываем callback для обновления UI
      onSyncCompleteRef.current?.();
      onSyncCompleteRef.current = null;
      
    } catch (err) {
      // Silent fail
    } finally {
      setSyncing(false);
      syncInProgress.current = false;
    }
  }, [companyId]);

  return {
    isOffline,
    serverAvailable,
    syncing,
    pendingChanges,
    syncData,
    cacheEquipment
  };
}
