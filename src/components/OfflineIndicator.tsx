import { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface OfflineIndicatorProps {
  companyId?: string;
}

export function OfflineIndicator({ companyId }: OfflineIndicatorProps = {}) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Загружаем количество несинхронизированных данных
  const checkPending = useCallback(async () => {
    if ('indexedDB' in window && companyId) {
      try {
        const db = await openDB('stwarehouse-offline', 2);
        const tx = db.transaction('syncQueue', 'readonly');
        const store = tx.objectStore('syncQueue');
        const count = await store.count();
        setPendingCount(count);
        console.log('[OfflineIndicator] Pending items:', count);
      } catch (e) {
        console.log('[OfflineIndicator] Error checking pending:', e);
      }
    }
  }, [companyId]);

  useEffect(() => {
    checkPending();
    const interval = setInterval(checkPending, 3000);
    return () => clearInterval(interval);
  }, [checkPending]);

  // Слушаем события сети
  useEffect(() => {
    const handleOnline = () => {
      console.log('[OfflineIndicator] Online event');
      setIsOnline(true);
      toast.success('Подключение восстановлено');
      // Автоматически синхронизируем
      if (companyId) {
        handleSync();
      }
    };
    
    const handleOffline = () => {
      console.log('[OfflineIndicator] Offline event');
      setIsOnline(false);
      toast.warning('Нет подключения к интернету');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setNeedRefresh(true);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [companyId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDetails(false);
      }
    };

    if (showDetails) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDetails]);

  const handleSync = useCallback(async () => {
    if (!companyId || isSyncing) return;
    
    console.log('[OfflineIndicator] Manual sync started');
    setIsSyncing(true);
    
    try {
      // Прямой вызов синхронизации через глобальную функцию
      const { getSyncQueue, removeFromSyncQueue, updateSyncQueueRetry, deleteEstimateLocal, deleteChecklistLocal } = await import('../lib/offlineDB');
      const { supabase } = await import('../lib/supabase');
      
      const queue = await getSyncQueue();
      console.log('[OfflineIndicator] Queue:', queue);
      
      let success = 0;
      let failed = 0;
      
      for (const item of queue) {
        try {
          if (item.table === 'estimates' && item.operation === 'create') {
            const { id, items, ...data } = item.data;
            const result = await supabase.from('estimates').insert(data).select().single();
            
            if (result.error) throw result.error;
            
            // Синхронизируем items
            if (items?.length > 0 && result.data?.id) {
              const itemsWithIds = items.map((it: any, idx: number) => ({
                ...it,
                estimate_id: result.data.id,
                company_id: companyId,
                order_index: idx
              }));
              await supabase.from('estimate_items').insert(itemsWithIds);
            }
            
            await deleteEstimateLocal(id);
            await removeFromSyncQueue(item.id!);
            success++;
          }
          else if (item.table === 'equipment' && item.operation === 'create') {
            const { id, ...data } = item.data;
            const result = await supabase.from('equipment').insert(data);
            if (result.error) throw result.error;
            await removeFromSyncQueue(item.id!);
            success++;
          }
          else if (item.table === 'checklists' && item.operation === 'create') {
            const { id, ...data } = item.data;
            const result = await supabase.from('checklists').insert(data);
            if (result.error) throw result.error;
            await deleteChecklistLocal(id);
            await removeFromSyncQueue(item.id!);
            success++;
          }
        } catch (err) {
          console.error('[OfflineIndicator] Sync error:', err);
          await updateSyncQueueRetry(item.id!, item.retryCount + 1);
          failed++;
        }
      }
      
      if (success > 0) {
        toast.success(`Синхронизировано: ${success} изменений`);
      }
      if (failed > 0) {
        toast.error(`Ошибок: ${failed}`);
      }
      
      await checkPending();
      window.location.reload();
    } catch (err) {
      console.error('[OfflineIndicator] Sync failed:', err);
      toast.error('Ошибка синхронизации');
    } finally {
      setIsSyncing(false);
    }
  }, [companyId, isSyncing, checkPending]);

  const updateApp = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.waiting?.postMessage('SKIP_WAITING');
        window.location.reload();
      });
    }
  }, []);

  const clearCache = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data?.cleared) {
          toast.success('Кэш очищен. Перезагрузка...');
          setTimeout(() => window.location.reload(), 1000);
        }
      };
      
      registration.active?.postMessage('CLEAR_CACHES', [messageChannel.port2]);
    }
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          isOnline 
            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
            : 'bg-red-100 text-red-700 hover:bg-red-200'
        }`}
      >
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            <span className="hidden sm:inline">Онлайн</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span className="hidden sm:inline">Офлайн</span>
          </>
        )}
        {pendingCount > 0 && (
          <span className="ml-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
        )}
      </button>

      {showDetails && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
          <h4 className="font-medium text-gray-900 mb-2">Статус приложения</h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Сеть:</span>
              <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
                {isOnline ? 'Подключена' : 'Отключена'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Service Worker:</span>
              <span className={'text-blue-600'}>
                {'serviceWorker' in navigator ? 'Активен' : 'Не поддерживается'}
              </span>
            </div>
            
            {pendingCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">На синхронизацию:</span>
                <span className="text-orange-600 font-medium">{pendingCount}</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
            {isOnline && pendingCount > 0 && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm disabled:opacity-50"
              >
                <Upload className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Синхронизация...' : `Синхронизировать (${pendingCount})`}
              </button>
            )}
            
            {needRefresh && (
              <button
                onClick={updateApp}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Обновить приложение
              </button>
            )}
            
            <button
              onClick={clearCache}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Очистить кэш
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper для IndexedDB
function openDB(name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
