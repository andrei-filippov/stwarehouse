import { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, User } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { CompanyProvider, useCompanyContext } from './contexts/CompanyContext';
import { getSlugFromPath, saveSelectedCompany } from './lib/companyUrl';
import { RegisterCompanyForm } from './components/auth/RegisterCompanyForm';
import { CompanySelector } from './components/auth/CompanySelector';
import { Auth } from './components/Auth';
import { EquipmentManager } from './components/EquipmentManagement';
import { EstimateManager } from './components/EstimateManager';
import { TemplatesManager } from './components/Templates';
import { ChecklistsManager } from './components/Checklists';
import { StaffManager } from './components/StaffManager';
import { GoalsManager } from './components/GoalsManager';
import { CableManager } from './components/CableManager';
import { PDFSettings } from './components/PDFSettings';
import { EventCalendar } from './components/EventCalendar';
import { Analytics } from './components/Analytics';
import { CustomersManager } from './components/CustomersManager';
import { ContractManager } from './components/ContractManager';
import { AdminPanel } from './components/AdminPanel';
import { AccessDenied } from './components/AccessDenied';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { CommandMenu } from './components/CommandMenu';
import { Spinner } from './components/ui/spinner';

import { useEquipment } from './hooks/useEquipment';
import { useEstimates } from './hooks/useEstimates';
import { useTemplates } from './hooks/useTemplates';
import { useChecklists } from './hooks/useChecklists';
import { useStaff } from './hooks/useStaff';
import { useGoals } from './hooks/useGoals';
import { useCustomers } from './hooks/useCustomers';
import { useCableInventory } from './hooks/useCableInventory';
import { useExpenses } from './hooks/useExpenses';
import { useContracts } from './hooks/useContracts';

import { 
  BarChart3,
  Building2,
  FileText, 
  Layout, 
  Settings, 
  Calendar,
  ClipboardCheck,
  Users,
  Target,
  Shield,
  Cable,
  FileSignature
} from 'lucide-react';
import type { PDFSettings as PDFSettingsType } from './types';
import { hasAccess, getRoleLabel, type UserRole, type TabId } from './lib/permissions';

type Tab = TabId;

// Основной компонент приложения
function App() {
  const { user, profile, permissions, loading: authLoading, signIn, signUp, signOut } = useAuth();

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
    <CompanyProvider>
      <AppContent 
        user={user}
        profile={profile}
        permissions={permissions}
        signOut={signOut}
      />
    </CompanyProvider>
  );
}

// Внутренний компонент с доступом к компании
function AppContent({ user, profile, permissions, signOut }: any) {
  const { company, companies, members, myMember, updateCompany, inviteMember, removeMember, updateMemberRole, loading: companyLoading, switchCompany, loadCompany, loadUserCompanies } = useCompanyContext();
  const [showRegister, setShowRegister] = useState(false);
  const [showCompanySelector, setShowCompanySelector] = useState(false);

  // Обработка пути /c/company-slug
  useEffect(() => {
    const slugFromPath = getSlugFromPath();
    if (slugFromPath) {
      saveSelectedCompany(slugFromPath);
      // Здесь можно загрузить компанию по slug
    }
  }, []);

  if (companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  // Если нет компании или запрошен выбор - показываем форму регистрации или выбор
  if (!company || showCompanySelector) {
    if (showRegister) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <RegisterCompanyForm 
            onSuccess={() => window.location.reload()}
            onLogin={() => setShowRegister(false)}
          />
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <CompanySelector 
          onSelect={() => {
            setShowCompanySelector(false);
            loadCompany();
          }}
          onCreateNew={() => setShowRegister(true)}
        />
      </div>
    );
  }

  // Основной контент с компанией
  return (
    <MainApp 
      user={user}
      profile={profile}
      permissions={permissions}
      company={company}
      signOut={signOut}
      onSwitchCompany={() => setShowCompanySelector(true)}
    />
  );
}

// Основной компонент с хуками
function MainApp({ user, profile, permissions, company, signOut, onSwitchCompany }: any) {
  const companyId = company?.id;
  const userRole = (profile?.role || 'manager') as UserRole;

  // Хуки с companyId
  const { equipment, categories, loading: equipmentLoading, addEquipment, updateEquipment, deleteEquipment, bulkInsert, addCategory, deleteCategory } = useEquipment(companyId);
  const { estimates, loading: estimatesLoading, createEstimate, updateEstimate, deleteEstimate, startEditing, stopEditing } = useEstimates(companyId);
  const { templates, loading: templatesLoading, createTemplate, updateTemplate, deleteTemplate } = useTemplates(companyId);
  const { checklists, rules, loading: checklistsLoading, createRule, deleteRule, createChecklist, updateChecklistItem, deleteChecklist } = useChecklists(companyId, estimates);
  const { staff, loading: staffLoading, addStaff, updateStaff, deleteStaff } = useStaff(companyId);
  const { tasks, loading: goalsLoading, addTask, updateTask, deleteTask } = useGoals(companyId);
  const { customers, loading: customersLoading, error: customersError, addCustomer, updateCustomer, deleteCustomer } = useCustomers(companyId);
  const { categories: cableCategories, inventory: cableInventory, movements: cableMovements, stats: cableStats, loading: cableLoading, addCategory: addCableCategory, updateCategory: updateCableCategory, deleteCategory: deleteCableCategory, upsertInventory: upsertCableInventory, updateInventoryQty: updateCableInventoryQty, deleteInventory: deleteCableInventory, issueCable, returnCable } = useCableInventory(companyId);
  const { expenses, loading: expensesLoading, addExpense, updateExpense, deleteExpense } = useExpenses(companyId);
  const { contracts, templates: contractTemplates, loading: contractsLoading, createContract, updateContract, deleteContract, getNextContractNumber } = useContracts(companyId);

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [fabAction, setFabAction] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pdfSettings, setPdfSettings] = useState<PDFSettingsType>({
    logo: null,
    companyName: company?.name || '',
    companyDetails: `${company?.legal_address || ''}\nИНН: ${company?.inn || ''}`,
    position: '',
    personName: profile?.name || '',
    signature: null,
    stamp: null
  });

  useEffect(() => {
    const saved = localStorage.getItem('pdfSettings');
    if (saved) {
      setPdfSettings(JSON.parse(saved));
    }
  }, []);

  const handleFabClick = useCallback(() => {
    setFabAction(prev => prev + 1);
  }, []);

  const savePdfSettings = (settings: PDFSettingsType) => {
    setPdfSettings(settings);
    localStorage.setItem('pdfSettings', JSON.stringify(settings));
  };

  // Проверка доступа
  const checkAccess = (tabId: TabId): boolean => {
    const customPerm = permissions?.find((p: any) => p.tab_id === tabId);
    if (customPerm) return customPerm.allowed;
    return hasAccess(userRole, tabId);
  };

  // Список вкладок
  const allNavItems = useMemo(() => [
    { id: 'dashboard' as Tab, label: 'Дашборд', icon: BarChart3 },
    { id: 'equipment' as Tab, label: 'Оборудование', icon: Package },
    { id: 'estimates' as Tab, label: 'Сметы', icon: FileText },
    { id: 'templates' as Tab, label: 'Шаблоны', icon: Layout },
    { id: 'calendar' as Tab, label: 'Календарь', icon: Calendar },
    { id: 'checklists' as Tab, label: 'Чек-листы', icon: ClipboardCheck },
    { id: 'staff' as Tab, label: 'Персонал', icon: Users },
    { id: 'goals' as Tab, label: 'Задачи', icon: Target },
    { id: 'cables' as Tab, label: 'Коммутация', icon: Cable },
    { id: 'analytics' as Tab, label: 'Аналитика', icon: BarChart3 },
    { id: 'customers' as Tab, label: 'Заказчики', icon: Building2 },
    { id: 'contracts' as Tab, label: 'Договоры', icon: FileSignature },
    { id: 'settings' as Tab, label: 'Настройки PDF', icon: Settings },
    { id: 'admin' as Tab, label: 'Админ', icon: Shield },
  ], []);

  const navItems = allNavItems.filter(item => checkAccess(item.id));

  useEffect(() => {
    if (profile && navItems.length > 0) {
      const currentTabAccessible = checkAccess(activeTab);
      if (!currentTabAccessible) {
        setActiveTab(navItems[0].id);
      }
    }
  }, [profile, permissions, navItems, activeTab]);

  const analyticsData = { equipment, estimates, staff, customers, expenses, onAddExpense: addExpense, onUpdateExpense: updateExpense, onDeleteExpense: deleteExpense };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar 
          activeTab={activeTab}
          onTabChange={setActiveTab}
          availableTabs={navItems}
          onSignOut={signOut}
          userName={profile?.name}
          userRole={getRoleLabel(userRole)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">СкладОборуд</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
        </div>
      </header>

      {/* Global Search */}
      <CommandMenu 
        equipment={equipment}
        estimates={estimates}
        customers={customers}
        availableTabs={navItems}
        onTabChange={setActiveTab}
      />

      {/* Main Content */}
      <main className="flex-1 pt-16 md:pt-0 pb-20 md:pb-0 overflow-auto">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              equipment={equipment}
              estimates={estimates}
              customers={customers}
              staff={staff}
              goals={tasks}
              onTabChange={setActiveTab}
              checkAccess={checkAccess}
            />
          )}

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
              fabAction={fabAction}
            />
          )}

          {activeTab === 'estimates' && (
            <EstimateManager
              estimates={estimates}
              equipment={equipment}
              templates={templates}
              customers={customers}
              pdfSettings={pdfSettings}
              equipmentCategories={
                (categories?.length > 0 
                  ? categories.map((c: any) => c.name)
                  : [...new Set(equipment?.map((e: any) => e.category).filter(Boolean) || [])].sort()
                )
              }
              onCreate={(estimate, items, categoryOrder) => createEstimate(estimate, items, user!.id, profile?.name, categoryOrder)}
              onUpdate={(id, estimate, items, categoryOrder) => updateEstimate(id, estimate, items, user!.id, categoryOrder)}
              onDelete={deleteEstimate}
              onCreateEquipment={addEquipment}
              onStartEditing={startEditing}
              onStopEditing={stopEditing}
              currentUserId={user?.id}
              fabAction={fabAction}
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
              userId={user?.id}
              fabAction={fabAction}
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
              fabAction={fabAction}
            />
          )}

          {activeTab === 'staff' && (
            <StaffManager
              staff={staff}
              onAdd={addStaff}
              onUpdate={updateStaff}
              onDelete={deleteStaff}
              loading={staffLoading}
              fabAction={fabAction}
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
              fabAction={fabAction}
            />
          )}

          {activeTab === 'cables' && (
            <CableManager
              categories={cableCategories}
              inventory={cableInventory}
              movements={cableMovements}
              stats={cableStats}
              loading={cableLoading}
              onAddCategory={addCableCategory}
              onUpdateCategory={updateCableCategory}
              onDeleteCategory={deleteCableCategory}
              onUpsertInventory={upsertCableInventory}
              onUpdateInventoryQty={updateCableInventoryQty}
              onDeleteInventory={deleteCableInventory}
              onIssueCable={issueCable}
              onReturnCable={returnCable}
              fabAction={fabAction}
            />
          )}

          {activeTab === 'analytics' && (
            <Analytics 
              equipment={equipment}
              estimates={estimates}
              staff={staff}
              customers={customers}
              expenses={expenses}
              onAddExpense={addExpense}
              onUpdateExpense={updateExpense}
              onDeleteExpense={deleteExpense}
            />
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
              fabAction={fabAction}
            />
          )}

          {activeTab === 'contracts' && (
            checkAccess('contracts') ? (
              <ContractManager
                contracts={contracts}
                templates={contractTemplates}
                customers={customers}
                estimates={estimates}
                pdfSettings={pdfSettings}
                onCreate={createContract}
                onUpdate={updateContract}
                onDelete={deleteContract}
                getNextNumber={getNextContractNumber}
                fabAction={fabAction}
              />
            ) : (
              <AccessDenied role={userRole} requiredRole="Администратор" />
            )
          )}

          {activeTab === 'settings' && (
            <PDFSettings settings={pdfSettings} onSave={savePdfSettings} />
          )}

          {activeTab === 'admin' && (
            checkAccess('admin') ? (
              <AdminPanel 
                currentUserId={user?.id}
                company={company}
                members={members || []}
                myRole={myMember?.role}
                onUpdateCompany={updateCompany}
                onInviteMember={inviteMember}
                onRemoveMember={removeMember}
                onUpdateMemberRole={updateMemberRole}
              />
            ) : (
              <AccessDenied role={userRole} requiredRole="Администратор" />
            )
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        availableTabs={navItems}
        onSignOut={signOut}
        onFabClick={handleFabClick}
      />
    </div>
  );
}

export default App;
