import { useState } from 'react';
import { Package, FileText, Calendar, Users, Menu, Plus, Trash2, Wifi, WifiOff } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { toast } from 'sonner';
import type { TabId } from '../lib/permissions';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  availableTabs: { id: TabId; label: string; icon: React.ElementType }[];
  onSignOut: () => void;
  onFabClick?: () => void;
}

export function BottomNav({ activeTab, onTabChange, availableTabs, onSignOut, onFabClick }: BottomNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Сброс локальных данных (для мобильных когда данные "застревают")
  const handleClearCache = async () => {
    try {
      const { clearAllLocalData, clearDeletedEstimates } = await import('../lib/offlineDB');
      await clearAllLocalData();
      await clearDeletedEstimates();
      toast.success('Кэш очищен. Перезагрузка...');
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      toast.error('Ошибка очистки кэша');
    }
  };
  
  // Скрываем FAB на дашборде и сметах (там свой интерфейс создания)
  const showFab = activeTab !== 'dashboard' && activeTab !== 'estimates' && onFabClick !== undefined;

  // Основные вкладки для Bottom Nav (максимум 4 + меню)
  const mainTabs = [
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
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 md:hidden">
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
                    : 'text-gray-500 hover:text-gray-700'
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
                <div className="grid grid-cols-3 gap-3 pb-20">
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
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-xs font-medium text-center">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Статус и кнопки сброса */}
                <div className="absolute bottom-16 left-0 right-0 px-4 py-3 border-t bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {isOnline ? (
                        <>
                          <Wifi className="w-4 h-4 text-green-500" />
                          <span>Онлайн</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-4 h-4 text-red-500" />
                          <span>Офлайн</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full rounded-lg text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                    onClick={() => {
                      handleClearCache();
                      setMenuOpen(false);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Сбросить кэш
                  </Button>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
                  <Button 
                    variant="outline" 
                    className="w-full rounded-xl hover:bg-red-50 hover:text-red-600"
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
        <div className="h-safe-area-inset-bottom bg-white" />
      </nav>
    </>
  );
}
