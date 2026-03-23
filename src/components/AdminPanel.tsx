import { useState } from 'react';
import { Shield, History, Building2, Users, Lock } from 'lucide-react';
import { AuditLogs } from './AuditLogs';
import { CompanySettings } from './CompanySettings';
import { CompanyMembersManager } from './CompanyMembersManager';
import { PermissionsManager } from './PermissionsManager';

export function AdminPanel({ currentUserId }: { currentUserId?: string }) {
  const [activeTab, setActiveTab] = useState<'team' | 'company' | 'access' | 'logs'>('team');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-md">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Администрирование</h2>
            <p className="text-sm text-muted-foreground">Управление компанией и доступом</p>
          </div>
        </div>
      </div>

      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('team')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'team'
                ? 'border-blue-600 text-blue-600'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Команда
            </div>
          </button>
          <button
            onClick={() => setActiveTab('company')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'company'
                ? 'border-blue-600 text-blue-600'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Реквизиты
            </div>
          </button>
          <button
            onClick={() => setActiveTab('access')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'access'
                ? 'border-blue-600 text-blue-600'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Доступ
            </div>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-blue-600 text-blue-600'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Журнал аудита
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'logs' ? (
        <AuditLogs />
      ) : activeTab === 'company' ? (
        <CompanySettings />
      ) : activeTab === 'access' ? (
        <PermissionsManager currentUserId={currentUserId} />
      ) : (
        <CompanyMembersManager />
      )}
    </div>
  );
}

export default AdminPanel;

