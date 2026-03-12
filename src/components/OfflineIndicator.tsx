import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface OfflineIndicatorProps {
  isOffline: boolean;
  syncing: boolean;
  pendingChanges: number;
  onSync: () => void;
}

export function OfflineIndicator({ 
  isOffline, 
  syncing, 
  pendingChanges, 
  onSync 
}: OfflineIndicatorProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isOffline || pendingChanges > 0);
  }, [isOffline, pendingChanges]);

  if (!show) return null;

  return (
    <div className={cn(
      "fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-auto z-50",
      "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg",
      isOffline ? "bg-amber-500 text-white" : "bg-blue-600 text-white"
    )}>
      {isOffline ? (
        <>
          <WifiOff className="w-5 h-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Нет подключения</p>
            <p className="text-xs opacity-90">Работаем в офлайн-режиме</p>
          </div>
        </>
      ) : (
        <>
          <Wifi className="w-5 h-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">
              {syncing ? 'Синхронизация...' : 'Есть подключение'}
            </p>
            {pendingChanges > 0 && (
              <p className="text-xs opacity-90">
                Ожидает синхронизации: {pendingChanges}
              </p>
            )}
          </div>
          {pendingChanges > 0 && !syncing && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onSync}
              className="shrink-0 h-8 px-2"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
          {syncing && (
            <RefreshCw className="w-5 h-5 animate-spin shrink-0" />
          )}
        </>
      )}
    </div>
  );
}
