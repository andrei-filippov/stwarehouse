import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Toaster } from './components/ui/sonner'
import { AppLoader } from './components/AppLoader'
import { ThemeProvider } from './contexts/ThemeContext'
import { SpeedInsightsWrapper } from './components/SpeedInsightsWrapper'

// Регистрация Service Worker для офлайн-режима
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        logger.debug('SW registered:', registration);
import { logger } from './lib/logger';
        
        // Проверяем обновления каждые 60 минут
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
        
        // Если есть новый SW — предлагаем обновить
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Новый SW установлен, но ждёт активации
                logger.debug('New version available!');
                // Можно показать уведомление пользователю
                if (confirm('Доступна новая версия приложения. Обновить?')) {
                  newWorker.postMessage('SKIP_WAITING');
                  window.location.reload();
                }
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
