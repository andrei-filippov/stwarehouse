import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

export function useServiceWorker() {
  const [swStatus, setSwStatus] = useState<'checking' | 'installed' | 'updated' | 'error'>('checking');
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Принудительно обновляем Service Worker при каждой загрузке
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => {
          console.log('SW registered:', registration);
          
          // Принудительно проверяем обновления
          registration.update();
          
          // Проверяем обновления
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Новый SW установлен, но ждет активации
                  setNeedRefresh(true);
                  setSwStatus('updated');
                  toast.info('Доступно обновление', {
                    description: 'Нажмите для обновления приложения',
                    action: {
                      label: 'Обновить',
                      onClick: () => updateServiceWorker()
                    }
                  });
                }
              });
            }
          });

          // Проверяем есть ли контролирующий SW
          if (registration.active) {
            setSwStatus('installed');
          }
        })
        .catch((error) => {
          console.error('SW registration failed:', error);
          setSwStatus('error');
        });

      // Слушаем сообщения от SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATE') {
          setNeedRefresh(true);
        }
      });
      
      // Принудительно перезагружаем страницу если контролирующий SW изменился
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('SW controller changed, reloading...');
        window.location.reload();
      });
    }
  }, []);

  const updateServiceWorker = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Отправляем сообщение SW чтобы пропустить ожидание
        registration.waiting?.postMessage('SKIP_WAITING');
        
        // Перезагружаем страницу
        window.location.reload();
      });
    }
  }, []);

  const clearCaches = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data?.cleared) {
          toast.success('Кэш очищен');
          window.location.reload();
        }
      };
      
      registration.active?.postMessage('CLEAR_CACHES', [messageChannel.port2]);
    }
  }, []);

  return {
    swStatus,
    needRefresh,
    updateServiceWorker,
    clearCaches
  };
}
