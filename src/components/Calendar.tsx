import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Estimate } from '@/types';
import { formatDate } from '@/lib/supabase';

interface CalendarProps {
    estimates: Estimate[];
}

export default function Calendar({ estimates }: CalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

    const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);

    const eventsByDate = useMemo(() => {
        return estimates.reduce((acc, est) => {
            if (est.event_date) { acc[est.event_date] = acc[est.event_date] || []; acc[est.event_date].push(est); }
            return acc;
        }, {} as Record<string, Estimate[]>);
    }, [estimates]);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Календарь</h2>
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
                    <span className="font-medium min-w-[150px] text-center">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-5 h-5" /></button>
                </div>
            </div>

            <div className="bg-white border rounded-xl p-4 shadow-sm">
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }, (_, i) => <div key={`empty-${i}`} />)}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                        const day = i + 1;
                        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const events = eventsByDate[dateStr] || [];
                        const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
                        return (
                            <div key={day} className={`min-h-[100px] p-2 border rounded-lg ${isToday ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}>
                                <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{day}</div>
                                {events.map((event, idx) => <div key={idx} className="mt-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded truncate" title={event.event_name}>{event.event_name}</div>)}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white border rounded-xl p-4 shadow-sm">
                <h3 className="font-semibold text-gray-700 mb-4">Ближайшие мероприятия</h3>
                <div className="space-y-2">
                    {estimates.filter(e => e.event_date && new Date(e.event_date) >= new Date()).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()).slice(0, 5).map(est => (
                        <div key={est.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div><div className="font-medium">{est.event_name}</div><div className="text-sm text-gray-500">{est.venue}</div></div>
                            <div className="text-right"><div className="font-medium text-blue-600">{formatDate(est.event_date)}</div><div className="text-sm text-gray-500">{est.items?.length || 0} позиций</div></div>
                        </div>
                    ))}
                    {estimates.filter(e => e.event_date && new Date(e.event_date) >= new Date()).length === 0 && <p className="text-gray-500 text-center py-4">Нет предстоящих мероприятий</p>}
                </div>
            </div>
        </div>
    );
}
