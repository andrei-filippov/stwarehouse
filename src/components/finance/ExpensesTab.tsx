import { useState, useMemo, useCallback } from 'react';
import { Plus, Package, Wrench, ShoppingCart, Home, Store, Fuel, MoreHorizontal, Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Expense, ExpenseCategory } from '../../types';
import { getExpenseCategoryLabel, EXPENSE_CATEGORIES } from '../../types/expenses';

interface ExpensesTabProps {
  expenses: Expense[];
  companyId?: string;
  onAdd?: (expense: Partial<Expense>) => Promise<{ error: any }>;
  onDelete?: (id: string) => Promise<{ error: any }>;
}

// Маппинг старых категорий на новые иконки
const categoryIcons: Record<string, { icon: React.ElementType; color: string }> = {
  equipment: { icon: Package, color: 'blue' },
  consumables: { icon: ShoppingCart, color: 'purple' },
  subrent: { icon: Store, color: 'teal' },
  rent: { icon: Home, color: 'green' },
  transport: { icon: Fuel, color: 'red' },
  other: { icon: MoreHorizontal, color: 'gray' },
  repair: { icon: Wrench, color: 'orange' },
  supplies: { icon: ShoppingCart, color: 'purple' },
  fuel: { icon: Fuel, color: 'red' }
};

type ExpenseFilter = 'all' | ExpenseCategory;

export function ExpensesTab({ expenses, onAdd, onDelete }: ExpensesTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ExpenseFilter>('all');
  const [activeMonth, setActiveMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set([format(new Date(), 'yyyy-MM')]));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newExpense, setNewExpense] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: '' as ExpenseCategory | '',
    amount: '',
    description: ''
  });

  // Группировка по категориям
  const expensesByCategory = useMemo(() => {
    const grouped: Record<string, Expense[]> = {};
    expenses.forEach(expense => {
      const cat = expense.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(expense);
    });
    return grouped;
  }, [expenses]);

  const totalByCategory = useMemo(() => {
    return Object.entries(expensesByCategory).map(([category, items]) => ({
      category,
      total: items.reduce((sum, i) => sum + i.amount, 0),
      count: items.length
    }));
  }, [expensesByCategory]);

  // Месячные суммы по категориям
  const monthByCategory = useMemo(() => {
    const monthExpenses = showAllMonths 
      ? expenses 
      : expenses.filter(e => format(new Date(e.date), 'yyyy-MM') === activeMonth);
    
    const grouped: Record<string, Expense[]> = {};
    monthExpenses.forEach(e => {
      if (!grouped[e.category]) grouped[e.category] = [];
      grouped[e.category].push(e);
    });
    return Object.entries(grouped).map(([category, items]) => ({
      category,
      total: items.reduce((sum, i) => sum + i.amount, 0),
      count: items.length
    }));
  }, [expenses, activeMonth, showAllMonths]);

  // Фильтрация по месяцу, категории и поиску
  const filteredExpenses = useMemo(() => {
    let result = [...expenses];
    
    // Фильтр по месяцу
    if (!showAllMonths) {
      result = result.filter(e => format(new Date(e.date), 'yyyy-MM') === activeMonth);
    }
    
    // Фильтр по категории
    if (activeFilter !== 'all') {
      result = result.filter(e => e.category === activeFilter);
    }
    
    // Поиск
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => 
        e.description.toLowerCase().includes(q) ||
        getExpenseCategoryLabel(e.category).toLowerCase().includes(q)
      );
    }
    
    // Сортировка по дате — свежие сверху
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, activeFilter, activeMonth, showAllMonths, searchQuery]);

  // Суммы за выбранный месяц
  const monthTotal = useMemo(() => 
    expenses
      .filter(e => !showAllMonths || format(new Date(e.date), 'yyyy-MM') === activeMonth)
      .reduce((sum, e) => sum + e.amount, 0),
  [expenses, activeMonth, showAllMonths]);

  // Общая сумма
  const totalExpenses = useMemo(() => 
    expenses.reduce((sum, e) => sum + e.amount, 0),
  [expenses]);

  // Группировка по месяцам
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, Expense[]> = {};
    filteredExpenses.forEach(expense => {
      const monthKey = format(new Date(expense.date), 'yyyy-MM');
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(expense);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredExpenses]);

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

  const handleAddExpense = async () => {
    if (!onAdd) return;
    
    setIsSubmitting(true);
    const { error } = await onAdd({
      date: newExpense.date,
      category: newExpense.category,
      amount: Number(newExpense.amount) || 0,
      description: newExpense.description
    });
    setIsSubmitting(false);
    
    if (!error) {
      setIsDialogOpen(false);
      // Сброс формы
      setNewExpense({
        date: format(new Date(), 'yyyy-MM-dd'),
        category: '' as ExpenseCategory | '',
        amount: '',
        description: ''
      });
    }
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

      {/* Summary by Category - Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {/* All */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${
            activeFilter === 'all'
              ? 'bg-muted border-border ring-2 ring-border'
              : 'bg-card border-border'
          }`}
          onClick={() => setActiveFilter('all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-foreground">
                {showAllMonths ? 'Всего' : 'За месяц'}
              </span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {(showAllMonths ? totalExpenses : monthTotal).toLocaleString('ru-RU')} ₽
            </p>
            <p className="text-xs text-muted-foreground">
              {showAllMonths ? expenses.length : expenses.filter(e => format(new Date(e.date), 'yyyy-MM') === activeMonth).length} записей
            </p>
          </CardContent>
        </Card>

        {EXPENSE_CATEGORIES.map(({ value, label }) => {
          const data = showAllMonths 
            ? totalByCategory.find(t => t.category === value)
            : monthByCategory.find(t => t.category === value);
          const amount = data?.total || 0;
          const iconData = categoryIcons[value] || categoryIcons.other;
          const Icon = iconData.icon;
          const color = iconData.color;
          const isActive = activeFilter === value;
          
          const colorClasses: Record<string, { normal: string; active: string }> = {
            blue: {
              normal: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300',
              active: 'bg-blue-500/20 border-blue-500/50 ring-2 ring-blue-500/30 text-blue-800 dark:text-blue-200'
            },
            orange: {
              normal: 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-300',
              active: 'bg-orange-500/20 border-orange-500/50 ring-2 ring-orange-500/30 text-orange-800 dark:text-orange-200'
            },
            purple: {
              normal: 'bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300',
              active: 'bg-purple-500/20 border-purple-500/50 ring-2 ring-purple-500/30 text-purple-800 dark:text-purple-200'
            },
            green: {
              normal: 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300',
              active: 'bg-green-500/20 border-green-500/50 ring-2 ring-green-500/30 text-green-800 dark:text-green-200'
            },
            red: {
              normal: 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300',
              active: 'bg-red-500/20 border-red-500/50 ring-2 ring-red-500/30 text-red-800 dark:text-red-200'
            },
            gray: {
              normal: 'bg-muted border-border text-foreground',
              active: 'bg-muted border-border ring-2 ring-border text-foreground'
            },
            indigo: {
              normal: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-300',
              active: 'bg-indigo-500/20 border-indigo-500/50 ring-2 ring-indigo-500/30 text-indigo-800 dark:text-indigo-200'
            },
            teal: {
              normal: 'bg-teal-500/10 border-teal-500/20 text-teal-700 dark:text-teal-300',
              active: 'bg-teal-500/20 border-teal-500/50 ring-2 ring-teal-500/30 text-teal-800 dark:text-teal-200'
            }
          };
          
          return (
            <Card 
              key={value} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                isActive ? colorClasses[color].active : colorClasses[color].normal
              }`}
              onClick={() => setActiveFilter(value as ExpenseFilter)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <p className="text-lg font-bold">
                  {amount.toLocaleString('ru-RU')} ₽
                </p>
                {data && (
                  <p className="text-xs opacity-70">{data.count} записей</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Active Filter Indicator */}
      {activeFilter !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Фильтр:</span>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-muted"
            onClick={() => setActiveFilter('all')}
          >
            {getExpenseCategoryLabel(activeFilter)}
            <span className="ml-1">×</span>
          </Badge>
        </div>
      )}

      {/* Total and Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Всего расходов</h3>
          <p className="text-2xl font-bold text-red-600">
            {totalExpenses.toLocaleString('ru-RU')} ₽
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Добавить расход
        </Button>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Новый расход</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Дата</Label>
                <Input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Категория</Label>
                <Select
                  value={newExpense.category}
                  onValueChange={(value) => setNewExpense(prev => ({ ...prev, category: value as ExpenseCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Сумма (₽)</Label>
              <Input
                type="number"
                placeholder="0"
                value={newExpense.amount}
                onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Input
                placeholder="На что потрачено"
                value={newExpense.description}
                onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <Button 
              onClick={handleAddExpense} 
              className="w-full"
              disabled={isSubmitting || !newExpense.category || !newExpense.amount}
            >
              {isSubmitting ? 'Добавление...' : 'Добавить'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expenses List — Grouped by Month */}
      <div className="space-y-4">
        {groupedByMonth.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              {activeFilter === 'all' 
                ? 'Нет записей о расходах' 
                : `Нет расходов в категории "${getExpenseCategoryLabel(activeFilter)}"`}
            </p>
            <p className="text-sm">
              {searchQuery ? 'Попробуйте изменить поисковый запрос' : 'Добавьте первый расход'}
            </p>
          </div>
        ) : (
          groupedByMonth.map(([monthKey, items]) => {
            const isExpanded = expandedMonths.has(monthKey);
            const monthTotal = items.reduce((sum, e) => sum + e.amount, 0);
            const monthLabel = format(new Date(monthKey + '-01'), 'MMMM yyyy', { locale: ru });
            
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
                    <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                  </div>
                  <span className="font-semibold text-red-600">
                    -{monthTotal.toLocaleString('ru-RU')} ₽
                  </span>
                </button>
                
                {isExpanded && (
                  <div className="space-y-2">
                    {items.map((expense) => {
                      const iconData = categoryIcons[expense.category] || categoryIcons.other;
                      const Icon = iconData.icon;
                      const color = iconData.color;
                      
                      return (
                        <Card key={expense.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full bg-${color}-100 flex items-center justify-center`}>
                                  <Icon className={`w-5 h-5 text-${color}-600`} />
                                </div>
                                <div>
                                  <p className="font-medium">{expense.description}</p>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Badge variant="outline">{getExpenseCategoryLabel(expense.category)}</Badge>
                                    <span>{format(new Date(expense.date), 'dd MMMM yyyy', { locale: ru })}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <p className="text-lg font-bold text-red-600">
                                  -{expense.amount.toLocaleString('ru-RU')} ₽
                                </p>
                                {onDelete && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDelete(expense.id)}
                                    className="text-muted-foreground hover:text-red-500"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
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
