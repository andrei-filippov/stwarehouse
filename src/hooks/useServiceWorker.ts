import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { createLogger } from '../lib/logger';

const logger = createLogger('sw');

export function useServiceWorker() {
  const [swStatus, setSwStatus] = useState<'checking' | 'installed' | 'updated' | 'error'>('checking');
  const [needRefresh, setNeedRefresh] = useState(false);
  // Перезагружаемся на controllerchange только если сами запросили обновление,
  // иначе первая активация SW вызовет лишнюю перезагрузку страницы
  const updateRequestedRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        registration = reg;
        logger.info('SW registered');

        // Проверяем обновления при загрузке страницы
        reg.update();

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
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
        });

        if (reg.active) {
          setSwStatus('installed');
        }
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
        setSwStatus('error');
      });

    // Перезагружаем страницу только когда контроллер сменился по нашему запросу
    const onControllerChange = () => {
      if (updateRequestedRef.current) {
        logger.info('SW controller changed, reloading...');
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const updateServiceWorker = useCallback(() => {
    if (!('serviceWorker' in navigator)) return;
    updateRequestedRef.current = true;
    navigator.serviceWorker.ready.then((registration) => {
      // Новый SW активируется и пришлёт controllerchange — перезагрузка произойдёт там
      registration.waiting?.postMessage('SKIP_WAITING');
    });
  }, []);

  const clearCaches = useCallback(async () => {
    // Очищаем кэши напрямую с клиента — не зависим от состояния SW
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }

    // Просим SW тоже очистить кэши (на случай если он держит записи)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const messageChannel = new MessageChannel();
        registration.active?.postMessage('CLEAR_CACHES', [messageChannel.port2]);
      } catch (e) {
        logger.warn('Could not reach SW for cache clear:', e);
      }
    }

    toast.success('Кэш очищен');
    window.location.reload();
  }, []);

  return {
    swStatus,
    needRefresh,
    updateServiceWorker,
    clearCaches
  };
}
