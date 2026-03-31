import { useState, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Users, BarChart3 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
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
  onDeleteSalary
}: FinanceManagerProps) {
  const [activeTab, setActiveTab] = useState('income');

  // Фильтруем подтвержденные/завершенные сметы для доходов
  const completedEstimates = estimates.filter(e => 
    e.status === 'completed' || e.status === 'pending' || e.status === 'approved'
  );

  // Получаем текущий месяц и предыдущий
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

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

  // Расчёт зарплат за месяц (по выплатам из salary_records)
  const monthlySalary = useMemo(() => {
    return salaryRecords
      .reduce((sum, r) => {
        const date = r.payment_date ? new Date(r.payment_date) : new Date(r.month + '-01');
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
        const date = r.payment_date ? new Date(r.payment_date) : new Date(r.month + '-01');
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

  // Прибыль
  const monthlyProfit = monthlyIncome - monthlyExpenses - monthlySalary;
  const profitMargin = monthlyIncome > 0 ? (monthlyProfit / monthlyIncome) * 100 : 0;

  // Рост/падение в процентах
  const incomeChange = prevMonthIncome > 0 ? ((monthlyIncome - prevMonthIncome) / prevMonthIncome) * 100 : 0;
  const expensesChange = prevMonthExpenses > 0 ? ((monthlyExpenses - prevMonthExpenses) / prevMonthExpenses) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Финансы</h1>
          <p className="text-muted-foreground mt-1">Управление доходами, расходами и зарплатами</p>
        </div>

      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 dark:from-green-500/20 dark:to-green-600/10 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Доходы (мес)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{monthlyIncome.toLocaleString('ru-RU')} ₽</div>
            <p className={`text-xs mt-1 ${incomeChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {incomeChange >= 0 ? '+' : ''}{incomeChange.toFixed(1)}% к прошлому месяцу
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Расходы (мес)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">{monthlyExpenses.toLocaleString('ru-RU')} ₽</div>
            <p className={`text-xs mt-1 ${expensesChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {expensesChange >= 0 ? '+' : ''}{expensesChange.toFixed(1)}% к прошлому месяцу
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Зарплаты (мес)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{monthlySalary.toLocaleString('ru-RU')} ₽</div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{staff.length} сотрудников</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 dark:from-purple-500/20 dark:to-purple-600/10 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Прибыль (мес)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{monthlyProfit.toLocaleString('ru-RU')} ₽</div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Маржа: {profitMargin.toFixed(1)}%</p>
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
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AnalyticsTab estimates={estimates} salaryRecords={salaryRecords} staff={staff} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FinanceManager;
