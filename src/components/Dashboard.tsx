import { useMemo } from 'react';
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
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface DashboardProps {
  equipment: Equipment[];
  estimates: Estimate[];
  customers: Customer[];
  staff?: Staff[];
  goals?: Goal[];
  onTabChange: (tab: string) => void;
  onOpenEstimate?: (estimate: Estimate) => void;
}

export function Dashboard({ 
  equipment, 
  estimates, 
  customers, 
  staff, 
  goals,
  onTabChange,
  onOpenEstimate 
}: DashboardProps) {
  
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
        const date = parseISO(e.event_start_date || e.event_date);
        return !isPast(date) || isToday(date);
      })
      .sort((a, b) => {
        const dateA = parseISO(a.event_start_date || a.event_date);
        const dateB = parseISO(b.event_start_date || b.event_date);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 5);
  }, [estimates]);

  // Мероприятия сегодня
  const todayEvents = useMemo(() => {
    return estimates.filter(e => {
      const date = parseISO(e.event_start_date || e.event_date);
      return isToday(date);
    });
  }, [estimates]);

  // Низкий запас оборудования (меньше 3 шт)
  const lowStockItems = useMemo(() => {
    return equipment
      .filter(item => item.quantity < 3 && item.quantity > 0)
      .slice(0, 5);
  }, [equipment]);

  // Недавние сметы
  const recentEstimates = useMemo(() => {
    return [...estimates]
      .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
      .slice(0, 3);
  }, [estimates]);

  // Задачи на сегодня (активные - не выполнены и не отменены)
  const todayTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return goals?.filter(g => {
      const isToday = g.due_date === today;
      const isActive = g.status !== 'completed' && g.status !== 'cancelled';
      return isToday && isActive;
    }).slice(0, 5) || [];
  }, [goals]);

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
            {format(new Date(), 'd MMMM', { locale: ru })}
          </p>
          <p className="text-gray-500">{format(new Date(), 'EEEE', { locale: ru })}</p>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
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

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
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

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
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

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
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
      </div>

      {/* Основной контент */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Ближайшие мероприятия */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              Ближайшие мероприятия
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onTabChange('calendar')}
              className="text-blue-600"
            >
              Все <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Нет предстоящих мероприятий</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => {
                  const date = parseISO(event.event_start_date || event.event_date);
                  const isTodayEvent = isToday(date);
                  const isTomorrowEvent = isTomorrow(date);
                  
                  return (
                    <div 
                      key={event.id} 
                      className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                        isTodayEvent ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
                      }`}
                      onClick={() => onOpenEstimate?.(event)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{event.event_name}</h3>
                            {isTodayEvent && (
                              <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                                Сегодня
                              </span>
                            )}
                            {isTomorrowEvent && (
                              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                Завтра
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{event.venue || 'Без площадки'}</p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                            <span>{format(date, 'd MMMM', { locale: ru })}</span>
                            <span>{event.items?.length || 0} позиций</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-blue-600">
                            {event.total.toLocaleString('ru-RU')} ₽
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Правая колонка */}
        <div className="space-y-6">
          {/* Задачи на сегодня */}
          {todayTasks.length > 0 && (
            <Card className="border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
                  <Target className="w-5 h-5" />
                  Задачи на сегодня
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-sm">
                    {todayTasks.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {todayTasks.map((task) => (
                    <div 
                      key={task.id}
                      className="flex items-start gap-2 p-2 bg-blue-50 rounded cursor-pointer hover:bg-blue-100 transition-colors"
                      onClick={() => onTabChange('goals')}
                    >
                      <Circle className={`w-4 h-4 mt-0.5 shrink-0 ${
                        task.priority === 'urgent' ? 'text-red-500' :
                        task.priority === 'high' ? 'text-orange-500' :
                        task.priority === 'medium' ? 'text-blue-500' : 'text-gray-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            TASK_PRIORITIES.find(p => p.value === task.priority)?.color || 'bg-gray-100'
                          }`}>
                            {TASK_PRIORITIES.find(p => p.value === task.priority)?.label}
                          </span>
                          {task.category && (
                            <span className="text-xs text-gray-500">
                              {TASK_CATEGORIES.find(c => c.value === task.category)?.icon}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full mt-2 text-blue-600"
                  onClick={() => onTabChange('goals')}
                >
                  Все задачи <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Недавние сметы */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-600" />
                Недавние сметы
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentEstimates.length === 0 ? (
                <p className="text-gray-400 text-sm">Нет смет</p>
              ) : (
                <div className="space-y-2">
                  {recentEstimates.map((estimate) => (
                    <div 
                      key={estimate.id}
                      className="p-2 rounded hover:bg-gray-50 cursor-pointer"
                      onClick={() => onOpenEstimate?.(estimate)}
                    >
                      <p className="font-medium text-sm truncate">{estimate.event_name}</p>
                      <p className="text-xs text-gray-500">
                        {estimate.total.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Быстрые действия */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Быстрые действия</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                className="w-full justify-start"
                onClick={() => onTabChange('estimates')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Новая смета
              </Button>
              <Button 
                variant="outline"
                className="w-full justify-start"
                onClick={() => onTabChange('equipment')}
              >
                <Package className="w-4 h-4 mr-2" />
                Добавить оборудование
              </Button>
              <Button 
                variant="outline"
                className="w-full justify-start"
                onClick={() => onTabChange('customers')}
              >
                <Users className="w-4 h-4 mr-2" />
                Новый клиент
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
