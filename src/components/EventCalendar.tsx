import { useState, useMemo, useCallback, memo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Package, 
  FileText, 
  CalendarPlus, 
  Clock,
  MapPin,
  User,
  LayoutGrid,
  Columns3,
  Square
} from 'lucide-react';
import type { Estimate, Equipment } from '../types';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  isToday as isDateToday,
  getHours,
  setHours,
  setMinutes
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { Badge } from './ui/badge';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

type CalendarView = 'month' | 'week' | 'day';

interface EventCalendarProps {
  estimates: Estimate[];
  equipment: Equipment[];
}

export const EventCalendar = memo(function EventCalendar({ estimates, equipment }: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);

  // Навигация
  const navigatePrev = useCallback(() => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  }, [currentDate, view]);

  const navigateNext = useCallback(() => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  }, [currentDate, view]);

  const navigateToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Получаем дни для отображения в зависимости от вида
  const days = useMemo(() => {
    if (view === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } else if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      return [currentDate];
    }
  }, [currentDate, view]);

  // Заголовок в зависимости от вида
  const headerTitle = useMemo(() => {
    if (view === 'month') {
      return format(currentDate, 'LLLL yyyy', { locale: ru });
    } else if (view === 'week') {
      const start = days[0];
      const end = days[days.length - 1];
      return `${format(start, 'd MMM', { locale: ru })} — ${format(end, 'd MMM yyyy', { locale: ru })}`;
    } else {
      return format(currentDate, 'd MMMM yyyy', { locale: ru });
    }
  }, [currentDate, view, days]);

  // Функция для генерации ссылки Google Calendar
  const generateGoogleCalendarUrl = useCallback((estimate: Estimate) => {
    const title = encodeURIComponent(estimate.event_name);
    const location = encodeURIComponent(estimate.venue || '');
    
    let equipmentList = '';
    if (estimate.items && estimate.items.length > 0) {
      equipmentList = '\n\nОборудование:\n' + estimate.items.map(item => 
        `• ${item.name} - ${item.quantity} ${item.unit || 'шт'}`
      ).join('\n');
    }
    
    const creator = estimate.creator_name ? `\n\nСоставитель: ${estimate.creator_name}` : '';
    
    const details = encodeURIComponent(
      `Смета на мероприятие: ${estimate.event_name}${equipmentList}${creator}`
    );
    
    const startDate = (estimate.event_start_date || estimate.event_date)?.replace(/-/g, '');
    const endDate = (estimate.event_end_date || estimate.event_date)?.replace(/-/g, '');
    
    let adjustedEndDate = endDate;
    if (endDate) {
      const end = new Date(estimate.event_end_date || estimate.event_date || '');
      end.setDate(end.getDate() + 1);
      adjustedEndDate = format(end, 'yyyyMMdd');
    }
    
    const dates = startDate && adjustedEndDate ? `${startDate}/${adjustedEndDate}` : '';
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  }, []);

  // Проверка пересечения дат
  const isDateInRange = useCallback((date: Date, startDate: string, endDate?: string) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate || startDate);
    end.setHours(0, 0, 0, 0);
    return d >= start && d <= end;
  }, []);

  // Группируем сметы по датам
  const estimatesByDate = useMemo(() => {
    const map = new Map<string, Estimate[]>();
    
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayEstimates: Estimate[] = [];
      
      estimates.forEach(estimate => {
        if (!estimate.event_date) return;
        
        const startDate = estimate.event_start_date || estimate.event_date;
        const endDate = estimate.event_end_date || estimate.event_date;
        
        if (isDateInRange(day, startDate, endDate)) {
          dayEstimates.push(estimate);
        }
      });
      
      if (dayEstimates.length > 0) {
        map.set(dateStr, dayEstimates);
      }
    });
    
    return map;
  }, [estimates, days, isDateInRange]);

  // Получаем уникальные мероприятия за период (для статистики)
  const periodEstimates = useMemo(() => {
    const uniqueIds = new Set<string>();
    const uniqueEstimates: Estimate[] = [];
    
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayEstimates = estimatesByDate.get(dateStr) || [];
      
      dayEstimates.forEach(estimate => {
        if (!uniqueIds.has(estimate.id)) {
          uniqueIds.add(estimate.id);
          uniqueEstimates.push(estimate);
        }
      });
    });
    
    return uniqueEstimates;
  }, [days, estimatesByDate]);

  // Получаем сметы для выбранной даты
  const selectedDateEstimates = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return estimatesByDate.get(dateStr) || [];
  }, [selectedDate, estimatesByDate]);

  const getEventPosition = useCallback((estimate: Estimate, date: Date): 'start' | 'middle' | 'end' | 'single' => {
    const start = estimate.event_start_date || estimate.event_date;
    const end = estimate.event_end_date || estimate.event_date;
    const d = format(date, 'yyyy-MM-dd');
    
    if (start === end) return 'single';
    if (d === start) return 'start';
    if (d === end) return 'end';
    return 'middle';
  }, []);

  const getEquipmentAvailability = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayEstimates = estimatesByDate.get(dateStr) || [];
    
    const occupiedEquipment = new Map<string, number>();
    
    dayEstimates.forEach(estimate => {
      estimate.items?.forEach(item => {
        const currentQty = occupiedEquipment.get(item.equipment_id) || 0;
        occupiedEquipment.set(item.equipment_id, currentQty + item.quantity);
      });
    });

    return equipment.map(eq => {
      const occupied = occupiedEquipment.get(eq.id) || 0;
      const available = eq.quantity - occupied;
      return {
        ...eq,
        occupied,
        available: Math.max(0, available),
        isFullyBooked: available <= 0
      };
    });
  }, [estimatesByDate, equipment]);

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  // Рендер ячейки дня для месяца
  const renderMonthDay = (day: Date, idx: number) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayEstimates = estimatesByDate.get(dateStr) || [];
    const hasEvents = dayEstimates.length > 0;
    const isCurrentMonth = isSameMonth(day, currentDate);
    const isToday = isDateToday(day);

    return (
      <div
        key={idx}
        onClick={() => {
          setSelectedDate(day);
          if (view === 'day') return;
          setView('day');
          setCurrentDate(day);
        }}
        className={cn(
          "min-h-[100px] p-2 rounded-xl border-2 cursor-pointer transition-all duration-200 relative group",
          isCurrentMonth 
            ? "bg-white border-gray-100 hover:border-blue-300 hover:shadow-lg" 
            : "bg-gray-50/50 border-gray-100 text-gray-400",
          isToday && "ring-2 ring-blue-500 ring-offset-2",
          hasEvents && isCurrentMonth && "bg-gradient-to-br from-blue-50/50 to-white"
        )}
      >
        <div className={cn(
          "font-semibold text-sm mb-1 w-7 h-7 flex items-center justify-center rounded-full",
          isToday ? "bg-blue-600 text-white" : "text-gray-700",
          !isCurrentMonth && "text-gray-400"
        )}>
          {format(day, 'd')}
        </div>
        
        {hasEvents && (
          <div className="space-y-1">
            {dayEstimates.slice(0, 2).map((estimate, i) => {
              const isMultiDay = (estimate.event_start_date || estimate.event_date) !== (estimate.event_end_date || estimate.event_date);
              
              return (
                <div
                  key={i}
                  className={cn(
                    "text-xs px-2 py-1 rounded-lg font-medium truncate shadow-sm",
                    isMultiDay 
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white" 
                      : "bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                  )}
                  title={estimate.event_name}
                >
                  {estimate.event_name}
                </div>
              );
            })}
            {dayEstimates.length > 2 && (
              <Badge variant="secondary" className="text-xs w-full justify-center">
                +{dayEstimates.length - 2} ещё
              </Badge>
            )}
          </div>
        )}
        
        {/* Индикатор наличия событий */}
        {hasEvents && dayEstimates.length <= 2 && (
          <div className="absolute bottom-2 right-2 flex gap-0.5">
            {dayEstimates.map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Рендер недельного вида
  const renderWeekView = () => {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, idx) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayEstimates = estimatesByDate.get(dateStr) || [];
            const isToday = isDateToday(day);
            
            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "min-h-[400px] p-3 rounded-xl border-2 cursor-pointer transition-all",
                  "bg-white border-gray-100 hover:border-blue-300 hover:shadow-lg",
                  isToday && "ring-2 ring-blue-500 ring-offset-2 bg-blue-50/30"
                )}
              >
                <div className={cn(
                  "text-center pb-2 mb-2 border-b",
                  isToday ? "border-blue-500" : "border-gray-100"
                )}>
                  <div className="text-xs text-gray-500 uppercase font-medium">{weekDays[idx]}</div>
                  <div className={cn(
                    "text-2xl font-bold mt-1",
                    isToday ? "text-blue-600" : "text-gray-800"
                  )}>
                    {format(day, 'd')}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {dayEstimates.map((estimate, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm shadow-md hover:shadow-lg transition-shadow"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEstimate(estimate);
                      }}
                    >
                      <div className="font-medium truncate">{estimate.event_name}</div>
                      <div className="text-xs opacity-90 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {estimate.venue || 'Без площадки'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Рендер дневного вида
  const renderDayView = () => {
    const day = days[0];
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayEstimates = estimatesByDate.get(dateStr) || [];
    const isToday = isDateToday(day);

    return (
      <div className="space-y-6">
        <div className={cn(
          "p-6 rounded-2xl border-2",
          isToday 
            ? "bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-blue-300" 
            : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-800">
                {format(day, 'EEEE', { locale: ru })}
              </h2>
              <p className={cn(
                "text-lg mt-1",
                isToday ? "text-blue-600 font-medium" : "text-gray-500"
              )}>
                {format(day, 'd MMMM yyyy', { locale: ru })}
                {isToday && <Badge className="ml-2 bg-blue-600">Сегодня</Badge>}
              </p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold text-gray-800">{format(day, 'd')}</div>
              <div className="text-lg text-gray-500">{format(day, 'MMM', { locale: ru })}</div>
            </div>
          </div>

          {dayEstimates.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CalendarIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">Нет мероприятий на этот день</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {dayEstimates.map((estimate, i) => (
                <Card 
                  key={i} 
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedEstimate(estimate)}
                >
                  <div className="flex">
                    <div className="w-2 bg-gradient-to-b from-blue-500 to-indigo-500" />
                    <CardContent className="flex-1 p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-800 mb-2">{estimate.event_name}</h3>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              {estimate.venue || 'Площадка не указана'}
                            </span>
                            {estimate.creator_name && (
                              <span className="flex items-center gap-1">
                                <User className="w-4 h-4 text-gray-400" />
                                {estimate.creator_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">
                            {estimate.items?.length || 0} позиций
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Шапка с навигацией */}
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <CalendarIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">Календарь мероприятий</CardTitle>
                <p className="text-sm text-gray-500 mt-0.5">Управление событиями и бронированием</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Переключатель видов */}
              <ToggleGroup 
                type="single" 
                value={view} 
                onValueChange={(v) => v && setView(v as CalendarView)}
                className="bg-gray-100 p-1 rounded-lg"
              >
                <ToggleGroupItem value="month" aria-label="Месяц" className="gap-1.5">
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">Месяц</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="week" aria-label="Неделя" className="gap-1.5">
                  <Columns3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Неделя</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="day" aria-label="День" className="gap-1.5">
                  <Square className="w-4 h-4" />
                  <span className="hidden sm:inline">День</span>
                </ToggleGroupItem>
              </ToggleGroup>

              {/* Навигация */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                <Button variant="ghost" size="icon" onClick={navigatePrev} className="h-9 w-9">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={navigateToday}
                  className="font-semibold min-w-[120px] px-3"
                >
                  {headerTitle}
                </Button>
                <Button variant="ghost" size="icon" onClick={navigateNext} className="h-9 w-9">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {view === 'month' && (
            <>
              {/* Заголовки дней недели */}
              <div className="grid grid-cols-7 gap-2 mb-3">
                {weekDays.map(day => (
                  <div key={day} className="text-center font-semibold text-sm py-3 text-gray-500 uppercase tracking-wider">
                    {day}
                  </div>
                ))}
              </div>

              {/* Сетка дней */}
              <div className="grid grid-cols-7 gap-2">
                {days.map((day, idx) => renderMonthDay(day, idx))}
              </div>
            </>
          )}

          {view === 'week' && renderWeekView()}
          {view === 'day' && renderDayView()}
        </CardContent>
      </Card>



      {/* Диалог с деталями дня */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto" aria-describedby="day-details-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CalendarIcon className="w-5 h-5 text-blue-500" />
              {selectedDate && format(selectedDate, 'd MMMM yyyy', { locale: ru })}
              {selectedDate && isDateToday(selectedDate) && (
                <Badge className="bg-blue-600">Сегодня</Badge>
              )}
            </DialogTitle>
            <DialogDescription id="day-details-desc">
              Сметы и занятость оборудования на выбранную дату
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Сметы на этот день */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-blue-500" />
                Сметы ({selectedDateEstimates.length})
              </h3>
              {selectedDateEstimates.length === 0 ? (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Нет смет на этот день</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateEstimates.map(estimate => (
                    <Card
                      key={estimate.id}
                      className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
                      onClick={() => setSelectedEstimate(estimate)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-lg truncate">{estimate.event_name}</p>
                            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                              <MapPin className="w-4 h-4" />
                              {estimate.venue || 'Площадка не указана'}
                            </p>
                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                              <span className="flex items-center gap-1">
                                📅 {new Date(estimate.event_start_date || estimate.event_date).toLocaleDateString('ru-RU')}
                                {(estimate.event_end_date || estimate.event_date) !== (estimate.event_start_date || estimate.event_date) && 
                                  ` — ${new Date(estimate.event_end_date || estimate.event_date).toLocaleDateString('ru-RU')}`}
                              </span>
                            </p>
                            {estimate.creator_name && (
                              <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {estimate.creator_name}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-xs text-gray-500">
                              {estimate.items?.length || 0} позиций
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t flex justify-end">
                          <a
                            href={generateGoogleCalendarUrl(estimate)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="outline" size="sm">
                              <CalendarPlus className="w-4 h-4 mr-2" />
                              В Google Calendar
                            </Button>
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Занятость оборудования */}
            {selectedDate && selectedDateEstimates.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-lg">
                  <Package className="w-5 h-5 text-purple-500" />
                  Занятость оборудования
                </h3>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-auto">
                  {getEquipmentAvailability(selectedDate)
                    .filter(eq => eq.occupied > 0)
                    .map(eq => (
                      <div
                        key={eq.id}
                        className={cn(
                          "p-3 rounded-lg text-sm border",
                          eq.isFullyBooked
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : eq.available < eq.quantity * 0.2
                            ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                            : 'bg-green-50 border-green-200 text-green-800'
                        )}
                      >
                        <p className="font-semibold truncate">{eq.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            eq.isFullyBooked ? "bg-red-500" : eq.available < eq.quantity * 0.2 ? "bg-yellow-500" : "bg-green-500"
                          )} />
                          <p className="text-xs">
                            Занято: {eq.occupied} / {eq.quantity}
                            {eq.isFullyBooked && ' (всё)'}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог с деталями сметы */}
      <Dialog open={!!selectedEstimate} onOpenChange={() => setSelectedEstimate(null)}>
        <DialogContent className="max-w-3xl" aria-describedby="estimate-details-desc">
          <DialogHeader>
            <DialogTitle className="text-xl">{selectedEstimate?.event_name}</DialogTitle>
            <DialogDescription id="estimate-details-desc">
              Детальная информация о смете мероприятия
            </DialogDescription>
          </DialogHeader>
          {selectedEstimate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-xl">
                <div>
                  <p className="text-gray-500 mb-1">Площадка</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {selectedEstimate.venue || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Период</p>
                  <p className="font-medium">
                    {new Date(selectedEstimate.event_start_date || selectedEstimate.event_date).toLocaleDateString('ru-RU')}
                    {(selectedEstimate.event_end_date || selectedEstimate.event_date) !== (selectedEstimate.event_start_date || selectedEstimate.event_date) && 
                      ` — ${new Date(selectedEstimate.event_end_date || selectedEstimate.event_date).toLocaleDateString('ru-RU')}`}
                  </p>
                </div>

                {selectedEstimate.creator_name && (
                  <div>
                    <p className="text-gray-500 mb-1">Составитель</p>
                    <p className="font-medium flex items-center gap-1">
                      <User className="w-4 h-4 text-gray-400" />
                      {selectedEstimate.creator_name}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Оборудование:
                </p>
                <div className="space-y-1 max-h-64 overflow-auto">
                  {selectedEstimate.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-gray-600">
                        {item.quantity} {item.unit || 'шт'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <a
                  href={generateGoogleCalendarUrl(selectedEstimate)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button>
                    <CalendarPlus className="w-4 h-4 mr-2" />
                    Добавить в Google Calendar
                  </Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});
