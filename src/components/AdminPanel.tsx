import { Shield, Users, History } from 'lucide-react';
import { Card } from './ui/card';
import { AuditLogs } from './AuditLogs';

interface AdminPanelProps {
  currentUserId?: string;
}

export function AdminPanel({ currentUserId }: AdminPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-md">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Администрирование</h2>
            <p className="text-sm text-gray-500">Управление доступом и журнал аудита</p>
          </div>
        </div>
      </div>

      <div className="border-b">
        <div className="flex gap-4">
          <div className="pb-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Журнал аудита
            </div>
          </div>
        </div>
      </div>

      <AuditLogs />
    </div>
  );
}
