import { useState, useMemo, useCallback, memo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, FileText, CalendarPlus, ExternalLink } from 'lucide-react';
import type { Estimate, Equipment } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';

interface EventCalendarProps {
  estimates: Estimate[];
  equipment: Equipment[];
}

export const EventCalendar = memo(function EventCalendar({ estimates, equipment }: EventCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);

  // Функция для генерации ссылки Google Calendar
  const generateGoogleCalendarUrl = useCallback((estimate: Estimate) => {
    const title = encodeURIComponent(estimate.event_name);
    const location = encodeURIComponent(estimate.venue || '');
    
    // Формируем список оборудования
    let equipmentList = '';
    if (estimate.items && estimate.items.length > 0) {
      equipmentList = '\n\nОборудование:\n' + estimate.items.map(item => 
        `• ${item.name} - ${item.quantity} ${item.unit || 'шт'}`
      ).join('\n');
    }
    
    // Добавляем составителя
    const creator = estimate.creator_name ? `\n\nСоставитель: ${estimate.creator_name}` : '';
    
    const details = encodeURIComponent(
      `Смета на мероприятие: ${estimate.event_name}${equipmentList}${creator}`
    );
    
    // Даты в формате YYYYMMDD (целый день)
    const startDate = (estimate.event_start_date || estimate.event_date)?.replace(/-/g, '');
    const endDate = (estimate.event_end_date || estimate.event_date)?.replace(/-/g, '');
    
    // Для Google Calendar конечная дата должна быть на 1 день позже для событий "целый день"
    let adjustedEndDate = endDate;
    if (endDate) {
      const end = new Date(estimate.event_end_date || estimate.event_date || '');
      end.setDate(end.getDate() + 1);
      adjustedEndDate = format(end, 'yyyyMMdd');
    }
    
    const dates = startDate && adjustedEndDate ? `${startDate}/${adjustedEndDate}` : '';
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  }, []);

  // Получаем все дни месяца (включая дни соседних месяцев для полной сетки)
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

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

  // Группируем сметы по датам (включая многодневные мероприятия)
  const estimatesByDate = useMemo(() => {
    const map = new Map<string, Estimate[]>();
    
    // Для каждого дня в календаре находим все сметы, которые включают этот день
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

  // Получаем сметы для выбранной даты
  const selectedDateEstimates = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return estimatesByDate.get(dateStr) || [];
  }, [selectedDate, estimatesByDate]);
  
  // Проверяем, является ли дата началом, серединой или концом мероприятия
  const getEventPosition = useCallback((estimate: Estimate, date: Date): 'start' | 'middle' | 'end' | 'single' => {
    const start = estimate.event_start_date || estimate.event_date;
    const end = estimate.event_end_date || estimate.event_date;
    const d = format(date, 'yyyy-MM-dd');
    
    if (start === end) return 'single';
    if (d === start) return 'start';
    if (d === end) return 'end';
    return 'middle';
  }, []);

  // Проверка доступности оборудования на выбранную дату
  const getEquipmentAvailability = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayEstimates = estimatesByDate.get(dateStr) || [];
    
    // Собираем все занятое оборудование на эту дату
    const occupiedEquipment = new Map<string, number>();
    
    dayEstimates.forEach(estimate => {
      estimate.items?.forEach(item => {
        const currentQty = occupiedEquipment.get(item.equipment_id) || 0;
        occupiedEquipment.set(item.equipment_id, currentQty + item.quantity);
      });
    });

    // Проверяем каждое оборудование
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Календарь мероприятий
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-semibold min-w-[150px] text-center">
                {format(currentMonth, 'LLLL yyyy', { locale: ru })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Заголовки дней недели */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center font-semibold text-sm py-2 text-gray-600">
                {day}
              </div>
            ))}
          </div>

          {/* Сетка дней */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayEstimates = estimatesByDate.get(dateStr) || [];
              const hasEvents = dayEstimates.length > 0;
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    min-h-[100px] p-2 border rounded cursor-pointer transition-colors
                    ${isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'}
                    ${isToday ? 'ring-2 ring-blue-500' : ''}
                    ${hasEvents ? 'hover:bg-blue-50' : 'hover:bg-gray-50'}
                  `}
                >
                  <div className="font-medium text-sm mb-1">
                    {format(day, 'd')}
                  </div>
                  {hasEvents && (
                    <div className="space-y-1">
                      {dayEstimates.slice(0, 3).map((estimate, i) => {
                        const position = getEventPosition(estimate, day);
                        const isMultiDay = (estimate.event_start_date || estimate.event_date) !== (estimate.event_end_date || estimate.event_date);
                        
                        return (
                          <div
                            key={i}
                            className={`text-xs px-1 py-0.5 rounded truncate ${
                              isMultiDay 
                                ? position === 'start' 
                                  ? 'bg-green-100 text-green-800 rounded-r-none border-r-0'
                                  : position === 'end'
                                    ? 'bg-green-100 text-green-800 rounded-l-none border-l-0'
                                    : position === 'middle'
                                      ? 'bg-green-100 text-green-800 rounded-none border-x-0'
                                      : 'bg-blue-100 text-blue-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                            title={`${estimate.event_name}${isMultiDay ? ` (${position === 'start' ? 'начало' : position === 'end' ? 'окончание' : position === 'middle' ? 'продолжение' : ''})` : ''}`}
                          >
                            {isMultiDay && position === 'start' && '▶ '}
                            {isMultiDay && position === 'end' && '◀ '}
                            {estimate.event_name}
                          </div>
                        );
                      })}
                      {dayEstimates.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{dayEstimates.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Диалог с деталями дня */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto" aria-describedby="day-details-desc">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && format(selectedDate, 'd MMMM yyyy', { locale: ru })}
            </DialogTitle>
            <DialogDescription id="day-details-desc">Сметы и занятость оборудования на выбранную дату</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Сметы на этот день */}
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Сметы ({selectedDateEstimates.length})
              </h3>
              {selectedDateEstimates.length === 0 ? (
                <p className="text-gray-500 text-sm">Нет смет на этот день</p>
              ) : (
                <div className="space-y-2">
                  {selectedDateEstimates.map(estimate => (
                    <Card
                      key={estimate.id}
                      className="cursor-pointer hover:shadow-md"
                      onClick={() => setSelectedEstimate(estimate)}
                    >
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{estimate.event_name}</p>
                            <p className="text-sm text-gray-500 truncate">{estimate.venue}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              📅 {new Date(estimate.event_start_date || estimate.event_date).toLocaleDateString('ru-RU')}
                              {(estimate.event_end_date || estimate.event_date) !== (estimate.event_start_date || estimate.event_date) && 
                                ` — ${new Date(estimate.event_end_date || estimate.event_date).toLocaleDateString('ru-RU')}`}
                            </p>
                            {estimate.creator_name && (
                              <p className="text-xs text-blue-600 mt-1">
                                👤 {estimate.creator_name}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-2">
                            <p className="font-semibold">
                              {estimate.total.toLocaleString('ru-RU')} ₽
                            </p>
                            <p className="text-xs text-gray-500">
                              {estimate.items?.length || 0} позиций
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 pt-2 border-t flex justify-end">
                          <a
                            href={generateGoogleCalendarUrl(estimate)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="outline" size="sm" className="text-xs">
                              <CalendarPlus className="w-3 h-3 mr-1" />
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
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Занятость оборудования
                </h3>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-auto">
                  {getEquipmentAvailability(selectedDate)
                    .filter(eq => eq.occupied > 0)
                    .map(eq => (
                      <div
                        key={eq.id}
                        className={`p-2 rounded text-sm ${
                          eq.isFullyBooked
                            ? 'bg-red-100 text-red-800'
                            : eq.available < eq.quantity * 0.2
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        <p className="font-medium truncate">{eq.name}</p>
                        <p className="text-xs">
                          Занято: {eq.occupied} / {eq.quantity}
                          {eq.isFullyBooked && ' (полностью)'}
                        </p>
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
        <DialogContent className="max-w-2xl" aria-describedby="estimate-details-desc">
          <DialogHeader>
            <DialogTitle>{selectedEstimate?.event_name}</DialogTitle>
            <DialogDescription id="estimate-details-desc">Детальная информация о смете мероприятия</DialogDescription>
          </DialogHeader>
          {selectedEstimate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Площадка</p>
                  <p>{selectedEstimate.venue || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Период</p>
                  <p>
                    {new Date(selectedEstimate.event_start_date || selectedEstimate.event_date).toLocaleDateString('ru-RU')}
                    {(selectedEstimate.event_end_date || selectedEstimate.event_date) !== (selectedEstimate.event_start_date || selectedEstimate.event_date) && 
                      ` — ${new Date(selectedEstimate.event_end_date || selectedEstimate.event_date).toLocaleDateString('ru-RU')}`}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Сумма</p>
                  <p className="font-semibold">
                    {selectedEstimate.total.toLocaleString('ru-RU')} ₽
                  </p>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2">Оборудование:</p>
                <div className="space-y-1">
                  {selectedEstimate.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                      <span>{item.name}</span>
                      <span>
                        {item.quantity} × {item.price.toLocaleString('ru-RU')} ₽ = {' '}
                        {(item.quantity * item.price).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});
