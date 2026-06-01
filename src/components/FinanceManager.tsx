import { useState, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Users, BarChart3, Calendar, Infinity, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { IncomeTab } from './finance/IncomeTab';
import { ExpensesTab } from './finance/ExpensesTab';
import { SalaryTab } from './finance/SalaryTab';
import { AnalyticsTab } from './finance/AnalyticsTab';
import type { Estimate, Staff, Expense } from '../types';
import type { SalaryRecord } from '../hooks/useSalary';
import type { Income } from '../types/finance';

interface FinanceManagerProps {
  estimates: Estimate[];
  staff: Staff[];
  expenses: Expense[];
  incomes?: Income[];
  companyId?: string;
  onAddExpense?: (expense: Partial<Expense>) => Promise<{ error: any }>;
  onDeleteExpense?: (id: string) => Promise<{ error: any }>;
  onAddIncome?: (income: Partial<Income>) => Promise<{ error: any; data?: any }>;
  onDeleteIncome?: (id: string) => Promise<{ error: any }>;
  salaryRecords?: SalaryRecord[];
  onAddOrUpdateSalary?: (record: Partial<SalaryRecord>) => Promise<{ error: any }>;
  onDeleteSalary?: (id: string) => Promise<{ error: any }>;
  salaryLoading?: boolean;
}

export function FinanceManager({ 
  estimates, 
  staff, 
  expenses, 
  incomes = [],
  companyId, 
  onAddExpense, 
  onDeleteExpense,
  onAddIncome,
  onDeleteIncome,
  salaryRecords = [],
  onAddOrUpdateSalary,
  onDeleteSalary,
  salaryLoading
}: FinanceManagerProps) {
  const [activeTab, setActiveTab] = useState('income');
  const [summaryMode, setSummaryMode] = useState<'month' | 'all'>('month');

  // Выбор месяца для отображения
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );

  // Парсим выбранный месяц
  const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number);
  const currentMonth = selectedMonthNum - 1;
  const currentYear = selectedYear;
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  // Список месяцев для выбора (последние 24 месяца)
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  }, []);

  // Фильтруем подтвержденные/завершенные сметы для доходов
  const completedEstimates = estimates.filter(e => 
    e.status === 'completed' || e.status === 'pending' || e.status === 'approved'
  );

  // ========== МЕСЯЧНЫЕ РАСЧЁТЫ ==========

  // Расчёт доходов за месяц (completed сметы + ручные поступления)
  const monthlyIncome = useMemo(() => {
    const estimateIncome = estimates
      .filter(e => e.status === 'completed')
      .reduce((sum, e) => {
        const date = e.event_date ? new Date(e.event_date) : new Date(e.created_at || 0);
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
          return sum + (e.total || 0);
        }
        return sum;
      }, 0);

    const manualIncome = incomes
      .filter(i => i.type === 'manual')
      .reduce((sum, i) => {
        const date = new Date(i.date || 0);
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
          return sum + (i.amount || 0);
        }
        return sum;
      }, 0);

    return estimateIncome + manualIncome;
  }, [estimates, incomes, currentMonth, currentYear]);

  // Расчёт доходов за прошлый месяц
  const prevMonthIncome = useMemo(() => {
    const estimateIncome = estimates
      .filter(e => e.status === 'completed')
      .reduce((sum, e) => {
        const date = e.event_date ? new Date(e.event_date) : new Date(e.created_at || 0);
        if (date.getMonth() === prevMonth && date.getFullYear() === prevYear) {
          return sum + (e.total || 0);
        }
        return sum;
      }, 0);

    const manualIncome = incomes
      .filter(i => i.type === 'manual')
      .reduce((sum, i) => {
        const date = new Date(i.date || 0);
        if (date.getMonth() === prevMonth && date.getFullYear() === prevYear) {
          return sum + (i.amount || 0);
        }
        return sum;
      }, 0);

    return estimateIncome + manualIncome;
  }, [estimates, incomes, prevMonth, prevYear]);

  // Расчёт зарплат за месяц (по record.month — выплата относится к месяцу начисления)
  const monthlySalary = useMemo(() => {
    return salaryRecords
      .reduce((sum, r) => {
        const date = new Date(r.month + '-01');
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
          return sum + (r.paid || 0);
        }
        return sum;
      }, 0);
  }, [salaryRecords, currentMonth, currentYear]);

  // Расчёт зарплат за прошлый месяц
  const prevMonthSalary = useMemo(() => {
    return salaryRecords
      .reduce((sum, r) => {
        const date = new Date(r.month + '-01');
        if (date.getMonth() === prevMonth && date.getFullYear() === prevYear) {
          return sum + (r.paid || 0);
        }
        return sum;
      }, 0);
  }, [salaryRecords, prevMonth, prevYear]);

  // Расчёт расходов за месяц (только expenses)
  const monthlyExpenses = useMemo(() => {
    return expenses
      .reduce((sum, e) => {
        const date = new Date(e.date || e.created_at || 0);
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
          return sum + (e.amount || 0);
        }
        return sum;
      }, 0);
  }, [expenses, currentMonth, currentYear]);

  // Расчёт расходов за прошлый месяц
  const prevMonthExpenses = useMemo(() => {
    return expenses
      .reduce((sum, e) => {
        const date = new Date(e.date || e.created_at || 0);
        if (date.getMonth() === prevMonth && date.getFullYear() === prevYear) {
          return sum + (e.amount || 0);
        }
        return sum;
      }, 0);
  }, [expenses, prevMonth, prevYear]);

  // Месячная прибыль и маржа
  const monthlyProfit = monthlyIncome - monthlyExpenses - monthlySalary;
  const monthlyProfitMargin = monthlyIncome > 0 ? (monthlyProfit / monthlyIncome) * 100 : 0;

  // Рост/падение в процентах (месячные)
  const incomeChange = prevMonthIncome > 0 ? ((monthlyIncome - prevMonthIncome) / prevMonthIncome) * 100 : 0;
  const expensesChange = prevMonthExpenses > 0 ? ((monthlyExpenses - prevMonthExpenses) / prevMonthExpenses) * 100 : 0;

  // ========== РАСЧЁТЫ ЗА ВСЁ ВРЕМЯ ==========

  // Общие доходы за всё время
  const totalIncomeAllTime = useMemo(() => {
    const estimateIncome = estimates
      .filter(e => e.status === 'completed')
      .reduce((sum, e) => sum + (e.total || 0), 0);

    const manualIncome = incomes
      .filter(i => i.type === 'manual')
      .reduce((sum, i) => sum + (i.amount || 0), 0);

    return estimateIncome + manualIncome;
  }, [estimates, incomes]);

  // Общие расходы за всё время
  const totalExpensesAllTime = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  // Общие зарплаты за всё время
  const totalSalaryAllTime = useMemo(() => {
    return salaryRecords.reduce((sum, r) => sum + (r.paid || 0), 0);
  }, [salaryRecords]);

  // Общая прибыль и маржа за всё время
  const totalProfitAllTime = totalIncomeAllTime - totalExpensesAllTime - totalSalaryAllTime;
  const totalProfitMarginAllTime = totalIncomeAllTime > 0 ? (totalProfitAllTime / totalIncomeAllTime) * 100 : 0;

  // Количество месяцев с данными (для средних)
  const monthsWithData = useMemo(() => {
    const months = new Set<string>();
    
    estimates
      .filter(e => e.status === 'completed' && e.event_date)
      .forEach(e => {
        const d = new Date(e.event_date!);
        months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      });
    
    incomes
      .filter(i => i.type === 'manual' && i.date)
      .forEach(i => {
        const d = new Date(i.date);
        months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      });
    
    expenses
      .filter(e => e.date)
      .forEach(e => {
        const d = new Date(e.date);
        months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      });
    
    salaryRecords
      .forEach(r => {
        months.add(r.month);
      });
    
    return months.size;
  }, [estimates, incomes, expenses, salaryRecords]);

  // Среднемесячные показатели
  const avgMonthlyIncome = monthsWithData > 0 ? totalIncomeAllTime / monthsWithData : 0;
  const avgMonthlyExpenses = monthsWithData > 0 ? totalExpensesAllTime / monthsWithData : 0;
  const avgMonthlySalary = monthsWithData > 0 ? totalSalaryAllTime / monthsWithData : 0;
  const avgMonthlyProfit = monthsWithData > 0 ? totalProfitAllTime / monthsWithData : 0;

  // ========== ВЫБОР АКТИВНЫХ ЗНАЧЕНИЙ ==========

  const isMonthMode = summaryMode === 'month';

  const displayIncome = isMonthMode ? monthlyIncome : totalIncomeAllTime;
  const displayExpenses = isMonthMode ? monthlyExpenses : totalExpensesAllTime;
  const displaySalary = isMonthMode ? monthlySalary : totalSalaryAllTime;
  const displayProfit = isMonthMode ? monthlyProfit : totalProfitAllTime;
  const displayProfitMargin = isMonthMode ? monthlyProfitMargin : totalProfitMarginAllTime;

  // Подписи для карточек
  const incomeLabel = isMonthMode ? 'Доходы (мес)' : 'Доходы (всё время)';
  const expensesLabel = isMonthMode ? 'Расходы (мес)' : 'Расходы (всё время)';
  const salaryLabel = isMonthMode ? 'Зарплаты (мес)' : 'Зарплаты (всё время)';
  const profitLabel = isMonthMode ? 'Прибыль (мес)' : 'Прибыль (всё время)';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Финансы</h1>
          <p className="text-muted-foreground mt-1">Управление доходами, расходами и зарплатами</p>
        </div>

        {/* Переключатель Месяц / Всё время + выбор месяца */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <button
              onClick={() => setSummaryMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                isMonthMode 
                  ? 'bg-background shadow-sm font-medium text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Месяц
            </button>
            <button
              onClick={() => setSummaryMode('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                !isMonthMode 
                  ? 'bg-background shadow-sm font-medium text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Infinity className="w-3.5 h-3.5" />
              Всё время
            </button>
          </div>

          {isMonthMode && (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Доходы */}
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 dark:from-green-500/20 dark:to-green-600/10 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {incomeLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {displayIncome.toLocaleString('ru-RU')} ₽
            </div>
            {isMonthMode ? (
              <p className={`text-xs mt-1 ${incomeChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {incomeChange >= 0 ? '+' : ''}{incomeChange.toFixed(1)}% к прошлому месяцу
              </p>
            ) : (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                ~{avgMonthlyIncome.toLocaleString('ru-RU')} ₽/мес
              </p>
            )}
          </CardContent>
        </Card>

        {/* Расходы */}
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              {expensesLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">
              {displayExpenses.toLocaleString('ru-RU')} ₽
            </div>
            {isMonthMode ? (
              <p className={`text-xs mt-1 ${expensesChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {expensesChange >= 0 ? '+' : ''}{expensesChange.toFixed(1)}% к прошлому месяцу
              </p>
            ) : (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                ~{avgMonthlyExpenses.toLocaleString('ru-RU')} ₽/мес
              </p>
            )}
          </CardContent>
        </Card>

        {/* Зарплаты */}
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Users className="w-4 h-4" />
              {salaryLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {displaySalary.toLocaleString('ru-RU')} ₽
            </div>
            {isMonthMode ? (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{staff.length} сотрудников</p>
            ) : (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                ~{avgMonthlySalary.toLocaleString('ru-RU')} ₽/мес • {staff.length} сотрудников
              </p>
            )}
          </CardContent>
        </Card>

        {/* Прибыль */}
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 dark:from-purple-500/20 dark:to-purple-600/10 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              {profitLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {displayProfit.toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              Маржа: {displayProfitMargin.toFixed(1)}%
              {!isMonthMode && ` • ~${avgMonthlyProfit.toLocaleString('ru-RU')} ₽/мес`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="income" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Доходы</span>
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-2">
            <TrendingDown className="w-4 h-4" />
            <span className="hidden sm:inline">Расходы</span>
          </TabsTrigger>
          <TabsTrigger value="salary" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Зарплаты</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Аналитика</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="space-y-4">
          <IncomeTab 
            estimates={completedEstimates} 
            incomes={incomes}
            companyId={companyId}
            onAddIncome={onAddIncome}
            onDeleteIncome={onDeleteIncome}
          />
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <ExpensesTab expenses={expenses} companyId={companyId} onAdd={onAddExpense} onDelete={onDeleteExpense} />
        </TabsContent>

        <TabsContent value="salary" className="space-y-4">
          <SalaryTab 
            staff={staff} 
            companyId={companyId}
            records={salaryRecords}
            onAddOrUpdate={onAddOrUpdateSalary}
            onDelete={onDeleteSalary}
            loading={salaryLoading}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AnalyticsTab estimates={estimates} salaryRecords={salaryRecords} staff={staff} expenses={expenses} incomes={incomes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FinanceManager;
