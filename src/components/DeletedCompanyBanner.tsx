import { AlertTriangle, RotateCcw, Eye } from 'lucide-react';
import { Button } from './ui/button';
import { useCompanyContext } from '../contexts/CompanyContext';
import { toast } from 'sonner';
import { useState } from 'react';

export function DeletedCompanyBanner() {
  const { company, isOwner, isDeleted, restoreCompany, loadUserCompanies } = useCompanyContext();
  const [restoring, setRestoring] = useState(false);

  if (!isDeleted || !company) return null;

  const handleRestore = async () => {
    if (!company) return;
    
    const confirmed = window.confirm(
      `Восстановить компанию "${company.name}"?\n\n` +
      'Все данные станут доступны для редактирования.'
    );
    if (!confirmed) return;

    setRestoring(true);
    const { error } = await restoreCompany(company.id);
    setRestoring(false);

    if (error) {
      toast.error('Ошибка восстановления: ' + error);
    } else {
      toast.success('Компания восстановлена!');
      await loadUserCompanies();
      window.location.reload();
    }
  };

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">
              Компания "{company.name}" удалена
            </p>
            <p className="text-xs text-red-600">
              {isOwner 
                ? 'Данные доступны только для просмотра. Вы можете восстановить компанию.'
                : 'Обратитесь к владельцу компании для восстановления доступа.'
              }
            </p>
          </div>
        </div>
        
        {isOwner && (
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800"
            onClick={handleRestore}
            disabled={restoring}
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            {restoring ? 'Восстановление...' : 'Восстановить'}
          </Button>
        )}
      </div>
    </div>
  );
}
