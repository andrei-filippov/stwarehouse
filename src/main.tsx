import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'
import App from './App.tsx'
import { Toaster } from './components/ui/sonner'
import { AppLoader } from './components/AppLoader'

// Регистрация Service Worker для офлайн-режима
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
        
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
                console.log('New version available!');
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
        console.log('SW registration failed:', error);
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
    <AppLoader>
      <App />
    </AppLoader>
    <Toaster position="top-right" richColors closeButton />
    <SpeedInsights />
  </StrictMode>,
)
