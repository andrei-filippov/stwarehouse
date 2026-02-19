import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useEquipment } from './hooks/useEquipment';
import { useEstimates } from './hooks/useEstimates';
import { useTemplates } from './hooks/useTemplates';
import { useChecklists } from './hooks/useChecklists';
import { useStaff } from './hooks/useStaff';
import { useGoals } from './hooks/useGoals';
import { Auth } from './components/Auth';
import { EquipmentManager } from './components/EquipmentManagement';
import { EstimateManager } from './components/EstimateManager';
import { TemplatesManager } from './components/Templates';
import { ChecklistsManager } from './components/Checklists';
import { StaffManager } from './components/StaffManager';
import { GoalsManager } from './components/GoalsManager';
import { PDFSettings } from './components/PDFSettings';
import { EventCalendar } from './components/EventCalendar';
import { Button } from './components/ui/button';
import { 
  Package, 
  FileText, 
  Layout, 
  Settings, 
  LogOut,
  User,
  Calendar,
  ClipboardCheck,
  Users,
  Target
} from 'lucide-react';
import type { PDFSettings as PDFSettingsType } from './types';

type Tab = 'equipment' | 'estimates' | 'templates' | 'calendar' | 'checklists' | 'staff' | 'goals' | 'settings';

function App() {
  const { user, profile, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const { equipment, categories, addEquipment, updateEquipment, deleteEquipment, bulkInsert, addCategory } = useEquipment(user?.id);
  const { estimates, createEstimate, updateEstimate, deleteEstimate } = useEstimates(user?.id);
  const { templates, createTemplate, updateTemplate, deleteTemplate } = useTemplates(user?.id);
  const { checklists, rules, createRule, deleteRule, createChecklist, updateChecklistItem, deleteChecklist } = useChecklists(user?.id, estimates);
  const { staff, addStaff, updateStaff, deleteStaff } = useStaff(user?.id);
  const { tasks, addTask, updateTask, deleteTask } = useGoals(user?.id);
  
  const [activeTab, setActiveTab] = useState<Tab>('equipment');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pdfSettings, setPdfSettings] = useState<PDFSettingsType>({
    logo: null,
    companyName: '',
    companyDetails: '',
    position: '',
    personName: '',
    signature: null,
    stamp: null
  });

  // Загрузка настроек PDF из localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pdfSettings');
    if (saved) {
      setPdfSettings(JSON.parse(saved));
    }
  }, []);

  const savePdfSettings = (settings: PDFSettingsType) => {
    setPdfSettings(settings);
    localStorage.setItem('pdfSettings', JSON.stringify(settings));
  };

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen">Загрузка...</div>;
  }

  if (!user) {
    return <Auth onSignIn={signIn} onSignUp={signUp} />;
  }

  const navItems = [
    { id: 'equipment' as Tab, label: 'Оборудование', icon: Package },
    { id: 'estimates' as Tab, label: 'Сметы', icon: FileText },
    { id: 'templates' as Tab, label: 'Шаблоны', icon: Layout },
    { id: 'calendar' as Tab, label: 'Календарь', icon: Calendar },
    { id: 'checklists' as Tab, label: 'Чек-листы', icon: ClipboardCheck },
    { id: 'staff' as Tab, label: 'Персонал', icon: Users },
    { id: 'goals' as Tab, label: 'Задачи', icon: Target },
    { id: 'settings' as Tab, label: 'Настройки PDF', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* Header - Desktop & Mobile */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-3 md:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-gray-900">СкладОборуд</h1>
              <p className="text-[10px] md:text-xs text-gray-500 hidden sm:block">Система учета оборудования</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 hidden sm:flex">
              <User className="w-4 h-4" />
              <span className="max-w-[150px] truncate">{profile?.name || user?.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="px-2 md:px-3">
              <LogOut className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Выйти</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Desktop Navigation */}
      <nav className="bg-white border-b hidden md:block">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === item.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden z-50">
        <div className="flex justify-around items-center h-16">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center flex-1 h-full ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">{item.label.slice(0, 8)}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-500"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 mb-0.5" /> : <Menu className="w-5 h-5 mb-0.5" />}
            <span className="text-[10px]">Ещё</span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute bottom-16 left-0 right-0 bg-white rounded-t-xl p-4" onClick={e => e.stopPropagation()}>
            <div className="space-y-2">
              {navItems.slice(5).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full p-3 rounded-lg ${
                      activeTab === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
        {activeTab === 'equipment' && (
          <EquipmentManager
            equipment={equipment}
            categories={categories}
            userId={user?.id}
            onAdd={addEquipment}
            onUpdate={updateEquipment}
            onDelete={deleteEquipment}
            onBulkInsert={bulkInsert}
            onAddCategory={addCategory}
          />
        )}

        {activeTab === 'estimates' && (
          <EstimateManager
            estimates={estimates}
            equipment={equipment}
            templates={templates}
            pdfSettings={pdfSettings}
            onCreate={createEstimate}
            onUpdate={updateEstimate}
            onDelete={deleteEstimate}
          />
        )}

        {activeTab === 'templates' && (
          <TemplatesManager
            templates={templates}
            categories={categories}
            equipment={equipment}
            onCreate={createTemplate}
            onUpdate={updateTemplate}
            onDelete={deleteTemplate}
          />
        )}

        {activeTab === 'calendar' && (
          <EventCalendar
            estimates={estimates}
            equipment={equipment}
          />
        )}

        {activeTab === 'checklists' && (
          <ChecklistsManager
            estimates={estimates}
            equipment={equipment}
            categories={categories}
            checklists={checklists}
            rules={rules}
            onCreateRule={createRule}
            onDeleteRule={deleteRule}
            onCreateChecklist={createChecklist}
            onUpdateChecklistItem={updateChecklistItem}
            onDeleteChecklist={deleteChecklist}
          />
        )}

        {activeTab === 'staff' && (
          <StaffManager
            staff={staff}
            onAdd={addStaff}
            onUpdate={updateStaff}
            onDelete={deleteStaff}
          />
        )}

        {activeTab === 'goals' && (
          <GoalsManager
            tasks={tasks}
            staff={staff}
            onAdd={addTask}
            onUpdate={updateTask}
            onDelete={deleteTask}
          />
        )}

        {activeTab === 'settings' && (
          <PDFSettings settings={pdfSettings} onSave={savePdfSettings} />
        )}
      </main>
    </div>
  );
}

export default App;