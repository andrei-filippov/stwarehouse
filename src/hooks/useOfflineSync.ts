import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { debugLog, debugError } from '../lib/utils';
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
  clearDeletedEstimates,
  cleanupOldRecords
} from '../lib/offlineDB';
import { supabase } from '../lib/supabase';

export function useOfflineSync(companyId: string | undefined) {
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [serverAvailable, setServerAvailable] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const syncInProgress = useRef(false);
  const onSyncCompleteRef = useRef<(() => void) | null>(null);
  
  // Уникальный ID экземпляра хука для отладки
  const hookId = useRef(`sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Инициализация и проверка статуса сервера
  useEffect(() => {
    initOfflineDB();
    
    // Очистка старых записей (защита от переполнения)
    if (companyId) {
      cleanupOldRecords(companyId);
    }
    
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
    
    // Двойная проверка с блокировкой
    if ((window as any).__syncing && (window as any).__syncing !== hookId.current) {
      debugLog('[Sync] Another sync in progress, skipping');
      return;
    }
    
    syncInProgress.current = true;
    setSyncing(true);
    (window as any).__syncing = hookId.current; // Привязываем к ID экземпляра
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
      
      debugLog('[Sync] Sorted queue:', sortedQueue.map(i => `${i.table}(${i.operation})`));
      
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
                
                // Сначала проверяем, не существует ли уже такая смета на сервере
                const { data: existing } = await supabase
                  .from('estimates')
                  .select('id')
                  .eq('company_id', companyId)
                  .eq('event_name', data.event_name)
                  .eq('event_date', data.event_date)
                  .limit(1);
                
                if (existing && existing.length > 0) {
                  // Смета уже существует - делаем UPDATE вместо INSERT
                  debugLog('[Sync] Estimate already exists, updating:', existing[0].id);
                  idMapping[id] = existing[0].id;
                  result = await supabase.from('estimates')
                    .update(data)
                    .eq('id', existing[0].id)
                    .select().single();
                } else {
                  // Создаём новую смету
                  result = await supabase.from('estimates').insert({
                    ...data,
                    company_id: companyId
                  }).select().single();
                  
                  // Сохраняем маппинг для новой сметы
                  if (result.data && id) {
                    idMapping[id] = result.data.id;
                    debugLog('[Sync] Created estimate mapping:', id, '->', result.data.id);
                  }
                }
              } else if (item.operation === 'update') {
                const { id, items, created_at, updated_at, user_id, company_id, ...data } = item.data;
                debugLog('[Sync] Estimate update - original ID:', id);
                
                let serverId = id?.startsWith('local_') ? idMapping[id] : id;
                
                // Если нет маппинга и ID локальный - ищем на сервере по названию и дате
                if (!serverId && id?.startsWith('local_')) {
                  debugLog('[Sync] No mapping found, searching on server...');
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
                    debugLog('[Sync] Found on server:', serverId);
                  }
                }
                
                if (!serverId) {
                  console.warn('[Sync] Cannot update estimate - no server ID found for:', id);
                  throw new Error('No server ID for update');
                }
                
                debugLog('[Sync] Updating estimate - server ID:', serverId);
                
                // Удаляем старые позиции перед обновлением (чтобы избежать дубликатов)
                await supabase.from('estimate_items').delete().eq('estimate_id', serverId);
                debugLog('[Sync] Deleted old estimate_items for:', serverId);
                
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
                const { id, items, ...data } = item.data;
                // 1. Создаём чек-лист
                result = await supabase.from('checklists').insert({
                  ...data,
                  company_id: companyId,
                  // user_id уже должен быть в data
                }).select().single();
                
                // 2. Создаём items отдельно
                if (items && items.length > 0 && result?.data?.id) {
                  const checklistId = result.data.id;
                  const itemsToInsert = items.map((item: any) => ({
                    checklist_id: checklistId,
                    name: item.name,
                    quantity: item.quantity,
                    category: item.category,
                    is_required: item.is_required ?? true,
                    is_checked: item.is_checked ?? false
                  }));
                  
                  const { error: itemsError } = await supabase
                    .from('checklist_items')
                    .insert(itemsToInsert);
                    
                  if (itemsError) {
                    debugError('[Sync] Error creating checklist items:', itemsError);
                  }
                }
              } else if (item.operation === 'update') {
                const { id, items, ...data } = item.data;
                result = await supabase.from('checklists').update(data).eq('id', id);
                // Note: при update items не обновляем - они синхронизируются отдельно
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
            debugLog('[Sync] Created on server, mapping:', localId, '->', result.data.id);
          }

          // Удаляем локальную запись после успешной синхронизации
          // Для estimates: удаляем ВСЕГДА (и local_* и серверные ID после update)
          if (item.table === 'estimates') {
            const estimateId = item.data?.id;
            if (estimateId) {
              await deleteEstimateLocal(estimateId);
              debugLog('[Sync] Deleted local estimate:', estimateId);
            }
          }
          // Для остальных таблиц - только если local_*
          else if (localId?.startsWith('local_')) {
            if (item.table === 'equipment') {
              await deleteEquipmentLocal(localId);
              debugLog('[Sync] Deleted local equipment:', localId);
            } else if (item.table === 'checklists') {
              await deleteChecklistLocal(localId);
              debugLog('[Sync] Deleted local checklist:', localId);
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
          
          debugLog('[Sync] Processing estimate_items:', item.data);
          
          if (item.operation === 'create') {
            const { estimateId, items } = item.data;
            
            debugLog('[Sync] estimate_items create - estimateId:', estimateId, 'items count:', items?.length);
            debugLog('[Sync] Current idMapping:', idMapping);
            
            // Заменяем local_id на server_id
            // Если estimateId не начинается с local_ - это уже серверный ID
            let serverEstimateId = estimateId?.startsWith('local_') ? idMapping[estimateId] : estimateId;
            
            debugLog('[Sync] serverEstimateId:', serverEstimateId);
            
            // Если маппинг не найден и это был local_id - пропускаем
            if (!serverEstimateId && estimateId?.startsWith('local_')) {
              console.warn('[Sync] No mapping found for estimate:', estimateId, '- will retry later');
              await updateSyncQueueRetry(item.id!, item.retryCount + 1);
              errorCount++;
              continue;
            }
            
            // Если всё ещё нет serverEstimateId - ошибка
            if (!serverEstimateId) {
              debugError('[Sync] Cannot determine server estimate ID for:', estimateId);
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
              
              debugLog('[Sync] Mapping items with serverEstimateId:', serverEstimateId);
              
              debugLog('[Sync] Items before filtering:', items?.length);
              
              const validItems = items
                .filter((item: any) => {
                  const hasName = !!item.name;
                  const hasEquipment = !!item.equipment_id;
                  debugLog('[Sync] Filtering item:', item.name, 'hasName:', hasName, 'hasEquipment:', hasEquipment);
                  return hasName || hasEquipment;
                })
                .map((item: any, idx: number) => {
                  const { id, estimate_id, ...itemData } = item;
                  
                  debugLog('[Sync] Processing item:', item.name, 'itemData keys:', Object.keys(itemData));
                  
                  // Заменяем equipment_id если он локальный
                  let serverEquipmentId = itemData.equipment_id;
                  if (itemData.equipment_id?.startsWith('local_')) {
                    serverEquipmentId = idMapping[itemData.equipment_id];
                    debugLog('[Sync] Mapped equipment:', itemData.equipment_id, '->', serverEquipmentId);
                  }
                  
                  const mappedItem = {
                    ...itemData,
                    equipment_id: serverEquipmentId || itemData.equipment_id,
                    estimate_id: serverEstimateId,
                    company_id: companyId,
                    order_index: idx
                  };
                  
                  debugLog('[Sync] Mapped item:', mappedItem.name, 'estimate_id:', mappedItem.estimate_id);
                  return mappedItem;
                });
              
              if (validItems.length > 0) {
                // Сначала удаляем старые позиции, чтобы избежать дублирования
                debugLog('[Sync] Deleting old estimate_items for:', serverEstimateId);
                const { error: deleteError } = await supabase.from('estimate_items').delete().eq('estimate_id', serverEstimateId);
                if (deleteError) {
                  debugError('[Sync] Error deleting old items:', deleteError);
                }
                
                // Вставляем новые позиции
                debugLog('[Sync] Inserting estimate_items:', validItems.length);
                debugLog('[Sync] First item:', JSON.stringify(validItems[0]));
                result = await supabase.from('estimate_items').insert(validItems);
                debugLog('[Sync] Insert result:', result);
                if (result.error) {
                  debugError('[Sync] Insert error:', result.error);
                  throw result.error;
                }
              } else {
                console.warn('[Sync] No valid items to insert after filtering');
              }
            }
          }

          if (result?.error) {
            throw result.error;
          }

          await removeFromSyncQueue(item.id!);
          successCount++;
          debugLog('[Sync] Successfully synced estimate_items');
          
          // После успешной синхронизации items удаляем локальную смету
          // чтобы при fetchEstimates загрузилась актуальная версия с сервера
          const { estimateId } = item.data;
          if (estimateId && !estimateId.startsWith('local_')) {
            await deleteEstimateLocal(estimateId);
            debugLog('[Sync] Deleted local estimate after items sync:', estimateId);
          }
          
        } catch (err) {
          debugError('[Sync] Error syncing estimate_items:', err);
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
      
      // Задержка перед callback чтобы Supabase успел реплицировать данные
      // и чтобы useEstimates успел завершить текущий fetchEstimates (если есть)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Вызываем callback для обновления UI
      onSyncCompleteRef.current?.();
      onSyncCompleteRef.current = null;
      
    } catch (err) {
      // Silent fail
    } finally {
      setSyncing(false);
      syncInProgress.current = false;
      (window as any).__syncing = false; // Сброс глобального флага
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

