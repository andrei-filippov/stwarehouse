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
  clearEquipmentLocal
} from '../lib/offlineDB';
import { supabase } from '../lib/supabase';

export function useOfflineSync(companyId: string | undefined) {
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [syncing, setSyncing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const syncInProgress = useRef(false);

  // Инициализация
  useEffect(() => {
    initOfflineDB();
    
    const cleanup = setupNetworkListeners(
      () => {
        setIsOffline(false);
        toast.success('Подключение восстановлено', {
          description: 'Синхронизация данных...'
        });
        syncData();
      },
      () => {
        setIsOffline(true);
        toast.warning('Нет подключения', {
          description: 'Работаем в офлайн-режиме'
        });
      }
    );

    // Первоначальная загрузка
    if (companyId && isOnline()) {
      cacheEquipment();
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
      console.error('Ошибка кэширования оборудования:', err);
    }
  }, [companyId]);

  // Синхронизация данных
  const syncData = useCallback(async () => {
    if (syncInProgress.current || !isOnline() || !companyId) return;
    
    syncInProgress.current = true;
    setSyncing(true);
    
    try {
      const queue = await getSyncQueue();
      setPendingChanges(queue.length);
      
      if (queue.length === 0) {
        setSyncing(false);
        syncInProgress.current = false;
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const item of queue) {
        if (item.retryCount > 3) {
          await removeFromSyncQueue(item.id!);
          errorCount++;
          continue;
        }

        try {
          let result;
          
          switch (item.table) {
            case 'estimates':
              if (item.operation === 'create') {
                const { id, ...data } = item.data;
                result = await supabase.from('estimates').insert(data).select().single();
              } else if (item.operation === 'update') {
                const { id, ...data } = item.data;
                result = await supabase.from('estimates').update(data).eq('id', id);
              } else if (item.operation === 'delete') {
                result = await supabase.from('estimates').delete().eq('id', item.data.id);
              }
              break;
              
            case 'estimate_items':
              if (item.operation === 'create') {
                const { items } = item.data;
                if (items && items.length > 0) {
                  result = await supabase.from('estimate_items').insert(items);
                }
              }
              break;
              
            case 'equipment':
              if (item.operation === 'create') {
                const { id, company_id, created_at, ...data } = item.data;
                // Генерируем новый UUID для сервера
                result = await supabase.from('equipment').insert({
                  ...data,
                  company_id: companyId
                });
              } else if (item.operation === 'update') {
                const { id, ...data } = item.data;
                result = await supabase.from('equipment').update(data).eq('id', id);
              } else if (item.operation === 'delete') {
                result = await supabase.from('equipment').delete().eq('id', item.data.id);
              }
              break;
          }

          if (result && result.error) {
            throw result.error;
          }

          await removeFromSyncQueue(item.id!);
          successCount++;
          
        } catch (err) {
          console.error('Ошибка синхронизации:', err);
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

      // Обновляем кэш оборудования
      await cacheEquipment();
      
    } catch (err) {
      console.error('Ошибка синхронизации:', err);
    } finally {
      setSyncing(false);
      syncInProgress.current = false;
    }
  }, [companyId]);

  // Сохранение сметы (офлайн или онлайн)
  const saveEstimateOffline = useCallback(async (estimate: any, items: any[]) => {
    if (!companyId) return { error: new Error('No company') };

    // Сохраняем локально
    await saveEstimateLocal({ ...estimate, items }, companyId);

    if (isOnline()) {
      // Если онлайн - синхронизируем сразу
      try {
        // ... стандартная логика сохранения
        await markEstimateSynced(estimate.id);
        return { error: null };
      } catch (err) {
        // Если ошибка - добавляем в очередь
        await addToSyncQueue('estimates', estimate.id ? 'update' : 'create', estimate);
        await addToSyncQueue('estimate_items', 'create', { items });
        return { error: null, queued: true };
      }
    } else {
      // Оффлайн - добавляем в очередь
      await addToSyncQueue('estimates', estimate.id ? 'update' : 'create', estimate);
      await addToSyncQueue('estimate_items', 'create', { items });
      
      const queue = await getSyncQueue();
      setPendingChanges(queue.length);
      
      toast.info('Сохранено офлайн', {
        description: 'Будет синхронизировано при подключении'
      });
      
      return { error: null, queued: true };
    }
  }, [companyId]);

  // Получение локальных смет
  const getOfflineEstimates = useCallback(async () => {
    if (!companyId) return [];
    const estimates = await getEstimatesLocal(companyId);
    return estimates.map(e => e.data);
  }, [companyId]);

  // Получение локального оборудования
  const getOfflineEquipment = useCallback(async () => {
    if (!companyId) return [];
    return getEquipmentLocal(companyId);
  }, [companyId]);

  // Принудительная синхронизация
  const forceSync = useCallback(async () => {
    if (!isOnline()) {
      toast.error('Нет подключения к сети');
      return;
    }
    await syncData();
  }, [syncData]);

  return {
    isOffline,
    syncing,
    pendingChanges,
    saveEstimateOffline,
    getOfflineEstimates,
    getOfflineEquipment,
    forceSync,
    cacheEquipment
  };
}
