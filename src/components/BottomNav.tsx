import { useState } from 'react';
import { Package, FileText, Calendar, Users, Menu, Plus, X } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import type { TabId } from '../lib/permissions';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  availableTabs: { id: TabId; label: string; icon: React.ElementType }[];
  onSignOut: () => void;
}

export function BottomNav({ activeTab, onTabChange, availableTabs, onSignOut }: BottomNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

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
      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-20 right-4 z-40 md:hidden">
        {fabOpen && (
          <div className="flex flex-col gap-2 mb-2">
            <Button
              size="sm"
              className="rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                onTabChange('equipment');
                setFabOpen(false);
                // Здесь можно открыть диалог добавления оборудования
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Оборудование
            </Button>
            <Button
              size="sm"
              className="rounded-full shadow-lg bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                onTabChange('estimates');
                setFabOpen(false);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Смету
            </Button>
          </div>
        )}
        <Button
          size="lg"
          className="rounded-full w-14 h-14 shadow-xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800"
          onClick={() => setFabOpen(!fabOpen)}
        >
          {fabOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </Button>
      </div>

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
              <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
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
