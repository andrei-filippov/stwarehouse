import { useState, useMemo, useCallback, memo, type FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { 
  BarChart3 as BarChartIcon, 
  TrendingUp, 
  Package, 
  Calendar,
  Users,
  DollarSign,
  PieChart,
  Activity,
  TrendingDown,
  Wallet,
  Plus,
  Trash2,
  Edit,
  CheckCircle2
} from 'lucide-react';
import type { Customer, Equipment, Estimate, Staff } from '../types';
import type { Expense, ExpenseCategory } from '../types/expenses';
import { EXPENSE_CATEGORIES, getExpenseCategoryLabel } from '../types/expenses';
import { format, subMonths, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface AnalyticsProps {
  equipment: Equipment[];
  estimates: Estimate[];
  staff: Staff[];
  customers: Customer[];
  expenses?: Expense[];
  onAddExpense?: (expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => Promise<{ error: any }>;
  onUpdateExpense?: (id: string, updates: Partial<Expense>) => Promise<{ error: any }>;
  onDeleteExpense?: (id: string) => Promise<{ error: any }>;
}

export const Analytics = memo(function Analytics({ 
  equipment, 
  estimates, 
  staff, 
  customers,
  expenses = [],
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense
}: AnalyticsProps) {
  const [period, setPeriod] = useState<'all' | 'year' | 'month'>('all');
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    
    if (period === 'all') {
      startDate = new Date(2000, 0, 1);
    } else if (period === 'year') {
      startDate = subMonths(now, 12);
    } else {
      startDate = subMonths(now, 1);
    }
    
    return {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(now, 'yyyy-MM-dd')
    };
  }, [period]);

  const filteredEstimates = useMemo(() => {
    if (period === 'all') return estimates;
    return estimates.filter(e => {
      if (!e.event_date) return false;
      return e.event_date >= dateRange.start && e.event_date <= dateRange.end;
    });
  }, [estimates, period, dateRange]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => e.date >= dateRange.start && e.date <= dateRange.end);
  }, [expenses, dateRange]);

  // Выручка только от выполненных смет (для расчета прибыли)
  const completedEstimates = useMemo(() => {
    return filteredEstimates.filter(e => e.status === 'completed');
  }, [filteredEstimates]);

  const totalRevenue = useMemo(() => {
    return completedEstimates.reduce((sum, e) => sum + (e.total || 0), 0);
  }, [completedEstimates]);

  // Статистика по статусам смет
  const estimatesByStatus = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredEstimates.forEach(e => {
      const status = e.status || 'draft';
      stats[status] = (stats[status] || 0) + 1;
    });
    return stats;
  }, [filteredEstimates]);

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const expensesByCategory = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      stats[e.category] = (stats[e.category] || 0) + e.amount;
    });
    return Object.entries(stats)
      .map(([category, amount]) => ({ category: category as ExpenseCategory, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  const profit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const estimateCount = filteredEstimates.length;
  const avgEstimate = estimateCount > 0 ? totalRevenue / estimateCount : 0;

  const equipmentUsage = useMemo(() => {
    const usage: Record<string, { count: number; revenue: number; name: string; category: string }> = {};
    filteredEstimates.forEach(estimate => {
      estimate.items?.forEach(item => {
        const key = item.equipment_id || item.name;
        if (!usage[key]) {
          usage[key] = { count: 0, revenue: 0, name: item.name, category: item.category };
        }
        usage[key].count += item.quantity;
        usage[key].revenue += item.price * item.quantity * (item.coefficient || 1);
      });
    });
    return Object.values(usage).sort((a, b) => b.count - a.count);
  }, [filteredEstimates]);

  const topEquipmentByRevenue = useMemo(() => {
    return [...equipmentUsage].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [equipmentUsage]);

  const topEquipmentByUsage = useMemo(() => equipmentUsage.slice(0, 10), [equipmentUsage]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, { revenue: number; count: number; items: number }> = {};
    filteredEstimates.forEach(estimate => {
      estimate.items?.forEach(item => {
        const category = item.category || 'Без категории';
        if (!stats[category]) stats[category] = { revenue: 0, count: 0, items: 0 };
        const itemRevenue = item.price * item.quantity * (item.coefficient || 1);
        stats[category].revenue += itemRevenue;
        stats[category].count += item.quantity;
        stats[category].items += 1;
      });
    });
    return Object.entries(stats).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.revenue - a.revenue);
  }, [filteredEstimates]);

  const monthlyStats = useMemo(() => {
    const months: Record<string, { revenue: number; expenses: number; count: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { revenue: 0, expenses: 0, count: 0 };
    }
    filteredEstimates.forEach(estimate => {
      if (estimate.event_date) {
        const key = estimate.event_date.substring(0, 7);
        if (months[key]) {
          months[key].revenue += estimate.total || 0;
          months[key].count += 1;
        }
      }
    });
    filteredExpenses.forEach(expense => {
      const key = expense.date.substring(0, 7);
      if (months[key]) months[key].expenses += expense.amount;
    });
    return Object.entries(months).map(([month, data]) => ({ month: month.slice(5), year: month.slice(0, 4), ...data }));
  }, [filteredEstimates, filteredExpenses]);

  const warehouseStats = useMemo(() => {
    const totalItems = equipment.length;
    const totalQuantity = equipment.reduce((sum, e) => sum + (e.quantity || 0), 0);
    const totalValue = equipment.reduce((sum, e) => sum + (e.price || 0) * (e.quantity || 0), 0);
    const avgPrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;
    return { totalItems, totalQuantity, totalValue, avgPrice };
  }, [equipment]);

  const staffStats = useMemo(() => {
    const active = staff.filter(s => s.is_active).length;
    const inactive = staff.filter(s => !s.is_active).length;
    const withCar = staff.filter(s => s.car_info && s.car_info.trim()).length;
    return { total: staff.length, active, inactive, withCar };
  }, [staff]);

  const customerStats = useMemo(() => {
    const stats: Record<string, { name: string; revenue: number; count: number }> = {};
    filteredEstimates.forEach(e => {
      const name = e.customer_name || 'Не указан';
      if (!stats[name]) stats[name] = { name, revenue: 0, count: 0 };
      stats[name].revenue += e.total || 0;
      stats[name].count += 1;
    });
    return Object.values(stats).sort((a, b) => b.revenue - a.revenue);
  }, [filteredEstimates]);

  const formatCurrency = useCallback((val: number) => 
    val.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }), []);

  const handleAddExpense = () => {
    setEditingExpense(null);
    setIsExpenseDialogOpen(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setIsExpenseDialogOpen(true);
  };

  const handleDeleteExpense = async (id: string) => {
    if (onDeleteExpense && confirm('Удалить расход?')) await onDeleteExpense(id);
  };

  const handleExpenseSubmit = async (data: any) => {
    if (editingExpense && onUpdateExpense) await onUpdateExpense(editingExpense.id, data);
    else if (onAddExpense) await onAddExpense(data);
    setIsExpenseDialogOpen(false);
    setEditingExpense(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChartIcon className="w-6 h-6" />
          Аналитика
        </h2>
        <div className="flex gap-2">
          {(['all', 'year', 'month'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}>
              {p === 'all' ? 'Всё время' : p === 'year' ? 'Год' : 'Месяц'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Выручка</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
                <p className="text-xs text-green-600/70">только выполненные сметы</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Расходы</p><p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p></div><TrendingDown className="w-8 h-8 text-red-500" /></div></CardContent></Card>
        <Card className={profit >= 0 ? 'border-green-200' : 'border-red-200'}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Прибыль</p>
                <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(profit)}</p>
                <p className="text-xs text-gray-400">{profitMargin.toFixed(1)}% маржинальность</p>
              </div>
              <Wallet className={`w-8 h-8 ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Смет</p>
                <p className="text-2xl font-bold">{estimateCount}</p>
                <div className="flex gap-1 mt-1 text-xs">
                  {estimatesByStatus.completed > 0 && <span className="text-green-600">{estimatesByStatus.completed}✓</span>}
                  {estimatesByStatus.approved > 0 && <span className="text-blue-600">{estimatesByStatus.approved}✓</span>}
                  {estimatesByStatus.pending > 0 && <span className="text-yellow-600">{estimatesByStatus.pending}⏳</span>}
                  {estimatesByStatus.draft > 0 && <span className="text-muted-foreground">{estimatesByStatus.draft}📝</span>}
                  {estimatesByStatus.cancelled > 0 && <span className="text-red-600">{estimatesByStatus.cancelled}✕</span>}
                </div>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Activity className="w-5 h-5" />Динамика: Выручка vs Расходы</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48 flex items-end gap-2">
            {monthlyStats.map((m, i) => {
              const maxValue = Math.max(...monthlyStats.map(x => Math.max(x.revenue, x.expenses))) || 1;
              const revenueHeight = (m.revenue / maxValue) * 100;
              const expenseHeight = (m.expenses / maxValue) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5 items-end h-32">
                    <div className="flex-1 bg-green-500 rounded-t hover:bg-green-600 relative group" style={{ height: `${Math.max(revenueHeight, 3)}%` }}>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">{formatCurrency(m.revenue)}</div>
                    </div>
                    <div className="flex-1 bg-red-500 rounded-t hover:bg-red-600 relative group" style={{ height: `${Math.max(expenseHeight, 3)}%` }}>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">{formatCurrency(m.expenses)}</div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{m.month}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded"></div><span>Выручка (выполненные сметы)</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded"></div><span>Расходы</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Статистика по статусам смет */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Сметы по статусам
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{estimatesByStatus.completed || 0}</p>
              <p className="text-sm text-green-700">Выполнены</p>
              <p className="text-xs text-green-600/70">учитываются в прибыли</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{estimatesByStatus.approved || 0}</p>
              <p className="text-sm text-blue-700">Согласованы</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{estimatesByStatus.pending || 0}</p>
              <p className="text-sm text-yellow-700">В работе</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold text-gray-600">{estimatesByStatus.draft || 0}</p>
              <p className="text-sm text-gray-700">Черновики</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{estimatesByStatus.cancelled || 0}</p>
              <p className="text-sm text-red-700">Отменены</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2"><TrendingDown className="w-5 h-5" />Расходы по категориям</CardTitle>
            {onAddExpense && <Button size="sm" onClick={handleAddExpense}><Plus className="w-4 h-4 mr-1" />Добавить</Button>}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expensesByCategory.length === 0 ? <p className="text-center text-muted-foreground py-4">Нет расходов за выбранный период</p> :
                expensesByCategory.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><span className="text-sm font-medium text-muted-foreground w-6">{i + 1}</span><span className="text-sm">{getExpenseCategoryLabel(item.category)}</span></div>
                    <span className="text-sm font-medium text-red-600">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
            </div>
            {filteredExpenses.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-sm font-medium mb-3">Последние расходы</p>
                <div className="space-y-2 max-h-40 overflow-auto">
                  {filteredExpenses.slice(0, 5).map(expense => (
                    <div key={expense.id} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{expense.description || getExpenseCategoryLabel(expense.category)}</p>
                        <p className="text-xs text-muted-foreground">{format(parseISO(expense.date), 'dd.MM.yyyy', { locale: ru })}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="font-medium text-red-600">{formatCurrency(expense.amount)}</span>
                        {onUpdateExpense && <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleEditExpense(expense)}><Edit className="w-3 h-3" /></Button>}
                        {onDeleteExpense && <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => handleDeleteExpense(expense.id)}><Trash2 className="w-3 h-3" /></Button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><PieChart className="w-5 h-5" />Выручка по категориям</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryStats.slice(0, 5).map((cat, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><span className="text-sm font-medium text-muted-foreground w-6">{i + 1}</span><span className="text-sm">{cat.name}</span></div>
                  <div className="flex items-center gap-4"><Badge variant="secondary">{cat.count} шт</Badge><span className="text-sm font-medium">{formatCurrency(cat.revenue)}</span></div>
                </div>
              ))}
              {categoryStats.length === 0 && <p className="text-center text-muted-foreground py-4">Нет данных</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5" />Топ оборудование по прибыли</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topEquipmentByRevenue.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><span className="text-sm font-medium text-muted-foreground w-6">{i + 1}</span><div><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.category}</p></div></div>
                  <span className="text-sm font-medium">{formatCurrency(item.revenue)}</span>
                </div>
              ))}
              {topEquipmentByRevenue.length === 0 && <p className="text-center text-muted-foreground py-4">Нет данных</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Package className="w-5 h-5" />Часто используемое оборудование</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topEquipmentByUsage.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><span className="text-sm font-medium text-muted-foreground w-6">{i + 1}</span><div><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.category}</p></div></div>
                  <Badge variant="secondary">{item.count} раз</Badge>
                </div>
              ))}
              {topEquipmentByUsage.length === 0 && <p className="text-center text-muted-foreground py-4">Нет данных</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5" />Персонал</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg"><p className="text-2xl font-bold">{staffStats.total}</p><p className="text-sm text-muted-foreground">Всего</p></div>
              <div className="text-center p-4 bg-green-50 rounded-lg"><p className="text-2xl font-bold text-green-600">{staffStats.active}</p><p className="text-sm text-muted-foreground">Активных</p></div>
              <div className="text-center p-4 bg-muted rounded-lg"><p className="text-2xl font-bold">{staffStats.withCar}</p><p className="text-sm text-muted-foreground">С авто</p></div>
              <div className="text-center p-4 bg-orange-50 rounded-lg"><p className="text-2xl font-bold text-orange-600">{warehouseStats.totalItems}</p><p className="text-sm text-muted-foreground">Видов оборудования</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5" />Топ заказчиков</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customerStats.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><span className="text-sm font-medium text-muted-foreground w-6">{i + 1}</span><div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.count} смет</p></div></div>
                  <span className="text-sm font-medium">{formatCurrency(c.revenue)}</span>
                </div>
              ))}
              {customerStats.length === 0 && <p className="text-center text-muted-foreground py-4">Нет данных</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Стоимость складских запасов</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Общая стоимость оборудования на складе</p>
              <p className="text-3xl font-bold text-blue-600">{formatCurrency(warehouseStats.totalValue)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Средняя цена за ед.</p>
              <p className="text-xl font-medium">{formatCurrency(warehouseStats.avgPrice)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6" aria-describedby="expense-dialog-desc">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Редактировать расход' : 'Добавить расход'}</DialogTitle>
            <DialogDescription id="expense-dialog-desc">{editingExpense ? 'Измените данные расхода' : 'Введите данные о новом расходе'}</DialogDescription>
          </DialogHeader>
          <ExpenseForm initialData={editingExpense} onSubmit={handleExpenseSubmit} onCancel={() => { setIsExpenseDialogOpen(false); setEditingExpense(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
});

function ExpenseForm({ initialData, onSubmit, onCancel }: { initialData: Expense | null; onSubmit: (data: any) => void; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    category: initialData?.category || 'other',
    amount: initialData?.amount || '',
    description: initialData?.description || '',
    date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, amount: Number(formData.amount) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Категория *</label>
        <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full border rounded-md p-2 mt-1" required>
          {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Сумма *</label>
        <Input type="number" min="0" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" required className="mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium">Дата *</label>
        <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required className="mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium">Описание</label>
        <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Например: Закуп микрофонов" className="mt-1" />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Отмена</Button>
        <Button type="submit">{initialData ? 'Сохранить' : 'Добавить'}</Button>
      </div>
    </form>
  );
}
