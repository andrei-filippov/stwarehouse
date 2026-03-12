import { useState, useEffect } from 'react';
import { WifiOff, Loader2 } from 'lucide-react';

export function AppLoader({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Проверяем статус сети
    const checkConnection = () => {
      setIsOffline(!navigator.onLine);
    };

    checkConnection();
    
    window.addEventListener('online', () => setIsOffline(false));
    window.addEventListener('offline', () => setIsOffline(true));

    // Даём время на инициализацию (загрузка из IndexedDB)
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => {
      window.removeEventListener('online', () => setIsOffline(false));
      window.removeEventListener('offline', () => setIsOffline(true));
      clearTimeout(timer);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center">
          <Loader2 className="w-10 h-10 mb-4 animate-spin text-blue-600" />
          <p className="text-gray-600 font-medium">
            {isOffline ? 'Загрузка из кэша...' : 'Загрузка...'}
          </p>
          {isOffline && (
            <div className="mt-3 flex items-center gap-2 text-amber-600 text-sm bg-amber-50 px-3 py-1.5 rounded-lg">
              <WifiOff className="w-4 h-4" />
              <span>Оффлайн-режим</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
