import { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, Trash2, Upload, ListX } from 'lucide-react';
import { toast } from 'sonner';
import { openDB } from 'idb';

interface OfflineIndicatorProps {
  companyId?: string;
  onSync?: () => Promise<void>;
}

export function OfflineIndicator({ companyId, onSync }: OfflineIndicatorProps = {}) {
  const [isOnline, setIsOnline] = useState(false); // Начинаем с false, потом проверим
  const [needRefresh, setNeedRefresh] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Проверяем реальное соединение с Supabase
  const checkConnection = useCallback(async () => {
    try {
      const { supabase } = await import('../lib/supabase');
      // Короткий таймаут для проверки
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const { error } = await supabase
        .from('estimates')
        .select('id', { count: 'exact', head: true })
        .abortSignal(controller.signal);
        
      clearTimeout(timeoutId);
      
      const isConnected = !error;
      setIsOnline(isConnected);
      return isConnected;
    } catch (e: any) {
      setIsOnline(false);
      return false;
    }
  }, []);

  // Загружаем количество несинхронизированных данных
  const checkPending = useCallback(async () => {
    if (!companyId) return;
    try {
      const db = await openDB('stwarehouse-offline', 2);
      const count = await db.count('syncQueue');
      setPendingCount(count);
    } catch (e) {
      // ignore
    }
  }, [companyId]);

  // Синхронизация
  const handleSync = useCallback(async () => {
    if (!companyId || isSyncing) return;
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      toast.error('Нет подключения к серверу');
      return;
    }
    
    setIsSyncing(true);
    
    try {
      // Если передан onSync - используем его (единая логика из useOfflineSync)
      if (onSync) {
        await onSync();
        await checkPending();
        return;
      }
      
      // Fallback - старая логика (не должна использоваться)
      toast.error('Ошибка конфигурации: onSync не передан');
    } catch (err) {
      toast.error('Ошибка синхронизации');
    } finally {
      setIsSyncing(false);
    }
  }, [companyId, isSyncing, checkConnection, checkPending, onSync]);

  // Проверка при монтировании и периодически
  useEffect(() => {
    // Начальная проверка
    checkConnection();
    checkPending();
    
    // Периодическая проверка каждые 5 секунд
    const interval = setInterval(() => {
      checkConnection();
      checkPending();
    }, 5000);

    return () => clearInterval(interval);
  }, [checkConnection, checkPending]);

  // Слушаем события браузера online/offline
  useEffect(() => {
    const handleBrowserOnline = () => {
      // Перепроверяем реальное соединение
      setTimeout(checkConnection, 500);
    };
    
    const handleBrowserOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setNeedRefresh(true);
      });
    }

    return () => {
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
    };
  }, [checkConnection]);

  // Закрытие при клике вне
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

  // Очистка только очереди синхронизации (для битых записей)
  const clearQueueOnly = useCallback(async () => {
    try {
      const { clearSyncQueue } = await import('../lib/offlineDB');
      await clearSyncQueue();
      await checkPending();
      toast.success('Очередь синхронизации очищена');
    } catch (e) {
      toast.error('Ошибка очистки очереди');
    }
  }, [checkPending]);

  // Очистка всех локальных данных (для iPhone когда данные "застревают")
  const clearAllLocal = useCallback(async () => {
    try {
      const { clearAllLocalData, clearDeletedEstimates } = await import('../lib/offlineDB');
      await clearAllLocalData();
      await clearDeletedEstimates();
      await checkPending();
      toast.success('Локальные данные очищены. Перезагрузка...');
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      toast.error('Ошибка очистки данных');
    }
  }, [checkPending]);

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
              <span className="text-gray-600">Сервер:</span>
              <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
                {isOnline ? 'Доступен' : 'Недоступен'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Браузер online:</span>
              <span className={navigator.onLine ? 'text-green-600' : 'text-red-600'}>
                {navigator.onLine ? 'Да' : 'Нет'}
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
            
            {!isOnline && pendingCount > 0 && (
              <div className="text-xs text-gray-500 text-center">
                Подключите интернет для синхронизации
              </div>
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
            
            {pendingCount > 0 && (
              <button
                onClick={clearQueueOnly}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm disabled:opacity-50"
              >
                <ListX className="w-4 h-4" />
                Очистить очередь ({pendingCount})
              </button>
            )}

            <button
              onClick={clearAllLocal}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors text-sm disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Сбросить локальные данные
            </button>

            <button
              onClick={clearCache}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Очистить весь кэш
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
