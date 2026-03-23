import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Trash2, 
  Upload, 
  ListX,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

interface SyncDialogProps {
  isOpen: boolean;
  onClose: () => void;
  browserOnline: boolean;
  serverAvailable: boolean;
  pendingCount: number;
  isSyncing: boolean;
  companyId?: string;
  onSync?: () => Promise<void>;
}

interface QueueItem {
  table: string;
  operation: string;
  data?: any;
}

export function SyncDialog({ 
  isOpen, 
  onClose, 
  browserOnline,
  serverAvailable,
  pendingCount, 
  isSyncing,
  companyId,
  onSync 
}: SyncDialogProps) {
  const [localPendingCount, setLocalPendingCount] = useState(pendingCount);
  const [queueDetails, setQueueDetails] = useState<QueueItem[]>([]);

  // Обновляем счётчик при изменении props
  useEffect(() => {
    setLocalPendingCount(pendingCount);
  }, [pendingCount]);

  // Обновление счётчика при открытии
  useEffect(() => {
    if (isOpen && companyId) {
      updatePendingCount();
    }
  }, [isOpen, companyId]);

  const updatePendingCount = async () => {
    if (!companyId) return;
    try {
      const { getSyncQueue } = await import('../lib/offlineDB');
      const queue = await getSyncQueue();
      setLocalPendingCount(queue.length);
      setQueueDetails(queue.map((item: any) => ({
        table: item.table,
        operation: item.operation,
        data: item.data
      })));
    } catch (e) {
      console.error('Error checking pending:', e);
    }
  };

  // Синхронизация
  const handleSync = async () => {
    if (!companyId || isSyncing || !onSync) return;
    
    if (!serverAvailable) {
      toast.error('Сервер недоступен. Проверьте подключение.');
      return;
    }
    
    await onSync();
    await updatePendingCount();
    toast.success('Синхронизация завершена');
  };

  // Очистка только очереди
  const handleClearQueue = async () => {
    try {
      const { clearSyncQueue } = await import('../lib/offlineDB');
      await clearSyncQueue();
      await updatePendingCount();
      toast.success('Очередь синхронизации очищена');
    } catch (e) {
      toast.error('Ошибка очистки очереди');
    }
  };

  // Полный сброс локальных данных
  const handleClearAll = async () => {
    if (!confirm('Все локальные данные будут удалены. Продолжить?')) return;
    
    try {
      const { clearAllLocalData, clearDeletedEstimates } = await import('../lib/offlineDB');
      await clearAllLocalData();
      await clearDeletedEstimates();
      await updatePendingCount();
      toast.success('Локальные данные очищены. Перезагрузка...');
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      toast.error('Ошибка очистки данных');
    }
  };

  // Очистка кэша Service Worker
  const handleClearCache = async () => {
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
  };

  // Определяем общий статус
  const isFullyOnline = browserOnline && serverAvailable;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm w-[95%] rounded-xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isFullyOnline ? (
              <>
                <Wifi className="w-5 h-5 text-green-600" />
                <span>Онлайн режим</span>
              </>
            ) : browserOnline ? (
              <>
                <WifiOff className="w-5 h-5 text-orange-600" />
                <span>Сервер недоступен</span>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-red-600" />
                <span>Офлайн режим</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Управление синхронизацией и локальными данными
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Статус сервера */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm text-gray-600">Сервер Supabase:</span>
            <Badge variant={serverAvailable ? "default" : "destructive"}>
              {serverAvailable ? 'Доступен' : 'Недоступен'}
            </Badge>
          </div>

          {/* Браузер онлайн */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm text-gray-600">Браузер online:</span>
            <Badge variant={browserOnline ? "default" : "destructive"}>
              {browserOnline ? 'Да' : 'Нет'}
            </Badge>
          </div>

          {/* Очередь синхронизации */}
          {localPendingCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <span className="text-sm text-orange-800">
                    На синхронизацию:
                  </span>
                </div>
                <span className="text-lg font-bold text-orange-600">
                  {localPendingCount}
                </span>
              </div>
              
              {/* Детали очереди */}
              <div className="max-h-32 overflow-y-auto space-y-1">
                {queueDetails.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-muted rounded text-xs">
                    <span className="text-gray-600">
                      {item.table === 'estimates' && 'Смета'}
                      {item.table === 'estimate_items' && 'Позиции сметы'}
                      {item.table === 'equipment' && 'Оборудование'}
                      {item.table === 'checklists' && 'Чек-лист'}
                      {!['estimates', 'estimate_items', 'equipment', 'checklists'].includes(item.table) && item.table}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {item.operation === 'create' && 'Создание'}
                      {item.operation === 'update' && 'Обновление'}
                      {item.operation === 'delete' && 'Удаление'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="space-y-2 pt-2">
            {/* Синхронизировать */}
            {serverAvailable && localPendingCount > 0 && (
              <Button
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full"
              >
                <Upload className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Синхронизация...' : `Синхронизировать (${localPendingCount})`}
              </Button>
            )}

            {/* Нет подключения */}
            {!serverAvailable && localPendingCount > 0 && (
              <div className="text-sm text-gray-500 text-center py-2">
                Подключите интернет для синхронизации
              </div>
            )}

            {/* Всё синхронизировано */}
            {serverAvailable && localPendingCount === 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-green-600 py-2">
                <CheckCircle2 className="w-4 h-4" />
                Все данные синхронизированы
              </div>
            )}

            <div className="border-t pt-2 mt-2 space-y-2">
              {/* Очистить очередь */}
              {localPendingCount > 0 && (
                <Button
                  onClick={handleClearQueue}
                  disabled={isSyncing}
                  variant="outline"
                  className="w-full text-orange-600 border-orange-200 hover:bg-orange-50"
                >
                  <ListX className="w-4 h-4 mr-2" />
                  Очистить очередь ({localPendingCount})
                </Button>
              )}

              {/* Сбросить локальные данные */}
              <Button
                onClick={handleClearAll}
                disabled={isSyncing}
                variant="outline"
                className="w-full text-yellow-600 border-yellow-200 hover:bg-yellow-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Сбросить локальные данные
              </Button>

              {/* Очистить кэш */}
              <Button
                onClick={handleClearCache}
                disabled={isSyncing}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Очистить кэш
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
