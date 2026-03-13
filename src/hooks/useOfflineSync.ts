import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  initOfflineDB,
  isOnline,
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
  clearDeletedEstimates
} from '../lib/offlineDB';
import { supabase } from '../lib/supabase';

export function useOfflineSync(companyId: string | undefined) {
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [syncing, setSyncing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const syncInProgress = useRef(false);
  const onSyncCompleteRef = useRef<(() => void) | null>(null);

  // Инициализация
  useEffect(() => {
    initOfflineDB();
    
    const cleanup = setupNetworkListeners(
      () => {
        setIsOffline(false);
        toast.success('Подключение восстановлено', {
          description: 'Синхронизация данных...'
        });
        if (companyId) {
          syncData();
        }
      },
      () => {
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
      
      // Сортируем очередь: сначала estimates/equipment, потом estimate_items
      const sortedQueue = [...companyQueue].sort((a, b) => {
        if (a.table === 'estimate_items' && b.table !== 'estimate_items') return 1;
        if (a.table !== 'estimate_items' && b.table === 'estimate_items') return -1;
        return 0;
      });
      
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
                const { id, items, ...data } = item.data;
                result = await supabase.from('estimates').update(data).eq('id', id);
              } else if (item.operation === 'delete') {
                result = await supabase.from('estimates').delete().eq('id', item.data.id);
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
          }

          if (result?.error) {
            throw result.error;
          }

          // Сохраняем соответствие local_id -> server_id
          if (result?.data?.id && localId?.startsWith('local_')) {
            idMapping[localId] = result.data.id;
            
            // Удаляем локальную запись
            if (item.table === 'estimates') {
              await deleteEstimateLocal(localId);
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
              const validItems = items
                .filter((item: any) => item.name || item.equipment_id)
                .map((item: any, idx: number) => {
                  const { id, estimate_id, ...itemData } = item;
                  return {
                    ...itemData,
                    estimate_id: serverEstimateId,
                    company_id: companyId,
                    order_index: idx
                  };
                });
              
              if (validItems.length > 0) {
                result = await supabase.from('estimate_items').insert(validItems);
              }
            }
          }

          if (result?.error) {
            throw result.error;
          }

          await removeFromSyncQueue(item.id!);
          
        } catch (err) {
          await updateSyncQueueRetry(item.id!, item.retryCount + 1);
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
    syncing,
    pendingChanges,
    syncData,
    cacheEquipment
  };
}
