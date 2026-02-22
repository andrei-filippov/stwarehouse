import { ShieldAlert } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { getRoleLabel, type UserRole } from '../lib/permissions';

interface AccessDeniedProps {
  role?: UserRole;
  requiredRole?: string;
}

export function AccessDenied({ role, requiredRole }: AccessDeniedProps) {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <Card className="max-w-md w-full p-8 text-center shadow-lg rounded-xl">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Доступ запрещен</h2>
        <p className="text-gray-600 mb-4">
          У вас недостаточно прав для просмотра этой страницы.
        </p>
        {role && (
          <p className="text-sm text-gray-500 mb-6">
            Ваша роль: <span className="font-medium">{getRoleLabel(role)}</span>
            {requiredRole && (
              <span className="block mt-1">
                Требуется: <span className="font-medium">{requiredRole}</span>
              </span>
            )}
          </p>
        )}
        <Button 
          onClick={() => window.location.href = '/'} 
          className="rounded-lg"
        >
          На главную
        </Button>
      </Card>
    </div>
  );
}
