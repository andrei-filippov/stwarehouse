import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { useAuditLogs, getActionLabel, getEntityLabel, type AuditAction, type EntityType } from '../hooks/useAuditLogs';
import { useAuth } from '../hooks/useAuth';
import { 
  History, 
  Search, 
  Filter, 
  RefreshCw, 
  User, 
  Calendar, 
  FileText,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const ACTIONS: { value: AuditAction | 'all'; label: string }[] = [
  { value: 'all', label: 'Все действия' },
  { value: 'create', label: 'Создание' },
  { value: 'update', label: 'Изменение' },
  { value: 'delete', label: 'Удаление' },
  { value: 'view', label: 'Просмотр' },
  { value: 'login', label: 'Вход' },
  { value: 'logout', label: 'Выход' },
];

const ENTITY_TYPES: { value: EntityType | 'all'; label: string }[] = [
  { value: 'all', label: 'Все типы' },
  { value: 'estimate', label: 'Сметы' },
  { value: 'equipment', label: 'Оборудование' },
  { value: 'customer', label: 'Заказчики' },
  { value: 'staff', label: 'Сотрудники' },
  { value: 'contract', label: 'Договоры' },
  { value: 'template', label: 'Шаблоны' },
  { value: 'user', label: 'Пользователи' },
];

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800 border-green-200',
  update: 'bg-blue-100 text-blue-800 border-blue-200',
  delete: 'bg-red-100 text-red-800 border-red-200',
  view: 'bg-gray-100 text-gray-800 border-gray-200',
  login: 'bg-purple-100 text-purple-800 border-purple-200',
  logout: 'bg-orange-100 text-orange-800 border-orange-200',
};

export function AuditLogs() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<AuditAction | 'all'>('all');
  const [selectedEntity, setSelectedEntity] = useState<EntityType | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filters = {
    action: selectedAction === 'all' ? undefined : selectedAction,
    entityType: selectedEntity === 'all' ? undefined : selectedEntity,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: search || undefined,
  };

  const { logs, loading, error, totalCount, refetch } = useAuditLogs(filters, 200);

  const handleRefresh = () => {
    refetch();
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd.MM.yyyy HH:mm:ss', { locale: ru });
  };

  const renderDataDiff = (oldData: any, newData: any) => {
    if (!oldData && !newData) return <p className="text-gray-400">Нет данных</p>;
    
    const changes: { field: string; old?: any; new?: any }[] = [];
    
    if (oldData && newData) {
      // Update - показываем изменения
      Object.keys({ ...oldData, ...newData }).forEach(key => {
        if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
          changes.push({
            field: key,
            old: oldData[key],
            new: newData[key],
          });
        }
      });
    } else if (newData) {
      // Create - показываем все поля
      Object.keys(newData).forEach(key => {
        changes.push({ field: key, new: newData[key] });
      });
    } else if (oldData) {
      // Delete - показываем удалённые данные
      Object.keys(oldData).forEach(key => {
        changes.push({ field: key, old: oldData[key] });
      });
    }

    return (
      <div className="space-y-1 text-sm">
        {changes.slice(0, 10).map((change, idx) => (
          <div key={idx} className="grid grid-cols-3 gap-2 py-1 border-b border-gray-100 last:border-0">
            <span className="font-medium text-gray-600">{change.field}:</span>
            <span className="text-red-600 line-through truncate">
              {change.old !== undefined ? String(change.old).substring(0, 50) : '-'}
            </span>
            <span className="text-green-600 truncate">
              {change.new !== undefined ? String(change.new).substring(0, 50) : '-'}
            </span>
          </div>
        ))}
        {changes.length > 10 && (
          <p className="text-gray-400 text-xs">... и ещё {changes.length - 10} изменений</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-blue-500" />
              <div>
                <CardTitle>Журнал аудита</CardTitle>
                <p className="text-sm text-gray-500">
                  Всего записей: {totalCount}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Фильтры */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Поиск по пользователю или названию..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? 'bg-gray-100' : ''}
              >
                <Filter className="w-4 h-4 mr-2" />
                Фильтры
                {showFilters ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-gray-50 rounded-lg">
                <Select value={selectedAction} onValueChange={(v) => setSelectedAction(v as AuditAction)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Действие" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((action) => (
                      <SelectItem key={action.value} value={action.value}>
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedEntity} onValueChange={(v) => setSelectedEntity(v as EntityType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Тип" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  placeholder="С даты"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />

                <Input
                  type="date"
                  placeholder="По дату"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Таблица логов */}
          {error ? (
            <div className="text-center py-8 text-red-500">
              <p>Ошибка загрузки логов</p>
              <p className="text-sm">{error.message}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Нет записей в журнале</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Время</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Пользователь</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Действие</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Объект</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Название</th>
                      <th className="text-center py-2 px-3 font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-gray-400" />
                            <span className="truncate max-w-[120px]">{log.user_name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className={ACTION_COLORS[log.action] || ''}>
                            {getActionLabel(log.action)}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {getEntityLabel(log.entity_type)}
                        </td>
                        <td className="py-2 px-3 truncate max-w-[200px]">
                          {log.entity_name || '-'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {(log.old_data || log.new_data) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Диалог деталей */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Детали действия</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Пользователь</p>
                  <p className="font-medium">{selectedLog.user_name}</p>
                  <p className="text-gray-400 text-xs">{selectedLog.user_email}</p>
                </div>
                <div>
                  <p className="text-gray-500">Время</p>
                  <p className="font-medium">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Действие</p>
                  <Badge className={ACTION_COLORS[selectedLog.action]}>
                    {getActionLabel(selectedLog.action)}
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-500">Объект</p>
                  <p className="font-medium">{getEntityLabel(selectedLog.entity_type)}</p>
                  {selectedLog.entity_name && (
                    <p className="text-gray-400 text-xs truncate">{selectedLog.entity_name}</p>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-3 bg-gray-50">
                <p className="font-medium mb-2">Изменения:</p>
                {renderDataDiff(selectedLog.old_data, selectedLog.new_data)}
              </div>

              {(selectedLog.old_data || selectedLog.new_data) && (
                <div className="space-y-2">
                  {selectedLog.old_data && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Старые данные:</p>
                      <pre className="text-xs bg-red-50 p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(selectedLog.old_data, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.new_data && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Новые данные:</p>
                      <pre className="text-xs bg-green-50 p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(selectedLog.new_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
