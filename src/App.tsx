import { useState, useEffect } from 'react';
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
import { EstimateManager } from './components/EstimateManager';
import { TemplatesManager } from './components/Templates';
import { ChecklistsManager } from './components/Checklists';
import { StaffManager } from './components/StaffManager';
import { GoalsManager } from './components/GoalsManager';
import { PDFSettings } from './components/PDFSettings';
import { EventCalendar } from './components/EventCalendar';
import { Analytics } from './components/Analytics';
import { CustomersManager } from './components/CustomersManager';
import { Button } from './components/ui/button';
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
  Target
} from 'lucide-react';
import type { PDFSettings as PDFSettingsType } from './types';

type Tab = 'equipment' | 'estimates' | 'templates' | 'calendar' | 'checklists' | 'staff' | 'goals' | 'analytics' | 'customers' | 'settings';

// Простая система ролей без permissions
const ROLE_TABS: Record<string, Tab[]> = {
  admin: ['equipment', 'estimates', 'templates', 'calendar', 'checklists', 'staff', 'goals', 'analytics', 'customers', 'settings'],
  manager: ['equipment', 'estimates', 'templates', 'calendar', 'checklists', 'goals', 'analytics', 'customers'],
  warehouse: ['equipment', 'checklists', 'calendar'],
  accountant: ['estimates', 'analytics', 'customers', 'calendar'],
};

function App() {
  const { user, profile, loading: authLoading, signIn, signUp, signOut } = useAuth();
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

  const userRole = profile?.role || 'manager';
  const allowedTabs = ROLE_TABS[userRole] || ROLE_TABS.manager;

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
  ];

  const navItems = allNavItems.filter(item => allowedTabs.includes(item.id));

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
              <span className="max-w-[150px] truncate">{profile?.name || user?.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="px-2 md:px-3 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors">
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
      </main>
    </div>
  );
}

export default App;
