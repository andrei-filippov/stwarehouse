import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Toaster } from './components/ui/sonner'
import { AppLoader } from './components/AppLoader'
import { ThemeProvider } from './contexts/ThemeContext'
import { SpeedInsightsWrapper } from './components/SpeedInsightsWrapper'

import { logger } from './lib/logger';

// Check for new version every 10 minutes and reload if needed
const CURRENT_BUILD = '2026-05-14-v2';
setInterval(() => {
  fetch('/index.html', { cache: 'no-store' })
    .then(r => r.text())
    .then(html => {
      const match = html.match(/CURRENT_VERSION\s*=\s*['"]([^'"]+)['"]/);
      if (match && match[1] !== CURRENT_BUILD) {
        logger.info('[Version] New build detected, reloading...');
        location.reload();
      }
    })
    .catch(() => {});
}, 10 * 60 * 1000);

// Регистрация Service Worker для офлайн-режима
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        logger.debug('SW registered:', registration);
        
        // Проверяем обновления каждые 5 минут (быстрее для critical fixes)
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);
        
        // Если есть новый SW — предлагаем обновить
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Новый SW установлен, но ждёт активации
                logger.debug('New version available!');
                // Можно показать уведомление пользователю
                // Force reload to get latest JS with egress optimizations
                newWorker.postMessage('SKIP_WAITING');
                window.location.reload();
              }
            });
          }
        });
      })
      .catch((error) => {
        logger.debug('SW registration failed:', error);
      });
    
    // Обработка сообщений от SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data === 'RELOAD_PAGE') {
        window.location.reload();
      }
      
      // Background sync request from SW (every 3-5 minutes)
      if (event.data?.type === 'BACKGROUND_SYNC_REQUEST') {
        logger.debug('[SW] Background sync requested');
        // Dispatch global event that hooks can listen to
        window.dispatchEvent(new CustomEvent('background-sync', {
          detail: { timestamp: event.data.timestamp }
        }));
      }
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AppLoader>
        <App />
      </AppLoader>
      <Toaster position="top-right" richColors closeButton />
      <SpeedInsightsWrapper />
    </ThemeProvider>
  </StrictMode>,
)
