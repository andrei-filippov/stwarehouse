
import { 
  Package, 
  FileText, 
  Calendar, 
  Building2, 
  Layout, 
  ClipboardCheck, 
  Users, 
  Target, 
  Cable,
  BarChart3,
  Settings, 
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  Plus,
  UserPlus
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import type { TabId } from '../lib/permissions';
import { useCompanyContext } from '../contexts/CompanyContext';
import { OfflineIndicator } from './OfflineIndicator';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  availableTabs: { id: TabId; label: string; icon: React.ElementType }[];
  onSignOut: () => void;
  userName?: string;
  userRole?: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar(props: SidebarProps) {
  const { activeTab, onTabChange, availableTabs, onSignOut, userName, userRole, collapsed, onToggleCollapse } = props;
  const ctx = useCompanyContext();

  const mainTabs = availableTabs.filter(tab => 
    ['equipment', 'estimates', 'calendar', 'customers', 'contracts'].includes(tab.id)
  );
  
  const referenceTabs = availableTabs.filter(tab => 
    ['templates', 'checklists', 'staff', 'goals', 'cables'].includes(tab.id)
  );
  
  const systemTabs = availableTabs.filter(tab => 
    ['analytics', 'settings', 'admin'].includes(tab.id)
  );

  const renderNavItem = (tab: { id: TabId; label: string; icon: React.ElementType }) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    
    return (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
          isActive 
            ? 'bg-blue-600 text-white shadow-md' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        } ${collapsed ? 'justify-center' : ''}`}
        title={collapsed ? tab.label : undefined}
      >
        <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} />
        {!collapsed && <span className="text-sm font-medium">{tab.label}</span>}
        {!collapsed && isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />}
      </button>
    );
  };

  const companies = ctx.companies || [];
  const currentCompany = ctx.company;
  const onSwitchCompany = ctx.switchCompany;

  return (
    <aside 
      className={`hidden md:flex flex-col bg-white border-r h-screen sticky top-0 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg">СкладОборуд</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center mx-auto">
            <Package className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {/* Main */}
        <div className="space-y-1">
          {!collapsed && <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Основное</p>}
          {mainTabs.map(renderNavItem)}
        </div>

        {/* References */}
        {referenceTabs.length > 0 && (
          <div className="space-y-1">
            {!collapsed && <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Справочники</p>}
            {referenceTabs.map(renderNavItem)}
          </div>
        )}

        {/* System */}
        {systemTabs.length > 0 && (
          <div className="space-y-1">
            {!collapsed && <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Система</p>}
            {systemTabs.map(renderNavItem)}
          </div>
        )}
      </div>

      {/* User & Company */}
      <div className="p-3 border-t space-y-2">
        {/* Company Selector */}
        {companies.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className={`w-full justify-start text-gray-700 hover:text-blue-600 hover:bg-blue-50 ${collapsed ? 'justify-center px-2' : ''}`}
                title={collapsed ? currentCompany?.name : undefined}
              >
                <Building2 className="w-5 h-5 shrink-0" />
                {!collapsed && (
                  <span className="ml-2 truncate flex-1 text-left">{currentCompany?.name || 'Выберите компанию'}</span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="px-2 py-1.5 text-sm font-semibold text-gray-500">
                Ваши компании
              </div>
              <DropdownMenuSeparator />
              {companies.map(company => (
                <DropdownMenuItem 
                  key={company.id}
                  onClick={() => onSwitchCompany(company.id)}
                  className={company.id === currentCompany?.id ? 'bg-blue-50 text-blue-700' : ''}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  {company.name}
                  {company.id === currentCompany?.id && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.location.href = '/?createCompany=1'}>
                <Plus className="w-4 h-4 mr-2" />
                Создать компанию
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {/* Offline Status */}
        <div className={`${collapsed ? 'flex justify-center' : 'px-3'}`}>
          <OfflineIndicator />
        </div>
        
        {!collapsed && userName && (
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
            <p className="text-xs text-gray-500">{userRole}</p>
          </div>
        )}
        
        <Button 
          variant="ghost" 
          className={`w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50 ${collapsed ? 'justify-center px-2' : ''}`}
          onClick={onSignOut}
          title={collapsed ? 'Выйти' : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="ml-2">Выйти</span>}
        </Button>

        {/* Collapse toggle */}
        <Button 
          variant="ghost" 
          size="sm"
          className={`w-full text-gray-400 hover:text-gray-600 ${collapsed ? 'justify-center' : 'justify-end'}`}
          onClick={onToggleCollapse}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><span className="text-xs mr-1">Свернуть</span><ChevronLeft className="w-4 h-4" /></>}
        </Button>
      </div>
    </aside>
  );
}
