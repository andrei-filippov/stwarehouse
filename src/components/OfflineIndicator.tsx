import { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Подключение восстановлено');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Нет подключения к интернету');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Проверяем обновления SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setNeedRefresh(true);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
        {needRefresh && (
          <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
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
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
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
