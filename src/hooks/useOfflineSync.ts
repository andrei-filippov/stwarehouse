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
  saveChecklistLocal,
  getChecklistsLocal,
  markChecklistSynced,
  deleteChecklistLocal
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
    console.log('[OfflineSync] Initialized, companyId:', companyId);
    
    const cleanup = setupNetworkListeners(
      () => {
        console.log('[OfflineSync] Online event, companyId:', companyId);
        setIsOffline(false);
        toast.success('Подключение восстановлено', {
          description: 'Синхронизация данных...'
        });
        if (companyId) {
          console.log('[OfflineSync] Starting sync...');
          syncData();
        } else {
          console.log('[OfflineSync] No companyId, skipping sync');
        }
      },
      () => {
        console.log('[OfflineSync] Offline event');
        setIsOffline(true);
        toast.warning('Нет подключения', {
          description: 'Работаем в офлайн-режиме'
        });
      }
    );

    // Первоначальная загрузка с небольшой задержкой (чтобы все функции были объявлены)
    if (companyId && isOnline()) {
      console.log('[OfflineSync] Initial online load, checking queue...');
      setTimeout(() => {
        getSyncQueue().then(queue => {
          console.log('[OfflineSync] Queue check:', queue.length, 'items');
          if (queue.length > 0) {
            console.log('[OfflineSync] Starting sync for', queue.length, 'items...');
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
      console.error('Ошибка кэширования оборудования:', err);
    }
  }, [companyId]);

  // Синхронизация данных
  const syncData = useCallback(async (onComplete?: () => void) => {
    console.log('[Sync] Starting syncData, online:', isOnline(), 'companyId:', companyId, 'inProgress:', syncInProgress.current);
    
    if (syncInProgress.current || !isOnline() || !companyId) {
      console.log('[Sync] Skipping - already in progress or no connection/company');
      return;
    }
    
    syncInProgress.current = true;
    setSyncing(true);
    if (onComplete) onSyncCompleteRef.current = onComplete;
    
    try {
      const queue = await getSyncQueue();
      console.log('[Sync] Queue length:', queue.length);
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
      
      console.log('[Sync] Starting sync, items:', queue.length);
      
      // Карта для отслеживания соответствия local_id -> server_id
      const idMapping: Record<string, string> = {};

      // Первый проход: создаём основные записи (estimates, checklists, equipment)
      for (const item of queue) {
        if (item.retryCount > 3) {
          console.log('[Sync] Skipping item, max retries:', item.table, item.operation);
          await removeFromSyncQueue(item.id!);
          errorCount++;
          continue;
        }

        // Пропускаем дочерние записи на первом проходе
        if (item.table === 'estimate_items') continue;

        try {
          console.log('[Sync] Processing:', item.table, item.operation, item.data.id);
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
            console.error('[Sync] Error:', result.error);
            throw result.error;
          }

          console.log('[Sync] Success:', item.table, result?.data?.id || 'ok');

          // Сохраняем соответствие local_id -> server_id
          if (result?.data?.id && localId?.startsWith('local_')) {
            idMapping[localId] = result.data.id;
            console.log('[Sync] ID mapping:', localId, '->', result.data.id);
            
            // Удаляем локальную запись - данные теперь на сервере
            if (item.table === 'estimates') {
              await deleteEstimateLocal(localId);
            } else if (item.table === 'checklists') {
              await deleteChecklistLocal(localId);
            }
          }

          await removeFromSyncQueue(item.id!);
          successCount++;
          
        } catch (err) {
          console.error(`Ошибка синхронизации ${item.table}:`, err);
          await updateSyncQueueRetry(item.id!, item.retryCount + 1);
          errorCount++;
        }
      }

      // Второй проход: создаём дочерние записи (estimate_items)
      console.log('[Sync] Processing estimate_items, mappings:', idMapping);
      
      for (const item of queue) {
        if (item.table !== 'estimate_items') continue;
        if (item.retryCount > 3) {
          await removeFromSyncQueue(item.id!);
          continue;
        }

        try {
          console.log('[Sync] Processing estimate_items for:', item.data.estimateId);
          let result: any;
          
          if (item.operation === 'create') {
            const { estimateId, items } = item.data;
            
            // Заменяем local_id на server_id
            const serverEstimateId = idMapping[estimateId] || estimateId;
            
            console.log('[Sync] Using estimate_id:', serverEstimateId, 'items count:', items?.length);
            
            if (items && items.length > 0) {
              // Фильтруем и преобразуем items
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
              
              console.log('[Sync] Inserting items:', validItems.length);
              
              if (validItems.length > 0) {
                result = await supabase.from('estimate_items').insert(validItems);
              }
            }
          }

          if (result?.error) {
            console.error('[Sync] estimate_items error:', result.error);
            throw result.error;
          }

          console.log('[Sync] estimate_items success');
          await removeFromSyncQueue(item.id!);
          
        } catch (err) {
          console.error('Ошибка синхронизации estimate_items:', err);
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
      
      // Вызываем callback для обновления UI
      onSyncCompleteRef.current?.();
      onSyncCompleteRef.current = null;
      
    } catch (err) {
      console.error('Ошибка синхронизации:', err);
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
