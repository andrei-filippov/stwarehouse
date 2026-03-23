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

  // Функция для получения класса цвета события
  const getEventColorClass = (color?: string, isMultiDay: boolean = false) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-gradient-to-r from-blue-500 to-indigo-500',
      green: 'bg-gradient-to-r from-green-500 to-emerald-500',
      red: 'bg-gradient-to-r from-red-500 to-rose-500',
      purple: 'bg-gradient-to-r from-purple-500 to-violet-500',
      orange: 'bg-gradient-to-r from-orange-500 to-amber-500',
      pink: 'bg-gradient-to-r from-pink-500 to-rose-400',
      cyan: 'bg-gradient-to-r from-cyan-500 to-blue-400',
      amber: 'bg-gradient-to-r from-amber-400 to-yellow-300',
    };
    
    // Если цвет не указан или не найден, используем дефолтный
    const baseColor = colorMap[color || 'blue'] || colorMap.blue;
    return baseColor;
  };

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
          "min-h-[60px] sm:min-h-[100px] p-1 sm:p-2 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all duration-200 relative group",
          isCurrentMonth 
            ? "bg-card border-border hover:border-primary/50 hover:shadow-lg" 
            : "bg-muted/50 border-border text-muted-foreground/70",
          isToday && "ring-2 ring-blue-500 ring-offset-1 sm:ring-offset-2",
          hasEvents && isCurrentMonth && "bg-gradient-to-br from-primary/10 to-background"
        )}
      >
        <div className={cn(
          "font-semibold text-xs sm:text-sm mb-0.5 sm:mb-1 w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-full",
          isToday ? "bg-blue-600 text-white" : "text-foreground",
          !isCurrentMonth && "text-muted-foreground/70"
        )}>
          {format(day, 'd')}
        </div>
        
        {/* На мобильном показываем только точки-индикаторы */}
        <div className="sm:hidden">
          {hasEvents && (
            <div className="flex flex-wrap gap-0.5 mt-1">
              {dayEstimates.slice(0, 3).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              ))}
              {dayEstimates.length > 3 && (
                <span className="text-[8px] text-muted-foreground/70">+</span>
              )}
            </div>
          )}
        </div>
        
        {/* На десктопе показываем названия событий */}
        <div className="hidden sm:block">
          {hasEvents && (
            <div className="space-y-1">
              {dayEstimates.slice(0, 2).map((estimate, i) => {
                const isMultiDay = (estimate.event_start_date || estimate.event_date) !== (estimate.event_end_date || estimate.event_date);
                
                return (
                  <div
                    key={i}
                    className={cn(
                      "text-xs px-2 py-1 rounded-lg font-medium truncate shadow-sm text-white",
                      getEventColorClass(estimate.color, isMultiDay)
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
      </div>
    );
  };

  // Рендер недельного вида
  const renderWeekView = () => {
    return (
      <div className="space-y-4">
        {/* На мобильном - горизонтальный скролл */}
        <div className="sm:hidden overflow-x-auto pb-2 -mx-2 px-2">
          <div className="flex gap-2 min-w-max">
            {days.map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayEstimates = estimatesByDate.get(dateStr) || [];
              const isToday = isDateToday(day);
              
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "w-[140px] min-h-[300px] p-2 rounded-xl border-2 cursor-pointer transition-all flex-shrink-0",
                    "bg-card border-border hover:border-primary/50 hover:shadow-lg",
                    isToday && "ring-2 ring-blue-500 ring-offset-1 bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "text-center pb-2 mb-2 border-b",
                    isToday ? "border-blue-500" : "border-gray-100"
                  )}>
                    <div className="text-[10px] text-muted-foreground uppercase font-medium">{weekDays[idx]}</div>
                    <div className={cn(
                      "text-xl font-bold mt-1",
                      isToday ? "text-blue-600" : "text-foreground"
                    )}>
                      {format(day, 'd')}
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    {dayEstimates.map((estimate, i) => (
                      <div
                        key={i}
                        className={cn(
                          "p-1.5 rounded-lg text-white text-xs shadow-md",
                          getEventColorClass(estimate.color)
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEstimate(estimate);
                        }}
                      >
                        <div className="font-medium truncate">{estimate.event_name}</div>
                        <div className="text-[10px] opacity-90 flex items-center gap-0.5 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          <span className="truncate">{estimate.venue || 'Без площадки'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* На десктопе - сетка */}
        <div className="hidden sm:grid grid-cols-7 gap-2">
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
                  "bg-card border-border hover:border-primary/50 hover:shadow-lg",
                  isToday && "ring-2 ring-blue-500 ring-offset-2 bg-muted/30"
                )}
              >
                <div className={cn(
                  "text-center pb-2 mb-2 border-b",
                  isToday ? "border-blue-500" : "border-gray-100"
                )}>
                  <div className="text-xs text-muted-foreground uppercase font-medium">{weekDays[idx]}</div>
                  <div className={cn(
                    "text-2xl font-bold mt-1",
                    isToday ? "text-blue-600" : "text-foreground"
                  )}>
                    {format(day, 'd')}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {dayEstimates.map((estimate, i) => (
                    <div
                      key={i}
                      className={cn(
                        "p-2 rounded-lg text-white text-sm shadow-md hover:shadow-lg transition-shadow",
                        getEventColorClass(estimate.color)
                      )}
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
      <div className="space-y-4 sm:space-y-6">
        <div className={cn(
          "p-3 sm:p-6 rounded-xl sm:rounded-2xl border-2",
          isToday 
            ? "bg-gradient-to-br from-primary/10 via-background to-primary/5 border-primary/30" 
            : "bg-card border-border"
        )}>
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-3xl font-bold text-foreground truncate">
                {format(day, 'EEEE', { locale: ru })}
              </h2>
              <p className={cn(
                "text-sm sm:text-lg mt-1",
                isToday ? "text-blue-600 font-medium" : "text-muted-foreground"
              )}>
                {format(day, 'd MMMM yyyy', { locale: ru })}
                {isToday && <Badge className="ml-2 bg-blue-600 text-xs">Сегодня</Badge>}
              </p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <div className="text-3xl sm:text-5xl font-bold text-foreground">{format(day, 'd')}</div>
              <div className="text-sm sm:text-lg text-muted-foreground">{format(day, 'MMM', { locale: ru })}</div>
            </div>
          </div>

          {dayEstimates.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-muted-foreground/70">
              <CalendarIcon className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-30" />
              <p className="text-base sm:text-lg">Нет мероприятий на этот день</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {dayEstimates.map((estimate, i) => (
                <Card 
                  key={i} 
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedEstimate(estimate)}
                >
                  <div className="flex">
                    <div className={cn("w-1.5 sm:w-2", getEventColorClass(estimate.color))} />
                    <CardContent className="flex-1 p-3 sm:p-4">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-xl font-bold text-foreground mb-1 sm:mb-2 truncate">{estimate.event_name}</h3>
                          <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                              <span className="truncate">{estimate.venue || 'Площадка не указана'}</span>
                            </span>
                            {estimate.creator_name && (
                              <span className="flex items-center gap-1 hidden sm:flex">
                                <User className="w-4 h-4 text-muted-foreground" />
                                {estimate.creator_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            {estimate.items?.length || 0} поз.
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
        <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg sm:rounded-xl shadow-lg">
                <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg sm:text-2xl truncate">Календарь мероприятий</CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">Управление событиями и бронированием</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              {/* Переключатель видов */}
              <ToggleGroup 
                type="single" 
                value={view} 
                onValueChange={(v) => v && setView(v as CalendarView)}
                className="bg-muted p-0.5 sm:p-1 rounded-lg"
              >
                <ToggleGroupItem value="month" aria-label="Месяц" className="gap-1 h-8 w-8 sm:h-9 sm:w-auto sm:px-3 p-0">
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">Месяц</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="week" aria-label="Неделя" className="gap-1 h-8 w-8 sm:h-9 sm:w-auto sm:px-3 p-0">
                  <Columns3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Неделя</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="day" aria-label="День" className="gap-1 h-8 w-8 sm:h-9 sm:w-auto sm:px-3 p-0">
                  <Square className="w-4 h-4" />
                  <span className="hidden sm:inline">День</span>
                </ToggleGroupItem>
              </ToggleGroup>

              {/* Навигация */}
              <div className="flex items-center gap-0.5 sm:gap-1 bg-muted p-0.5 sm:p-1 rounded-lg">
                <Button variant="ghost" size="icon" onClick={navigatePrev} className="h-8 w-8 sm:h-9 sm:w-9">
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={navigateToday}
                  className="font-semibold min-w-[100px] sm:min-w-[120px] px-2 sm:px-3 h-8 sm:h-9 text-xs sm:text-sm"
                >
                  {headerTitle}
                </Button>
                <Button variant="ghost" size="icon" onClick={navigateNext} className="h-8 w-8 sm:h-9 sm:w-9">
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {view === 'month' && (
            <>
              {/* Заголовки дней недели */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1 sm:mb-3">
                {weekDays.map(day => (
                  <div key={day} className="text-center font-semibold text-[10px] sm:text-sm py-1 sm:py-3 text-muted-foreground uppercase tracking-wider">
                    <span className="sm:hidden">{day.charAt(0)}</span>
                    <span className="hidden sm:inline">{day}</span>
                  </div>
                ))}
              </div>

              {/* Сетка дней */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
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
        <DialogContent className="max-w-2xl w-[95%] max-h-[85vh] overflow-auto rounded-xl p-4 sm:p-6" aria-describedby="day-details-desc">
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
                <div className="text-center py-8 text-muted-foreground/70 bg-muted rounded-xl">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Нет смет на этот день</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateEstimates.map(estimate => {
                    const colorClasses: Record<string, string> = {
                      blue: 'border-l-blue-500',
                      green: 'border-l-green-500',
                      red: 'border-l-red-500',
                      purple: 'border-l-purple-500',
                      orange: 'border-l-orange-500',
                      pink: 'border-l-pink-500',
                      cyan: 'border-l-cyan-500',
                      amber: 'border-l-amber-500',
                    };
                    return (
                    <Card
                      key={estimate.id}
                      className={cn(
                        "cursor-pointer hover:shadow-md transition-shadow border-l-4",
                        colorClasses[estimate.color || 'blue'] || 'border-l-blue-500'
                      )}
                      onClick={() => setSelectedEstimate(estimate)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-lg truncate">{estimate.event_name}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="w-4 h-4" />
                              {estimate.venue || 'Площадка не указана'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                              <span className="flex items-center gap-1">
                                📅 {new Date(estimate.event_start_date || estimate.event_date).toLocaleDateString('ru-RU')}
                                {(estimate.event_end_date || estimate.event_date) !== (estimate.event_start_date || estimate.event_date) && 
                                  ` — ${new Date(estimate.event_end_date || estimate.event_date).toLocaleDateString('ru-RU')}`}
                              </span>
                            </p>
                            {estimate.creator_name && (
                              <p className="text-xs text-primary mt-2 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {estimate.creator_name}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-xs text-muted-foreground">
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
                  )})}
                </div>
              )}
            </div>

            {/* Занятость оборудования */}
            {selectedDate && selectedDateEstimates.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 sm:mb-3 flex items-center gap-2 text-base sm:text-lg">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                  Занятость оборудования
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 sm:max-h-60 overflow-auto">
                  {getEquipmentAvailability(selectedDate)
                    .filter(eq => eq.occupied > 0)
                    .map(eq => (
                      <div
                        key={eq.id}
                        className={cn(
                          "p-2 sm:p-3 rounded-lg text-xs sm:text-sm border",
                          eq.isFullyBooked
                            ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
                            : eq.available < eq.quantity * 0.2
                            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
                            : 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400'
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
        <DialogContent className="max-w-2xl w-[95%] max-h-[85vh] overflow-auto rounded-xl p-4 sm:p-6" aria-describedby="estimate-details-desc">
          <DialogHeader>
            <DialogTitle className="text-xl">{selectedEstimate?.event_name}</DialogTitle>
            <DialogDescription id="estimate-details-desc">
              Детальная информация о смете мероприятия
            </DialogDescription>
          </DialogHeader>
          {selectedEstimate && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm bg-muted p-3 sm:p-4 rounded-xl">
                <div>
                  <p className="text-muted-foreground mb-1">Площадка</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {selectedEstimate.venue || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Период</p>
                  <p className="font-medium">
                    {new Date(selectedEstimate.event_start_date || selectedEstimate.event_date).toLocaleDateString('ru-RU')}
                    {(selectedEstimate.event_end_date || selectedEstimate.event_date) !== (selectedEstimate.event_start_date || selectedEstimate.event_date) && 
                      ` — ${new Date(selectedEstimate.event_end_date || selectedEstimate.event_date).toLocaleDateString('ru-RU')}`}
                  </p>
                </div>

                {selectedEstimate.creator_name && (
                  <div>
                    <p className="text-muted-foreground mb-1">Составитель</p>
                    <p className="font-medium flex items-center gap-1">
                      <User className="w-4 h-4 text-muted-foreground" />
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
                    <div key={idx} className="flex justify-between text-sm p-3 bg-muted rounded-lg">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground">
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

export default EventCalendar;

