import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { 
  CalendarDays, 
  Package, 
  FileText, 
  Users, 
  TrendingUp, 
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Target,
  Circle
} from 'lucide-react';
import type { Equipment, Estimate, Customer, Staff, Goal } from '../types';
import { TASK_CATEGORIES, TASK_PRIORITIES } from '../types/goals';
import { format, isToday, isTomorrow, isPast, parseISO, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';

// Безопасный парсинг даты
const safeParseISO = (date: string | undefined): Date | null => {
  if (!date) return null;
  try {
    const parsed = parseISO(date);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

interface DashboardProps {
  equipment: Equipment[];
  estimates: Estimate[];
  customers: Customer[];
  staff?: Staff[];
  goals?: Goal[];
  onTabChange: (tab: string) => void;
  onOpenEstimate?: (estimate: Estimate) => void;
  availableTabs?: string[];
  checkAccess?: (tab: string) => boolean;
}

export function Dashboard({ 
  equipment, 
  estimates, 
  customers, 
  staff, 
  goals,
  onTabChange,
  onOpenEstimate,
  availableTabs = [],
  checkAccess
}: DashboardProps) {
  // Функция проверки доступа к вкладке
  const hasAccess = (tab: string): boolean => {
    if (checkAccess) return checkAccess(tab);
    if (availableTabs.length > 0) return availableTabs.includes(tab);
    return true; // Если ничего не передано — показываем всё
  };
  // Текущая дата для автообновления задач
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Обновляем дату каждую минуту (для смены суток)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      // Обновляем только если день изменился
      if (now.getDate() !== currentDate.getDate()) {
        setCurrentDate(now);
      }
    }, 60000); // каждую минуту
    
    return () => clearInterval(interval);
  }, [currentDate]);
  
  // Статистика
  const stats = useMemo(() => ({
    totalEquipment: equipment.length,
    totalEstimates: estimates.length,
    totalCustomers: customers.length,
    totalStaff: staff?.length || 0,
    activeGoals: goals?.filter(g => !g.completed).length || 0,
  }), [equipment, estimates, customers, staff, goals]);

  // Ближайшие мероприятия
  const upcomingEvents = useMemo(() => {
    return estimates
      .filter(e => {
        const date = safeParseISO(e.event_start_date || e.event_date);
        if (!date) return false;
        return !isPast(date) || isToday(date);
      })
      .sort((a, b) => {
        const dateA = safeParseISO(a.event_start_date || a.event_date);
        const dateB = safeParseISO(b.event_start_date || b.event_date);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 5);
  }, [estimates]);

  // Мероприятия сегодня
  const todayEvents = useMemo(() => {
    return estimates.filter(e => {
      const date = safeParseISO(e.event_start_date || e.event_date);
      return date ? isToday(date) : false;
    });
  }, [estimates]);

  // Низкий запас оборудования (меньше 3 шт)
  const lowStockItems = useMemo(() => {
    return equipment
      .filter(item => item.quantity < 3 && item.quantity > 0)
      .slice(0, 5);
  }, [equipment]);

  // Все активные задачи (не только на сегодня)
  const activeTasks = useMemo(() => {
    return goals?.filter(g => {
      const isActive = g.status !== 'completed' && g.status !== 'cancelled';
      return isActive;
    }).slice(0, 10) || [];
  }, [goals]);

  // Задачи на сегодня (активные - не выполнены и не отменены)
  const todayTasks = useMemo(() => {
    // Используем format для локальной даты (не UTC!)
    const today = format(currentDate, 'yyyy-MM-dd');
    return goals?.filter(g => {
      const isToday = g.due_date === today;
      const isActive = g.status !== 'completed' && g.status !== 'cancelled';
      return isToday && isActive;
    }).slice(0, 5) || [];
  }, [goals, currentDate]);

  return (
    <div className="space-y-6">
      {/* Приветствие */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
          <p className="text-gray-500">Обзор вашего бизнеса</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600">
            {format(currentDate, 'd MMMM', { locale: ru })}
          </p>
          <p className="text-gray-500">{format(currentDate, 'EEEE', { locale: ru })}</p>
        </div>
      </div>

      {/* Статистика — только для доступных вкладок */}
      <div className={`grid gap-4 ${
        [hasAccess('equipment'), hasAccess('estimates'), hasAccess('customers'), hasAccess('calendar')].filter(Boolean).length === 4 
          ? 'grid-cols-2 md:grid-cols-4' 
          : [hasAccess('equipment'), hasAccess('estimates'), hasAccess('customers'), hasAccess('calendar')].filter(Boolean).length === 3 
            ? 'grid-cols-2 md:grid-cols-3'
            : 'grid-cols-2'
      }`}>
        {hasAccess('equipment') && (
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 cursor-pointer" onClick={() => onTabChange('equipment')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Оборудование</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalEquipment}</p>
                </div>
                <Package className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        )}

        {hasAccess('estimates') && (
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 cursor-pointer" onClick={() => onTabChange('estimates')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Сметы</p>
                  <p className="text-2xl font-bold text-green-900">{stats.totalEstimates}</p>
                </div>
                <FileText className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        )}

        {hasAccess('customers') && (
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 cursor-pointer" onClick={() => onTabChange('customers')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Клиенты</p>
                  <p className="text-2xl font-bold text-purple-900">{stats.totalCustomers}</p>
                </div>
                <Users className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        )}

        {hasAccess('calendar') && (
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 cursor-pointer" onClick={() => onTabChange('calendar')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">Сегодня мероприятий</p>
                  <p className="text-2xl font-bold text-orange-900">{todayEvents.length}</p>
                </div>
                <CalendarDays className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Основной контент */}
      <div className={`grid gap-6 ${hasAccess('estimates') || hasAccess('goals') ? 'md:grid-cols-3' : 'md:grid-cols-1'}`}>
        {/* Центральная часть — Текущие задачи */}
        {hasAccess('goals') && (
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
              <Target className="w-5 h-5" />
              Текущие задачи
              {activeTasks.length > 0 && (
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-sm">
                  {activeTasks.length}
                </span>
              )}
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onTabChange('goals')}
              className="text-blue-600"
            >
              Все <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {activeTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Нет активных задач</p>
                <p className="text-sm mt-1">Все задачи выполнены!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeTasks.map((task) => {
                  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
                  const isDueToday = task.due_date && isToday(parseISO(task.due_date));
                  
                  return (
                    <div 
                      key={task.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                        isOverdue ? 'bg-red-50 border-red-200' : 
                        isDueToday ? 'bg-blue-50 border-blue-200' : 
                        'bg-gray-50 border-gray-200'
                      }`}
                      onClick={() => onTabChange('goals')}
                    >
                      <Circle className={`w-5 h-5 mt-0.5 shrink-0 ${
                        task.priority === 'urgent' ? 'text-red-500 fill-red-500' :
                        task.priority === 'high' ? 'text-orange-500' :
                        task.priority === 'medium' ? 'text-blue-500' : 'text-gray-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{task.title}</p>
                        {task.description && (
                          <p className="text-sm text-gray-500 truncate">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            TASK_PRIORITIES.find(p => p.value === task.priority)?.color || 'bg-gray-100'
                          }`}>
                            {TASK_PRIORITIES.find(p => p.value === task.priority)?.label}
                          </span>
                          {task.category && (
                            <span className="text-xs text-gray-500">
                              {TASK_CATEGORIES.find(c => c.value === task.category)?.label}
                            </span>
                          )}
                          {task.due_date && (
                            <span className={`text-xs ${
                              isOverdue ? 'text-red-600 font-medium' :
                              isDueToday ? 'text-blue-600 font-medium' : 'text-gray-500'
                            }`}>
                              {isDueToday ? 'Сегодня' : 
                               isTomorrow(parseISO(task.due_date)) ? 'Завтра' :
                               format(parseISO(task.due_date), 'd MMM', { locale: ru })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Правая колонка — Ближайшие мероприятия и быстрые действия */}
        {(hasAccess('estimates') || hasAccess('goals')) && (
        <div className="space-y-6">
          {/* Ближайшие мероприятия — в правой колонке */}
          {hasAccess('estimates') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-600" />
                Ближайшие
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onTabChange('calendar')}
                className="text-blue-600"
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-4 text-gray-400">
                  <p className="text-sm">Нет мероприятий</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.slice(0, 5).map((event) => {
                    const date = parseISO(event.event_start_date || event.event_date);
                    const isTodayEvent = isToday(date);
                    const isTomorrowEvent = isTomorrow(date);
                    
                    return (
                      <div 
                        key={event.id} 
                        className={`p-2 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${
                          isTodayEvent ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
                        }`}
                        onClick={() => onOpenEstimate?.(event)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{event.event_name}</p>
                            <p className="text-xs text-gray-500">{event.venue || 'Без площадки'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {isTodayEvent && (
                                <span className="text-xs px-1.5 py-0.5 bg-orange-500 text-white rounded">
                                  Сегодня
                                </span>
                              )}
                              {isTomorrowEvent && (
                                <span className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded">
                                  Завтра
                                </span>
                              )}
                              <span className="text-xs text-gray-600">
                                {format(date, 'd MMM', { locale: ru })}
                              </span>
                            </div>
                          </div>
                          <p className="font-bold text-sm text-blue-600 ml-2">
                            {event.total.toLocaleString('ru-RU')} ₽
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Быстрые действия */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Быстрые действия</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {hasAccess('estimates') && (
              <Button 
                className="w-full justify-start"
                onClick={() => onTabChange('estimates')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Новая смета
              </Button>
              )}
              {hasAccess('equipment') && (
              <Button 
                variant="outline"
                className="w-full justify-start"
                onClick={() => onTabChange('equipment')}
              >
                <Package className="w-4 h-4 mr-2" />
                Добавить оборудование
              </Button>
              )}
              {hasAccess('customers') && (
              <Button 
                variant="outline"
                className="w-full justify-start"
                onClick={() => onTabChange('customers')}
              >
                <Users className="w-4 h-4 mr-2" />
                Новый клиент
              </Button>
              )}
            </CardContent>
          </Card>
        </div>
        )}
      </div>
    </div>
  );
}
