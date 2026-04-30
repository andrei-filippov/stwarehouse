import { useState, useMemo, useEffect } from 'react';
import { Plus, FileText, CheckCircle2, Clock, Calendar, Trash2, TrendingUp, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Estimate } from '../../types';
import type { Income } from '../../types/finance';

interface IncomeTabProps {
  estimates: Estimate[];
  incomes?: Income[];
  companyId?: string;
  onAddIncome?: (income: Partial<Income>) => Promise<{ error: any; data?: any }>;
  onDeleteIncome?: (id: string) => Promise<{ error: any }>;
}

type IncomeFilter = 'all' | 'estimates' | 'manual' | 'pending';

interface LegacyManualIncome {
  id: string;
  date: string;
  source: string;
  amount: number;
  description?: string;
}

export function IncomeTab({ estimates, incomes = [], companyId, onAddIncome, onDeleteIncome }: IncomeTabProps) {
  const [activeFilter, setActiveFilter] = useState<IncomeFilter>('all');
  const [activeMonth, setActiveMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set([format(new Date(), 'yyyy-MM')]));
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newIncome, setNewIncome] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    source: '',
    amount: '',
    description: ''
  });
  const [isMigrating, setIsMigrating] = useState(false);

  // Миграция старых данных из localStorage в Supabase
  useEffect(() => {
    if (!companyId || !onAddIncome || isMigrating) return;

    const migrate = async () => {
      const saved = localStorage.getItem(`income_manual_${companyId}`);
      if (!saved) return;

      const legacyIncomes: LegacyManualIncome[] = JSON.parse(saved);
      if (!legacyIncomes.length) {
        localStorage.removeItem(`income_manual_${companyId}`);
        return;
      }

      // Если в Supabase уже есть ручные поступления — не мигрируем
      const existingManual = incomes.filter(i => i.type === 'manual');
      if (existingManual.length > 0) {
        localStorage.removeItem(`income_manual_${companyId}`);
        return;
      }

      setIsMigrating(true);
      for (const item of legacyIncomes) {
        await onAddIncome({
          source: item.source,
          amount: item.amount,
          date: item.date,
          description: item.description,
          type: 'manual',
        });
      }
      localStorage.removeItem(`income_manual_${companyId}`);
      setIsMigrating(false);
    };

    migrate();
  }, [companyId, onAddIncome, incomes, isMigrating]);

  // Доходы от смет (завершенные)
  const estimateIncomes = useMemo(() => {
    return estimates
      .filter(e => e.status === 'completed')
      .map(e => ({
        id: e.id,
        date: e.event_date || e.created_at,
        source: `Смета: ${e.event_name}`,
        amount: e.total || 0,
        type: 'estimate' as const,
        status: e.status
      }));
  }, [estimates]);

  // Ожидаемые доходы (pending сметы)
  const pendingIncomes = useMemo(() => {
    return estimates
      .filter(e => e.status === 'pending')
      .map(e => ({
        id: e.id,
        date: e.event_date || e.created_at,
        source: `Смета: ${e.event_name}`,
        amount: e.total || 0,
        type: 'pending' as const,
        status: e.status
      }));
  }, [estimates]);

  // Ручные поступления из Supabase
  const manualIncomes = useMemo(() => {
    return incomes.filter(i => i.type === 'manual');
  }, [incomes]);

  // Объединяем все доходы для фильтрации по месяцу
  const allIncomes = useMemo(() => {
    const combined = [
      ...estimateIncomes.map(i => ({ ...i, kind: 'estimate' as const })),
      ...manualIncomes.map(i => ({ ...i, kind: 'manual' as const })),
      ...pendingIncomes.map(i => ({ ...i, kind: 'pending' as const })),
    ];
    // Сортировка по дате — свежие сверху
    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [estimateIncomes, manualIncomes, pendingIncomes]);

  // Фильтрация по месяцу, типу и поиску
  const filteredByMonth = useMemo(() => {
    let result = allIncomes;
    
    // Фильтр по типу (если не "Все")
    if (activeFilter !== 'all') {
      result = result.filter(i => i.kind === activeFilter);
    }
    
    // Фильтр по месяцу (если не "Все время")
    if (!showAllMonths) {
      result = result.filter(i => {
        const d = new Date(i.date);
        return format(d, 'yyyy-MM') === activeMonth;
      });
    }
    
    // Поиск
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => 
        i.source.toLowerCase().includes(q) ||
        (i as any).description?.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [allIncomes, activeFilter, activeMonth, showAllMonths, searchQuery]);

  // Суммы за выбранный месяц
  const monthEstimateIncome = useMemo(() => 
    filteredByMonth.filter(i => i.kind === 'estimate').reduce((sum, i) => sum + i.amount, 0),
  [filteredByMonth]);
  const monthManualIncome = useMemo(() => 
    filteredByMonth.filter(i => i.kind === 'manual').reduce((sum, i) => sum + i.amount, 0),
  [filteredByMonth]);
  const monthPendingIncome = useMemo(() => 
    filteredByMonth.filter(i => i.kind === 'pending').reduce((sum, i) => sum + i.amount, 0),
  [filteredByMonth]);

  // Общие суммы (всё время)
  const totalEstimateIncome = estimateIncomes.reduce((sum, i) => sum + i.amount, 0);
  const totalManualIncome = manualIncomes.reduce((sum, i) => sum + i.amount, 0);
  const totalPendingIncome = pendingIncomes.reduce((sum, i) => sum + i.amount, 0);

  // Группировка по месяцам для отображения
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, typeof filteredByMonth> = {};
    filteredByMonth.forEach(item => {
      const monthKey = format(new Date(item.date), 'yyyy-MM');
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(item);
    });
    // Сортировка месяцев — свежие сверху
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredByMonth]);

  // Список месяцев для селектора (с января 2026)
  const monthOptions = useMemo(() => {
    const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const options = [];
    const startYear = 2026;
    const startMonth = 0; // Январь
    const now = new Date();
    
    let current = new Date(startYear, startMonth, 1);
    while (current <= now) {
      const value = format(current, 'yyyy-MM');
      const label = `${monthNames[current.getMonth()]} ${current.getFullYear()}`;
      options.unshift({ value, label }); // Добавляем в начало — свежие сверху
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
    return options;
  }, []);

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  };

  const handleAddIncome = async () => {
    if (!newIncome.source || !newIncome.amount || !onAddIncome) return;
    
    await onAddIncome({
      source: newIncome.source,
      amount: parseFloat(newIncome.amount),
      date: newIncome.date,
      description: newIncome.description,
      type: 'manual',
    });
    
    setNewIncome({
      date: format(new Date(), 'yyyy-MM-dd'),
      source: '',
      amount: '',
      description: ''
    });
    setIsDialogOpen(false);
  };

  const handleDeleteIncome = async (id: string) => {
    if (!onDeleteIncome) return;
    await onDeleteIncome(id);
  };

  return (
    <div className="space-y-6">
      {/* Month Selector + Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <button
              onClick={() => setShowAllMonths(false)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                !showAllMonths ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Месяц
            </button>
            <button
              onClick={() => setShowAllMonths(true)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                showAllMonths ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Всё время
            </button>
          </div>
          {!showAllMonths && (
            <select
              value={activeMonth}
              onChange={(e) => {
                setActiveMonth(e.target.value);
                setExpandedMonths(new Set([e.target.value]));
              }}
              className="border rounded-md px-3 py-2 text-sm bg-background"
            >
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Summary - Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${
            activeFilter === 'all'
              ? 'bg-muted border-border ring-2 ring-border'
              : 'bg-card border-border'
          }`}
          onClick={() => setActiveFilter('all')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">
              {showAllMonths ? 'Всего' : 'Всего за месяц'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {showAllMonths 
                ? (totalEstimateIncome + totalManualIncome).toLocaleString('ru-RU')
                : (monthEstimateIncome + monthManualIncome).toLocaleString('ru-RU')
              } ₽
            </div>
            <p className="text-xs text-muted-foreground">
              {showAllMonths 
                ? `${estimateIncomes.length + manualIncomes.length} записей`
                : `${filteredByMonth.filter(i => i.kind !== 'pending').length} записей`
              }
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${
            activeFilter === 'estimates'
              ? 'bg-green-500/20 border-green-500/50 ring-2 ring-green-500/30'
              : 'bg-green-500/10 border-green-500/20 dark:bg-green-500/10 dark:border-green-500/30'
          }`}
          onClick={() => setActiveFilter('estimates')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700 dark:text-green-300">
              {showAllMonths ? 'Получено (сметы)' : 'Сметы'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {(showAllMonths ? totalEstimateIncome : monthEstimateIncome).toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-green-600 dark:text-green-400">
              {showAllMonths ? estimateIncomes.length : filteredByMonth.filter(i => i.kind === 'estimate').length} смет
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${
            activeFilter === 'manual'
              ? 'bg-blue-500/20 border-blue-500/50 ring-2 ring-blue-500/30'
              : 'bg-blue-500/10 border-blue-500/20 dark:bg-blue-500/10 dark:border-blue-500/30'
          }`}
          onClick={() => setActiveFilter('manual')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-700 dark:text-blue-300">
              {showAllMonths ? 'Ручные поступления' : 'Ручные'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {(showAllMonths ? totalManualIncome : monthManualIncome).toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {showAllMonths ? manualIncomes.length : filteredByMonth.filter(i => i.kind === 'manual').length} записей
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${
            activeFilter === 'pending'
              ? 'bg-amber-500/20 border-amber-500/50 ring-2 ring-amber-500/30'
              : 'bg-amber-500/10 border-amber-500/20 dark:bg-amber-500/10 dark:border-amber-500/30'
          }`}
          onClick={() => setActiveFilter('pending')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-700 dark:text-amber-300">Ожидается</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {(showAllMonths ? totalPendingIncome : monthPendingIncome).toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {showAllMonths ? pendingIncomes.length : filteredByMonth.filter(i => i.kind === 'pending').length} ожидают
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">История поступлений</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Добавить поступление
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Новое поступление</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Дата</Label>
                  <Input
                    type="date"
                    value={newIncome.date}
                    onChange={(e) => setNewIncome(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Сумма (₽)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newIncome.amount}
                    onChange={(e) => setNewIncome(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Источник</Label>
                <Input
                  placeholder="Например: Аренда оборудования"
                  value={newIncome.source}
                  onChange={(e) => setNewIncome(prev => ({ ...prev, source: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Описание (опционально)</Label>
                <Input
                  placeholder="Дополнительная информация"
                  value={newIncome.description}
                  onChange={(e) => setNewIncome(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <Button onClick={handleAddIncome} className="w-full">
                Добавить
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Filter Indicator */}
      {activeFilter !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Фильтр:</span>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setActiveFilter('all')}
          >
            {activeFilter === 'estimates' && 'Получено от смет'}
            {activeFilter === 'manual' && 'Ручные поступления'}
            {activeFilter === 'pending' && 'Ожидается'}
            <span className="ml-1">×</span>
          </Badge>
        </div>
      )}

      {/* Income List — Grouped by Month */}
      <div className="space-y-4">
        {groupedByMonth.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              {activeFilter === 'all' && 'Нет данных о поступлениях'}
              {activeFilter === 'estimates' && 'Нет полученных доходов от смет'}
              {activeFilter === 'manual' && 'Нет ручных поступлений'}
              {activeFilter === 'pending' && 'Нет ожидаемых поступлений'}
            </p>
            <p className="text-sm">
              {searchQuery ? 'Попробуйте изменить поисковый запрос' : 'Завершите сметы или добавьте поступления вручную'}
            </p>
          </div>
        ) : (
          groupedByMonth.map(([monthKey, items]) => {
            const isExpanded = expandedMonths.has(monthKey);
            const monthTotal = filteredItems.reduce((sum, i) => sum + i.amount, 0);
            const monthLabel = format(new Date(monthKey + '-01'), 'MMMM yyyy', { locale: ru });
            
            // Фильтруем по типу
            const filteredItems = activeFilter === 'all' 
              ? items 
              : items.filter(i => i.kind === activeFilter);
            
            if (filteredItems.length === 0) return null;
            
            return (
              <div key={monthKey} className="space-y-2">
                {/* Month Header */}
                <button
                  onClick={() => toggleMonth(monthKey)}
                  className="w-full flex items-center justify-between py-2 px-1 hover:bg-muted/50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    <h4 className="font-medium text-foreground capitalize">{monthLabel}</h4>
                    <Badge variant="secondary" className="text-xs">{filteredItems.length}</Badge>
                  </div>
                  <span className="font-semibold text-green-600">
                    +{monthTotal.toLocaleString('ru-RU')} ₽
                  </span>
                </button>
                
                {isExpanded && (
                  <div className="space-y-2">
                    {filteredItems.map((income) => (
                      <Card key={income.id} className={`hover:shadow-md transition-shadow ${income.kind === 'pending' ? 'opacity-70' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                income.kind === 'estimate' ? 'bg-green-500/20' :
                                income.kind === 'manual' ? 'bg-blue-500/20' :
                                'bg-amber-500/20'
                              }`}>
                                {income.kind === 'estimate' && <FileText className="w-5 h-5 text-green-600" />}
                                {income.kind === 'manual' && <Plus className="w-5 h-5 text-blue-600" />}
                                {income.kind === 'pending' && <Clock className="w-5 h-5 text-amber-600" />}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{income.source}</p>
                                {(income as any).description && (
                                  <p className="text-sm text-muted-foreground">{(income as any).description}</p>
                                )}
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(income.date), 'dd MMMM yyyy', { locale: ru })}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-lg font-bold ${
                                income.kind === 'estimate' ? 'text-green-600 dark:text-green-400' :
                                income.kind === 'manual' ? 'text-blue-600 dark:text-blue-400' :
                                'text-amber-600 dark:text-amber-400'
                              }`}>
                                {income.kind === 'pending' ? '' : '+'}{income.amount.toLocaleString('ru-RU')} ₽
                              </p>
                              <Badge variant="outline" className={`${
                                income.kind === 'estimate' ? 'text-green-600 border-green-200' :
                                income.kind === 'manual' ? 'text-blue-600 border-blue-200' :
                                'text-amber-600 border-amber-200'
                              }`}>
                                {income.kind === 'estimate' && <><CheckCircle2 className="w-3 h-3 mr-1" />Получено</>}
                                {income.kind === 'manual' && 'Ручное'}
                                {income.kind === 'pending' && <><Clock className="w-3 h-3 mr-1" />Ожидается</>}
                              </Badge>
                              {income.kind === 'manual' && onDeleteIncome && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteIncome(income.id)}
                                  className="text-gray-400 hover:text-red-500 mt-1 ml-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
