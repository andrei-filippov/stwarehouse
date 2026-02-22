import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { Menu, X, Package } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useEquipment } from './hooks/useEquipment';
import { useEstimates } from './hooks/useEstimates';
import { useTemplates } from './hooks/useTemplates';
import { useChecklists } from './hooks/useChecklists';
import { useStaff } from './hooks/useStaff';
import { useGoals } from './hooks/useGoals';
import { useCustomers } from './hooks/useCustomers';
import { Auth } from './components/Auth';
import { EquipmentManager } from './components/EquipmentManagement';

// Lazy loading для тяжёлых компонентов
const EstimateManager = lazy(() => import('./components/EstimateManager').then(m => ({ default: m.EstimateManager })));
const TemplatesManager = lazy(() => import('./components/Templates').then(m => ({ default: m.TemplatesManager })));
const ChecklistsManager = lazy(() => import('./components/Checklists').then(m => ({ default: m.ChecklistsManager })));
const StaffManager = lazy(() => import('./components/StaffManager').then(m => ({ default: m.StaffManager })));
const GoalsManager = lazy(() => import('./components/GoalsManager').then(m => ({ default: m.GoalsManager })));
const PDFSettings = lazy(() => import('./components/PDFSettings').then(m => ({ default: m.PDFSettings })));
const EventCalendar = lazy(() => import('./components/EventCalendar').then(m => ({ default: m.EventCalendar })));
const Analytics = lazy(() => import('./components/Analytics').then(m => ({ default: m.Analytics })));
const CustomersManager = lazy(() => import('./components/CustomersManager').then(m => ({ default: m.CustomersManager })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel }));
const AccessDenied = lazy(() => import('./components/AccessDenied').then(m => ({ default: m.AccessDenied })));
import { Button } from './components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './components/ui/sheet';
import { Spinner } from './components/ui/spinner';
import { 
  BarChart3,
  Building2,
  FileText, 
  Layout, 
  Settings, 
  LogOut,
  User,
  Calendar,
  ClipboardCheck,
  Users,
  Target,
  Shield
} from 'lucide-react';
import type { PDFSettings as PDFSettingsType } from './types';

type Tab = TabId;

import { hasAccess, getRoleLabel, type UserRole, type TabId } from './lib/permissions';
import { AccessDenied } from './components/AccessDenied';

function App() {
  const { user, profile, permissions, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const { equipment, categories, loading: equipmentLoading, addEquipment, updateEquipment, deleteEquipment, bulkInsert, addCategory, deleteCategory } = useEquipment(user?.id);
  const { estimates, loading: estimatesLoading, createEstimate, updateEstimate, deleteEstimate } = useEstimates(user?.id);
  const { templates, loading: templatesLoading, createTemplate, updateTemplate, deleteTemplate } = useTemplates(user?.id);
  const { checklists, rules, loading: checklistsLoading, createRule, deleteRule, createChecklist, updateChecklistItem, deleteChecklist } = useChecklists(user?.id, estimates);
  const { staff, loading: staffLoading, addStaff, updateStaff, deleteStaff } = useStaff(user?.id);
  const { tasks, loading: goalsLoading, addTask, updateTask, deleteTask } = useGoals(user?.id);
  const { customers, loading: customersLoading, error: customersError, addCustomer, updateCustomer, deleteCustomer } = useCustomers(user?.id);
  const analyticsData = { equipment, estimates, staff, customers };
  
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

  useEffect(() => {
    const saved = localStorage.getItem('pdfSettings');
    if (saved) {
      setPdfSettings(JSON.parse(saved));
    }
  }, []);

  // Список всех вкладок (определяем до использования)
  const allNavItems = [
    { id: 'equipment' as Tab, label: 'Оборудование', icon: Package },
    { id: 'estimates' as Tab, label: 'Сметы', icon: FileText },
    { id: 'templates' as Tab, label: 'Шаблоны', icon: Layout },
    { id: 'calendar' as Tab, label: 'Календарь', icon: Calendar },
    { id: 'checklists' as Tab, label: 'Чек-листы', icon: ClipboardCheck },
    { id: 'staff' as Tab, label: 'Персонал', icon: Users },
    { id: 'goals' as Tab, label: 'Задачи', icon: Target },
    { id: 'analytics' as Tab, label: 'Аналитика', icon: BarChart3 },
    { id: 'customers' as Tab, label: 'Заказчики', icon: Building2 },
    { id: 'settings' as Tab, label: 'Настройки PDF', icon: Settings },
    { id: 'admin' as Tab, label: 'Админ', icon: Shield },
  ];

  // Получаем роль пользователя
  const userRole = (profile?.role || 'manager') as UserRole;
  
  // Проверка доступа с учётом кастомных разрешений
  const checkAccess = (tabId: TabId): boolean => {
    // Сначала проверяем кастомное разрешение
    const customPerm = permissions?.find(p => p.tab_id === tabId);
    if (customPerm) {
      return customPerm.allowed;
    }
    // Если нет кастомного - используем роль
    return hasAccess(userRole, tabId);
  };
  
  // Фильтруем доступные вкладки
  const navItems = allNavItems.filter(item => checkAccess(item.id));

  // При загрузке профиля переключаем на первую доступную вкладку (если текущая недоступна)
  useEffect(() => {
    if (profile && navItems.length > 0) {
      const currentTabAccessible = checkAccess(activeTab);
      if (!currentTabAccessible) {
        setActiveTab(navItems[0].id);
      }
    }
  }, [profile, permissions, navItems, activeTab]);

  const savePdfSettings = (settings: PDFSettingsType) => {
    setPdfSettings(settings);
    localStorage.setItem('pdfSettings', JSON.stringify(settings));
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center">
          <Spinner className="w-10 h-10 mb-4" />
          <p className="text-gray-600 font-medium">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth onSignIn={signIn} onSignUp={signUp} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-3 md:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md">
              <Package className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-gray-900">СкладОборуд</h1>
              <p className="text-[10px] md:text-xs text-gray-500 hidden sm:block">Система учета оборудования</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 hidden sm:flex">
              <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="max-w-[150px] truncate font-medium">{profile?.name || user?.email}</span>
                <span className="text-xs text-gray-400">{getRoleLabel(userRole)}</span>
              </div>
            </div>
            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="md:hidden px-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg font-bold">СкладОборуд</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col p-2 gap-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                          activeTab === item.id
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
                <div className="mt-auto p-4 border-t">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{profile?.name || user?.email}</span>
                      <span className="text-xs text-gray-400">{getRoleLabel(userRole)}</span>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signOut();
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Выйти
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <Button variant="ghost" size="sm" onClick={signOut} className="px-2 md:px-3 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors hidden md:flex">
              <LogOut className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Выйти</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Desktop Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b hidden md:block sticky top-[65px] z-30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap rounded-t-lg hover:bg-gray-50 ${
                    activeTab === item.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50/50'
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
            onDeleteCategory={deleteCategory}
            loading={equipmentLoading}
          />
        )}

        {activeTab === 'estimates' && (
          <EstimateManager
            estimates={estimates}
            equipment={equipment}
            templates={templates}
            customers={customers}
            pdfSettings={pdfSettings}
            onCreate={(estimate, items) => createEstimate(estimate, items, profile?.name)}
            onUpdate={updateEstimate}
            onDelete={deleteEstimate}
            loading={estimatesLoading}
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
            loading={templatesLoading}
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
            loading={checklistsLoading}
          />
        )}

        {activeTab === 'staff' && (
          <StaffManager
            staff={staff}
            onAdd={addStaff}
            onUpdate={updateStaff}
            onDelete={deleteStaff}
            loading={staffLoading}
          />
        )}

        {activeTab === 'goals' && (
          <GoalsManager
            tasks={tasks}
            staff={staff}
            onAdd={addTask}
            onUpdate={updateTask}
            onDelete={deleteTask}
            loading={goalsLoading}
          />
        )}

        {activeTab === 'analytics' && (
          <Analytics {...analyticsData} />
        )}

        {activeTab === 'customers' && (
          <CustomersManager
            customers={customers}
            userId={user?.id}
            onAdd={addCustomer}
            onUpdate={updateCustomer}
            onDelete={deleteCustomer}
            loading={customersLoading}
            error={customersError}
          />
        )}

        {activeTab === 'settings' && (
          <PDFSettings settings={pdfSettings} onSave={savePdfSettings} />
        )}

        {activeTab === 'admin' && (
          checkAccess('admin') ? (
            <AdminPanel currentUserId={user?.id} />
          ) : (
            <AccessDenied role={userRole} requiredRole="Администратор" />
          )
        )}
      </main>
    </div>
  );
}

export default App;
