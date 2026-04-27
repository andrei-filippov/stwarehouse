import { useMemo } from 'react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { format } from 'date-fns';

type PeriodMode = 'month' | 'range';

interface PeriodSelectorProps {
  periodMode: PeriodMode;
  setPeriodMode: (mode: PeriodMode) => void;
  activeMonth: string;
  setActiveMonth: (month: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
}

export function PeriodSelector({
  periodMode,
  setPeriodMode,
  activeMonth,
  setActiveMonth,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: PeriodSelectorProps) {
  const months = useMemo(() => {
    const list = [];
    for (let i = 0; i < 24; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      list.push(format(date, 'yyyy-MM'));
    }
    return list;
  }, []);

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant={periodMode === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodMode('month')}
            >
              Месяц
            </Button>
            <Button
              variant={periodMode === 'range' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodMode('range')}
            >
              Период
            </Button>
          </div>

          {periodMode === 'month' ? (
            <select
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value)}
              className="border rounded-md px-3 py-2 bg-background text-foreground"
            >
              {months.map(m => {
                const [year, month] = m.split('-');
                const monthName = monthNames[parseInt(month) - 1];
                return (
                  <option key={m} value={m}>
                    {monthName} {year}
                  </option>
                );
              })}
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-auto"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-auto"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
