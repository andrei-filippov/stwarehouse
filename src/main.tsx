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

// Восстановление при ошибке загрузки чанка (ChunkLoadError / failed dynamic import):
// отменяем регистрацию SW, чистим кэши и перезагружаемся один раз за сессию
function recoverFromChunkError() {
  if (sessionStorage.getItem('chunk-recovery')) return;
  sessionStorage.setItem('chunk-recovery', '1');
  const cleanup = async () => {
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      const regs = await navigator.serviceWorker?.getRegistrations();
      await Promise.all((regs || []).map((r) => r.unregister()));
    } catch { /* ignore */ }
    location.reload();
  };
  void cleanup();
}

const isChunkError = (msg: string) =>
  msg.includes('dynamically imported module') || msg.includes('ChunkLoadError') || msg.includes('Loading chunk');

window.addEventListener('error', (e) => {
  if (isChunkError(e.message || '')) recoverFromChunkError();
});
window.addEventListener('unhandledrejection', (e) => {
  if (isChunkError(String(e.reason || ''))) recoverFromChunkError();
});

// Регистрация Service Worker происходит в src/hooks/useServiceWorker.ts
// (там же — обработка обновлений и очистка кэша)

// Обработка сообщений от SW
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'BACKGROUND_SYNC_REQUEST') {
      logger.debug('[SW] Background sync requested');
      // Dispatch global event that hooks can listen to
      window.dispatchEvent(new CustomEvent('background-sync', {
        detail: { timestamp: event.data.timestamp }
      }));
    }
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
