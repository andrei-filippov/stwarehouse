import { useState, useEffect } from 'react';
import { Package, FileText, Calendar, Users, Menu, Plus, Wifi, WifiOff, Sun, Moon, Scan } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { SyncDialog } from './SyncDialog';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useTheme } from '../contexts/ThemeContext';
import type { TabId } from '../lib/permissions';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  availableTabs: { id: TabId; label: string; icon: React.ElementType }[];
  onSignOut: () => void;
  onFabClick?: () => void;
  companyId?: string;
  onSync?: () => Promise<void>;
}

export function BottomNav({ 
  activeTab, 
  onTabChange, 
  availableTabs, 
  onSignOut, 
  onFabClick,
  companyId,
  onSync
}: BottomNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const { resolvedTheme, toggleTheme } = useTheme();
  
  // Получаем реальный статус сервера
  const { serverAvailable } = useOfflineSync(companyId);

  // Обновляем статус браузера
  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Скрываем FAB на дашборде и сметах (там свой интерфейс создания)
  const showFab = activeTab !== 'dashboard' && activeTab !== 'estimates' && onFabClick !== undefined;

  // Основные вкладки для Bottom Nav (максимум 4 + меню)
  const mainTabs = [
    { id: 'qr-scan' as TabId, label: 'QR', icon: Scan },
    { id: 'equipment' as TabId, label: 'Склад', icon: Package },
    { id: 'estimates' as TabId, label: 'Сметы', icon: FileText },
    { id: 'calendar' as TabId, label: 'Календарь', icon: Calendar },
    { id: 'customers' as TabId, label: 'Клиенты', icon: Users },
  ].filter(tab => availableTabs.some(t => t.id === tab.id));

  // Если меньше 4 основных, показываем что есть
  const visibleTabs = mainTabs.slice(0, 4);
  
  // Остальные вкладки в меню "Ещё"
  const otherTabs = availableTabs.filter(
    tab => !visibleTabs.some(vt => vt.id === tab.id)
  );

  return (
    <>
      {/* Floating Action Button (FAB) - только для вкладок с действием */}
      {showFab && (
        <div className="fixed bottom-20 right-4 z-40 md:hidden">
          <Button
            size="lg"
            className="rounded-full w-14 h-14 shadow-xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800"
            onClick={onFabClick}
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50 md:hidden">
        <div className="flex items-center justify-around">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center justify-center py-2 px-3 flex-1 transition-colors ${
                  isActive 
                    ? 'text-blue-600' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className={`p-1.5 rounded-xl mb-0.5 transition-colors ${
                  isActive ? 'bg-blue-50' : ''
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
          
          {/* Кнопка "Ещё" с меню */}
          {otherTabs.length > 0 && (
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button className="flex flex-col items-center justify-center py-2 px-3 flex-1 text-gray-500 hover:text-gray-700">
                  <div className="p-1.5 rounded-xl mb-0.5">
                    <Menu className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium">Ещё</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
                <SheetHeader className="pb-4">
                  <SheetTitle className="text-lg">Меню</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-3 gap-3 pb-32">
                  {otherTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          onTabChange(tab.id);
                          setMenuOpen(false);
                        }}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                          isActive
                            ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-200'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-xs font-medium text-center">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Статус и кнопка сброса */}
                <div className="absolute bottom-16 left-0 right-0 px-4 py-3 border-t bg-muted">
                  <button
                    onClick={() => {
                      setIsSyncDialogOpen(true);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3 bg-card rounded-lg border hover:bg-muted transition-colors transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      {serverAvailable ? (
                        <>
                          <Wifi className="w-4 h-4 text-green-500" />
                          <span className="text-gray-700">Сервер доступен</span>
                        </>
                      ) : browserOnline ? (
                        <>
                          <WifiOff className="w-4 h-4 text-orange-500" />
                          <span className="text-gray-700">Сервер недоступен</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-4 h-4 text-red-500" />
                          <span className="text-gray-700">Нет сети</span>
                        </>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      Нажмите для управления
                    </span>
                  </button>
                </div>

                {/* Theme Toggle */}
                <div className="absolute bottom-16 left-0 right-0 px-4 py-2 border-t bg-muted">
                  <button
                    onClick={() => {
                      toggleTheme();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-card rounded-lg border hover:bg-muted transition-colors"
                  >
                    {resolvedTheme === 'light' ? (
                      <>
                        <Moon className="w-4 h-4" />
                        <span className="text-sm">Тёмная тема</span>
                      </>
                    ) : (
                      <>
                        <Sun className="w-4 h-4" />
                        <span className="text-sm">Светлая тема</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-card">
                  <Button 
                    variant="outline" 
                    className="w-full rounded-xl hover:bg-red-500/10 hover:text-red-600"
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                  >
                    Выйти
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
        {/* Safe area для iPhone */}
        <div className="h-safe-area-inset-bottom bg-background" />
      </nav>

      {/* Диалог синхронизации для мобильного */}
      <SyncDialog
        isOpen={isSyncDialogOpen}
        onClose={() => setIsSyncDialogOpen(false)}
        browserOnline={browserOnline}
        serverAvailable={serverAvailable}
        pendingCount={0}
        isSyncing={false}
        companyId={companyId}
        onSync={onSync}
      />
    </>
  );
}
