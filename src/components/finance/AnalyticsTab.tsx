import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Line, ComposedChart, Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  TrendingUp, TrendingDown, Calendar, Package, DollarSign, BarChart3,
  Users, LayoutDashboard, FileText, Settings2, Receipt,
  ArrowUpRight, ArrowDownRight, Minus, Filter, Wallet
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { Estimate, EstimateItem } from '../../types';
import type { SalaryRecord } from '../../hooks/useSalary';
import type { Income, Expense, PeriodFilter, AnalyticsSubTab } from '../../types/finance';
import { getExpenseCategoryLabel } from '../../types/expenses';

interface AnalyticsTabProps {
  estimates: Estimate[];
  salaryRecords?: SalaryRecord[];
  staff?: { id: string; full_name: string; position: string }[];
  expenses?: Expense[];
  incomes?: Income[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const STATUS_COLORS: Record<string, string> = {
  draft: '#9ca3af',
  pending: '#f59e0b',
  approved: '#3b82f6',
  completed: '#10b981',
  cancelled: '#ef4444'
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  pending: 'В работе',
  approved: 'Согласовано',
  completed: 'Выполнено',
  cancelled: 'Отменено'
};

const FINANCE_COLORS = {
  income: '#10b981',
  expenses: '#ef4444',
  salary: '#3b82f6',
  profit: '#8b5cf6',
  margin: '#f59e0b',
};

// ─── Helpers ───

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

function getQuarterOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const year = now.getFullYear() - Math.floor(i / 4);
    const quarter = 4 - (i % 4);
    const value = `${year}-Q${quarter}`;
    const label = `${quarter} квартал ${year}`;
    options.push({ value, label });
  }
  return options;
}

function getYearOptions() {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const year = now.getFullYear() - i;
    options.push({ value: String(year), label: String(year) });
  }
  return options;
}

function isDateInPeriod(dateStr: string | undefined, period: PeriodFilter): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  switch (period.type) {
    case 'month': {
      const d = new Date(period.value + '-01');
      return date.getFullYear() === d.getFullYear() && date.getMonth() === d.getMonth();
    }
    case 'quarter': {
      const [year, q] = period.value.split('-Q');
      const y = parseInt(year);
      const quarter = parseInt(q);
      const startMonth = (quarter - 1) * 3;
      return date.getFullYear() === y && date.getMonth() >= startMonth && date.getMonth() < startMonth + 3;
    }
    case 'year':
      return date.getFullYear() === period.value;
    case 'range':
      return dateStr >= period.from && dateStr <= period.to;
    case 'all':
    default:
      return true;
  }
}

function isMonthInPeriod(monthKey: string, period: PeriodFilter): boolean {
  switch (period.type) {
    case 'month':
      return monthKey === period.value;
    case 'quarter': {
      const [year, q] = period.value.split('-Q');
      const y = parseInt(year);
      const quarter = parseInt(q);
      const [mYear, mMonth] = monthKey.split('-').map(Number);
      const startMonth = (quarter - 1) * 3;
      return mYear === y && mMonth >= startMonth + 1 && mMonth <= startMonth + 3;
    }
    case 'year': {
      const [mYear] = monthKey.split('-').map(Number);
      return mYear === period.value;
    }
    case 'range': {
      const firstDay = monthKey + '-01';
      return firstDay >= period.from && firstDay <= period.to;
    }
    case 'all':
    default:
      return true;
  }
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ₽`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K ₽`;
  return `${value.toLocaleString('ru-RU')} ₽`;
}

function formatCurrencyFull(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

// ─── KPICard ───
interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color: 'green' | 'red' | 'blue' | 'purple' | 'amber' | 'gray';
  trend?: number;
}

function KPICard({ title, value, subtitle, icon: Icon, color, trend }: KPICardProps) {
  const colorMap = {
    green: 'from-green-500/10 to-green-600/5 border-green-200 dark:from-green-500/20 dark:to-green-600/10 dark:border-green-900 text-green-700 dark:text-green-300',
    red: 'from-red-500/10 to-red-600/5 border-red-200 dark:from-red-500/20 dark:to-red-600/10 dark:border-red-900 text-red-700 dark:text-red-300',
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-200 dark:from-blue-500/20 dark:to-blue-600/10 dark:border-blue-900 text-blue-700 dark:text-blue-300',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-200 dark:from-purple-500/20 dark:to-purple-600/10 dark:border-purple-900 text-purple-700 dark:text-purple-300',
    amber: 'from-amber-500/10 to-amber-600/5 border-amber-200 dark:from-amber-500/20 dark:to-amber-600/10 dark:border-amber-900 text-amber-700 dark:text-amber-300',
    gray: 'from-gray-500/10 to-gray-600/5 border-gray-200 dark:from-gray-500/20 dark:to-gray-600/10 dark:border-gray-900 text-gray-700 dark:text-gray-300',
  };

  return (
    <Card className={`bg-gradient-to-br ${colorMap[color]}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 opacity-90">
          <Icon className="w-4 h-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend !== undefined && (
          <div className={`text-xs mt-1 flex items-center gap-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : trend < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </div>
        )}
        {subtitle && trend === undefined && (
          <p className="text-xs mt-1 opacity-70">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── PeriodSelector ───
function PeriodSelector({
  periodType, setPeriodType, periodValue, setPeriodValue,
  periodYear, setPeriodYear, rangeFrom, setRangeFrom, rangeTo, setRangeTo
}: {
  periodType: PeriodFilter['type'];
  setPeriodType: (t: PeriodFilter['type']) => void;
  periodValue: string;
  setPeriodValue: (v: string) => void;
  periodYear: string;
  setPeriodYear: (v: string) => void;
  rangeFrom: string;
  setRangeFrom: (v: string) => void;
  rangeTo: string;
  setRangeTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Filter className="w-4 h-4" />
        <span>Период:</span>
      </div>
      <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodFilter['type'])}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="month">Месяц</SelectItem>
          <SelectItem value="quarter">Квартал</SelectItem>
          <SelectItem value="year">Год</SelectItem>
          <SelectItem value="range">Диапазон</SelectItem>
          <SelectItem value="all">Всё время</SelectItem>
        </SelectContent>
      </Select>

      {periodType === 'month' && (
        <Select value={periodValue} onValueChange={setPeriodValue}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getMonthOptions().map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {periodType === 'quarter' && (
        <Select value={periodValue} onValueChange={setPeriodValue}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getQuarterOptions().map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {periodType === 'year' && (
        <Select value={periodYear} onValueChange={setPeriodYear}>
          <SelectTrigger className="w-[100px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getYearOptions().map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {periodType === 'range' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={rangeFrom}
            onChange={(e) => setRangeFrom(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-input bg-background"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <input
            type="date"
            value={rangeTo}
            onChange={(e) => setRangeTo(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-input bg-background"
          />
        </div>
      )}
    </div>
  );
}

// ─── Tooltip styles ───
const tooltipStyle = {
  backgroundColor: 'hsl(215 28% 10%)',
  border: '1px solid hsl(217 19% 22%)',
  borderRadius: '8px',
};

const tooltipLabelStyle = { color: 'hsl(210 40% 98%)' };

// ─── Main Component ───
export function AnalyticsTab({ estimates, salaryRecords = [], staff = [], expenses = [], incomes = [] }: AnalyticsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<AnalyticsSubTab>('overview');
  const [periodType, setPeriodType] = useState<PeriodFilter['type']>('month');
  const [periodValue, setPeriodValue] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [periodYear, setPeriodYear] = useState<string>(String(new Date().getFullYear()));
  const [rangeFrom, setRangeFrom] = useState<string>('');
  const [rangeTo, setRangeTo] = useState<string>('');

  const period: PeriodFilter = useMemo(() => {
    switch (periodType) {
      case 'month': return { type: 'month', value: periodValue };
      case 'quarter': return { type: 'quarter', value: periodValue };
      case 'year': return { type: 'year', value: parseInt(periodYear) };
      case 'range': return { type: 'range', from: rangeFrom, to: rangeTo };
      default: return { type: 'all' };
    }
  }, [periodType, periodValue, periodYear, rangeFrom, rangeTo]);

  // ─── Filtered data ───
  const filteredEstimates = useMemo(() => {
    return estimates.filter(e => isDateInPeriod(e.event_date || e.created_at, period));
  }, [estimates, period]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => isDateInPeriod(e.date, period));
  }, [expenses, period]);

  const filteredIncomes = useMemo(() => {
    return incomes.filter(i => isDateInPeriod(i.date, period));
  }, [incomes, period]);

  const filteredSalaryRecords = useMemo(() => {
    if (period.type === 'all') return salaryRecords;
    return salaryRecords.filter(r => isMonthInPeriod(r.month, period));
  }, [salaryRecords, period]);

  // ─── Overview metrics ───
  const overviewMetrics = useMemo(() => {
    const completedEstimates = filteredEstimates.filter(e => e.status === 'completed');
    const estimateIncome = completedEstimates.reduce((s, e) => s + (e.total || 0), 0);
    const manualIncome = filteredIncomes.filter(i => i.type === 'manual').reduce((s, i) => s + (i.amount || 0), 0);
    const totalIncome = estimateIncome + manualIncome;

    const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalSalary = filteredSalaryRecords.reduce((s, r) => s + (r.paid || 0), 0);
    const totalSalaryCalc = filteredSalaryRecords.reduce((s, r) => s + (r.total_calculated || 0), 0);
    const profit = totalIncome - totalExpenses - totalSalary;
    const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

    return { totalIncome, totalExpenses, totalSalary, totalSalaryCalc, profit, margin, estimateIncome, manualIncome };
  }, [filteredEstimates, filteredExpenses, filteredIncomes, filteredSalaryRecords]);

  // ─── Monthly P&L data (for charts) ───
  const monthlyPL = useMemo(() => {
    const data: Record<string, { month: string; income: number; expenses: number; salary: number; profit: number; margin: number }> = {};

    // Income from estimates
    estimates.filter(e => e.status === 'completed' && e.event_date).forEach(e => {
      const d = new Date(e.event_date!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      if (!data[key]) data[key] = { month: label, income: 0, expenses: 0, salary: 0, profit: 0, margin: 0 };
      data[key].income += e.total || 0;
    });

    // Manual incomes
    incomes.filter(i => i.type === 'manual' && i.date).forEach(i => {
      const d = new Date(i.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      if (!data[key]) data[key] = { month: label, income: 0, expenses: 0, salary: 0, profit: 0, margin: 0 };
      data[key].income += i.amount || 0;
    });

    // Expenses
    expenses.filter(e => e.date).forEach(e => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      if (!data[key]) data[key] = { month: label, income: 0, expenses: 0, salary: 0, profit: 0, margin: 0 };
      data[key].expenses += e.amount || 0;
    });

    // Salaries
    salaryRecords.forEach(r => {
      const key = r.month;
      const d = new Date(key + '-01');
      const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      if (!data[key]) data[key] = { month: label, income: 0, expenses: 0, salary: 0, profit: 0, margin: 0 };
      data[key].salary += r.paid || 0;
    });

    // Calculate profit & margin
    Object.values(data).forEach(item => {
      item.profit = item.income - item.expenses - item.salary;
      item.margin = item.income > 0 ? (item.profit / item.income) * 100 : 0;
    });

    return Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, v]) => v);
  }, [estimates, incomes, expenses, salaryRecords]);

  // ─── Expenses by category ───
  const expensesByCategory = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {};
    filteredExpenses.forEach(e => {
      const cat = getExpenseCategoryLabel(e.category);
      if (!map[cat]) map[cat] = { name: cat, value: 0, color: COLORS[Object.keys(map).length % COLORS.length] };
      map[cat].value += e.amount || 0;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // ─── Monthly expenses by category (for stacked bar) ───
  const monthlyExpensesByCategory = useMemo(() => {
    const data: Record<string, Record<string, number>> = {};
    const allCats = new Set<string>();

    expenses.filter(e => e.date).forEach(e => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cat = getExpenseCategoryLabel(e.category);
      allCats.add(cat);
      if (!data[key]) data[key] = {};
      data[key][cat] = (data[key][cat] || 0) + (e.amount || 0);
    });

    const sortedKeys = Object.keys(data).sort().slice(-12);
    return sortedKeys.map(k => {
      const d = new Date(k + '-01');
      const month = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      const entry: Record<string, number | string> = { month, key: k };
      allCats.forEach(cat => { entry[cat] = data[k]?.[cat] || 0; });
      return entry;
    });
  }, [expenses]);

  const expenseCategoryNames = useMemo(() => {
    const cats = new Set<string>();
    expenses.forEach(e => cats.add(getExpenseCategoryLabel(e.category)));
    return Array.from(cats);
  }, [expenses]);

  // ─── Estimate stats ───
  const estimateStats = useMemo(() => {
    const total = filteredEstimates.length;
    const completed = filteredEstimates.filter(e => e.status === 'completed').length;
    const approved = filteredEstimates.filter(e => e.status === 'approved').length;
    const pending = filteredEstimates.filter(e => e.status === 'pending').length;
    const draft = filteredEstimates.filter(e => e.status === 'draft' || !e.status).length;
    const cancelled = filteredEstimates.filter(e => e.status === 'cancelled').length;

    const completedTotal = filteredEstimates.filter(e => e.status === 'completed').reduce((s, e) => s + (e.total || 0), 0);
    const avgCheck = completed > 0 ? completedTotal / completed : 0;

    // Conversion: from approved to completed
    const conversion = (approved + completed) > 0 ? (completed / (approved + completed)) * 100 : 0;

    return { total, completed, approved, pending, draft, cancelled, avgCheck, conversion, completedTotal };
  }, [filteredEstimates]);

  // ─── Monthly estimate status data ───
  const monthlyEstimatesByStatus = useMemo(() => {
    const data: Record<string, Record<string, number>> = {};
    const statuses = ['draft', 'pending', 'approved', 'completed', 'cancelled'];

    estimates.filter(e => e.event_date).forEach(e => {
      const d = new Date(e.event_date!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!data[key]) data[key] = {};
      const status = e.status || 'draft';
      data[key][status] = (data[key][status] || 0) + 1;
    });

    const sortedKeys = Object.keys(data).sort().slice(-12);
    return sortedKeys.map(k => {
      const d = new Date(k + '-01');
      const month = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      const entry: Record<string, number | string> = { month };
      statuses.forEach(s => { entry[s] = data[k]?.[s] || 0; });
      return entry;
    });
  }, [estimates]);

  // ─── Top estimates (exclude draft and cancelled) ───
  const topEstimates = useMemo(() => {
    return [...filteredEstimates]
      .filter(e => e.status !== 'draft' && e.status !== 'cancelled')
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, 10);
  }, [filteredEstimates]);

  // ─── Equipment stats ───
  const equipmentStats = useMemo(() => {
    const equipmentMap: Record<string, { name: string; category: string; quantity: number; revenue: number; usage: number }> = {};
    const servicesMap: Record<string, { name: string; category: string; quantity: number; revenue: number; usage: number }> = {};

    filteredEstimates.forEach(est => {
      const uniqueEquipment = new Set<string>();
      const uniqueServices = new Set<string>();
      (est.items || []).forEach((item: EstimateItem) => {
        const key = item.name?.trim() || item.description?.trim() || 'Неизвестное';
        const isService = item.unit === 'услуга' || item.unit === 'человек';
        const targetMap = isService ? servicesMap : equipmentMap;
        
        if (!targetMap[key]) targetMap[key] = { name: key, category: item.category || 'Без категории', quantity: 0, revenue: 0, usage: 0 };
        targetMap[key].quantity += item.quantity || 0;
        targetMap[key].revenue += (item.price || 0) * (item.quantity || 0);
        
        if (isService) uniqueServices.add(key);
        else uniqueEquipment.add(key);
      });
      uniqueEquipment.forEach(key => { if (equipmentMap[key]) equipmentMap[key].usage += 1; });
      uniqueServices.forEach(key => { if (servicesMap[key]) servicesMap[key].usage += 1; });
    });

    const equipmentList = Object.values(equipmentMap);
    const servicesList = Object.values(servicesMap);
    
    return {
      total: equipmentList.length,
      servicesTotal: servicesList.length,
      topByRevenue: [...equipmentList].sort((a, b) => b.revenue - a.revenue).slice(0, 15),
      topByUsage: [...equipmentList].sort((a, b) => b.usage - a.usage).slice(0, 15),
      topServicesByRevenue: [...servicesList].sort((a, b) => b.revenue - a.revenue).slice(0, 15),
      byCategory: Object.values(
        equipmentList.reduce((acc, item) => {
          if (!acc[item.category]) acc[item.category] = { name: item.category, revenue: 0, quantity: 0 };
          acc[item.category].revenue += item.revenue;
          acc[item.category].quantity += item.quantity;
          return acc;
        }, {} as Record<string, { name: string; revenue: number; quantity: number }>)
      ).sort((a, b) => b.revenue - a.revenue),
      servicesByCategory: Object.values(
        servicesList.reduce((acc, item) => {
          if (!acc[item.category]) acc[item.category] = { name: item.category, revenue: 0, quantity: 0 };
          acc[item.category].revenue += item.revenue;
          acc[item.category].quantity += item.quantity;
          return acc;
        }, {} as Record<string, { name: string; revenue: number; quantity: number }>)
      ).sort((a, b) => b.revenue - a.revenue),
    };
  }, [filteredEstimates]);

  // ─── Staff stats ───
  const staffStats = useMemo(() => {
    const map = new Map<string, { staffId: string; paid: number; calculated: number; projects: number }>();
    filteredSalaryRecords.forEach(r => {
      const ex = map.get(r.staff_id);
      if (ex) {
        ex.paid += r.paid || 0;
        ex.calculated += r.total_calculated || 0;
        ex.projects += r.projects?.length || 0;
      } else {
        map.set(r.staff_id, { staffId: r.staff_id, paid: r.paid || 0, calculated: r.total_calculated || 0, projects: r.projects?.length || 0 });
      }
    });

    return Array.from(map.values())
      .map(item => {
        const member = staff.find(s => s.id === item.staffId);
        return { ...item, name: member?.full_name || 'Неизвестный', position: member?.position || '' };
      })
      .sort((a, b) => b.paid - a.paid);
  }, [filteredSalaryRecords, staff]);

  // ─── Monthly salary data ───
  const monthlySalary = useMemo(() => {
    const data: Record<string, { month: string; paid: number; calculated: number }> = {};
    salaryRecords.forEach(r => {
      const key = r.month;
      const d = new Date(key + '-01');
      const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      if (!data[key]) data[key] = { month: label, paid: 0, calculated: 0 };
      data[key].paid += r.paid || 0;
      data[key].calculated += r.total_calculated || 0;
    });
    return Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([, v]) => v);
  }, [salaryRecords]);

  // ─── Funnel data (based on filtered estimates, cumulative flow) ───
  const funnelData = useMemo(() => {
    // Funnel shows cumulative counts: each stage includes those that reached at least this stage
    const all = filteredEstimates;
    const draft = all.filter(e => e.status === 'draft' || !e.status).length;
    const pending = all.filter(e => e.status === 'pending' || e.status === 'approved' || e.status === 'completed').length;
    const approved = all.filter(e => e.status === 'approved' || e.status === 'completed').length;
    const completed = all.filter(e => e.status === 'completed').length;

    return [
      { name: 'Черновик', value: draft, color: STATUS_COLORS.draft },
      { name: 'В работе', value: pending, color: STATUS_COLORS.pending },
      { name: 'Согласовано', value: approved, color: STATUS_COLORS.approved },
      { name: 'Выполнено', value: completed, color: STATUS_COLORS.completed },
    ];
  }, [filteredEstimates]);

  // ─── Status distribution (for pie) ───
  const statusData = useMemo(() => {
    const counts: Record<string, number> = { draft: 0, pending: 0, approved: 0, completed: 0, cancelled: 0 };
    filteredEstimates.forEach(e => { counts[e.status || 'draft']++; });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v, color: STATUS_COLORS[k] || '#9ca3af' }));
  }, [filteredEstimates]);

  const hasData = estimates.length > 0 || expenses.length > 0 || salaryRecords.length > 0;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">Нет данных для аналитики</p>
        <p className="text-sm">Добавьте сметы, расходы и зарплаты, чтобы увидеть аналитику</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PeriodSelector
          periodType={periodType} setPeriodType={setPeriodType}
          periodValue={periodValue} setPeriodValue={setPeriodValue}
          periodYear={periodYear} setPeriodYear={setPeriodYear}
          rangeFrom={rangeFrom} setRangeFrom={setRangeFrom}
          rangeTo={rangeTo} setRangeTo={setRangeTo}
        />
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as AnalyticsSubTab)}>
        <TabsList className="grid w-full grid-cols-6 lg:w-[720px]">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Обзор</span>
          </TabsTrigger>
          <TabsTrigger value="estimates" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Сметы</span>
          </TabsTrigger>
          <TabsTrigger value="equipment" className="gap-1.5 text-xs">
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Оборуд.</span>
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Услуги</span>
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5 text-xs">
            <Receipt className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Расходы</span>
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Персонал</span>
          </TabsTrigger>
        </TabsList>

        {/* ========== OVERVIEW TAB ========== */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KPICard
              title="Доходы"
              value={formatCurrencyFull(overviewMetrics.totalIncome)}
              icon={TrendingUp}
              color="green"
            />
            <KPICard
              title="Расходы"
              value={formatCurrencyFull(overviewMetrics.totalExpenses)}
              icon={TrendingDown}
              color="red"
            />
            <KPICard
              title="Зарплаты"
              value={formatCurrencyFull(overviewMetrics.totalSalary)}
              icon={Users}
              color="blue"
            />
            <KPICard
              title="Прибыль"
              value={formatCurrencyFull(overviewMetrics.profit)}
              icon={DollarSign}
              color="purple"
            />
            <KPICard
              title="Маржа"
              value={`${overviewMetrics.margin.toFixed(1)}%`}
              icon={BarChart3}
              color="amber"
            />
          </div>

          {/* P&L Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                P&L по месяцам
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyPL.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={monthlyPL}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 19% 22%)" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} />
                    <YAxis yAxisId="left" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} tickFormatter={v => formatCurrency(v as number)} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = { income: 'Доход', expenses: 'Расходы', salary: 'Зарплаты', profit: 'Прибыль', margin: 'Маржа %' };
                        if (name === 'margin') return [`${value.toFixed(1)}%`, labels[name] || name];
                        return [formatCurrencyFull(value), labels[name] || name];
                      }}
                      labelStyle={tooltipLabelStyle}
                      contentStyle={tooltipStyle}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="income" name="Доход" fill={FINANCE_COLORS.income} radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="expenses" name="Расходы" fill={FINANCE_COLORS.expenses} radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="salary" name="Зарплаты" fill={FINANCE_COLORS.salary} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="margin" name="Маржа %" stroke={FINANCE_COLORS.margin} strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">Нет данных</div>
              )}
            </CardContent>
          </Card>

          {/* Expense structure + P&L table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Структура расходов</CardTitle>
              </CardHeader>
              <CardContent>
                {expensesByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={expensesByCategory}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelStyle={{ fill: 'hsl(210 40% 98%)', fontSize: 11 }}
                      >
                        {expensesByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [formatCurrencyFull(value), 'Сумма']}
                        contentStyle={tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">Нет данных о расходах</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">P&L сводка</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Доходы от смет</span>
                    <span className="text-sm font-medium text-green-600">{formatCurrencyFull(overviewMetrics.estimateIncome)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Прочие доходы</span>
                    <span className="text-sm font-medium text-green-600">{formatCurrencyFull(overviewMetrics.manualIncome)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm font-medium">Всего доходов</span>
                    <span className="text-sm font-bold text-green-600">{formatCurrencyFull(overviewMetrics.totalIncome)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Расходы</span>
                    <span className="text-sm font-medium text-red-500">− {formatCurrencyFull(overviewMetrics.totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Зарплаты</span>
                    <span className="text-sm font-medium text-red-500">− {formatCurrencyFull(overviewMetrics.totalSalary)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 bg-muted/50 rounded-lg px-3">
                    <span className="text-sm font-bold">Прибыль</span>
                    <span className={`text-sm font-bold ${overviewMetrics.profit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                      {formatCurrencyFull(overviewMetrics.profit)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-muted-foreground">Маржинальность</span>
                    <span className="text-sm font-medium">{overviewMetrics.margin.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========== ESTIMATES TAB ========== */}
        <TabsContent value="estimates" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KPICard title="Всего смет" value={String(estimateStats.total)} icon={FileText} color="gray" />
            <KPICard title="Выполнено" value={String(estimateStats.completed)} icon={TrendingUp} color="green" />
            <KPICard title="Согласовано" value={String(estimateStats.approved)} icon={Calendar} color="blue" />
            <KPICard title="Средний чек" value={formatCurrency(estimateStats.avgCheck)} icon={DollarSign} color="purple" />
            <KPICard title="Конверсия" value={`${estimateStats.conversion.toFixed(0)}%`} icon={BarChart3} color="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Распределение по статусам</CardTitle>
              </CardHeader>
              <CardContent>
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelStyle={{ fill: 'hsl(210 40% 98%)', fontSize: 12 }}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">Нет данных</div>
                )}
              </CardContent>
            </Card>

            {/* Monthly status dynamics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Динамика по статусам</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyEstimatesByStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={monthlyEstimatesByStatus}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 19% 22%)" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} />
                      <YAxis tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                      <Legend />
                      <Bar dataKey="draft" name="Черновик" stackId="a" fill={STATUS_COLORS.draft} />
                      <Bar dataKey="pending" name="В работе" stackId="a" fill={STATUS_COLORS.pending} />
                      <Bar dataKey="approved" name="Согласовано" stackId="a" fill={STATUS_COLORS.approved} />
                      <Bar dataKey="completed" name="Выполнено" stackId="a" fill={STATUS_COLORS.completed} />
                      <Bar dataKey="cancelled" name="Отменено" stackId="a" fill={STATUS_COLORS.cancelled} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">Нет данных</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Воронка смет</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                {funnelData.map((item, idx) => {
                  const prev = idx > 0 ? funnelData[idx - 1].value : item.value;
                  const conv = prev > 0 ? ((item.value / prev) * 100).toFixed(0) : '100';
                  return (
                    <div key={item.name} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full rounded-lg p-4 text-center text-white font-medium text-sm"
                        style={{ backgroundColor: item.color, opacity: 0.9 }}
                      >
                        <div className="text-lg font-bold">{item.value}</div>
                        <div className="text-xs opacity-90">{item.name}</div>
                      </div>
                      {idx < funnelData.length - 1 && (
                        <div className="hidden sm:flex items-center justify-center py-1">
                          <Badge variant="secondary" className="text-xs">{conv}%</Badge>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Top estimates table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Топ-10 смет по выручке</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-dark">
                {topEstimates.map((est, idx) => (
                  <div key={est.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-muted-foreground w-5">{idx + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate" title={est.event_name}>{est.event_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {est.event_date ? new Date(est.event_date).toLocaleDateString('ru-RU') : '—'}
                          {' · '}
                          <span style={{ color: STATUS_COLORS[est.status || 'draft'] }}>{STATUS_LABELS[est.status || 'draft']}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrencyFull(est.total || 0)}</p>
                    </div>
                  </div>
                ))}
                {topEstimates.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Нет данных</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== EQUIPMENT TAB ========== */}
        <TabsContent value="equipment" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Позиций в сметах" value={String(equipmentStats.total)} icon={Package} color="blue" />
            <KPICard title="Выручка" value={formatCurrency(equipmentStats.byCategory.reduce((s, c) => s + c.revenue, 0))} icon={DollarSign} color="green" />
            <KPICard title="Категорий" value={String(equipmentStats.byCategory.length)} icon={Settings2} color="purple" />
            <KPICard
              title="Средняя выручка"
              value={formatCurrency(equipmentStats.total > 0 ? equipmentStats.byCategory.reduce((s, c) => s + c.revenue, 0) / equipmentStats.total : 0)}
              icon={BarChart3}
              color="amber"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by category */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Выручка по категориям</CardTitle>
              </CardHeader>
              <CardContent>
                {equipmentStats.byCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={equipmentStats.byCategory} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 19% 22%)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} tickFormatter={v => formatCurrency(v as number)} />
                      <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(210 40% 98%)', fontSize: 11 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} width={130} />
                      <Tooltip formatter={(v: number) => [formatCurrencyFull(v), 'Выручка']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                      <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">Нет данных</div>
                )}
              </CardContent>
            </Card>

            {/* Quantity by category */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Количество по категориям</CardTitle>
              </CardHeader>
              <CardContent>
                {equipmentStats.byCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={equipmentStats.byCategory} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 19% 22%)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(210 40% 98%)', fontSize: 11 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} width={130} />
                      <Tooltip formatter={(v: number) => [`${v} шт.`, 'Количество']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                      <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">Нет данных</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top equipment tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Топ по выручке</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-dark">
                  {equipmentStats.topByRevenue.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-muted-foreground w-5">{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate" title={item.name}>{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrencyFull(item.revenue)}</p>
                        <p className="text-xs text-muted-foreground">{item.quantity} шт.</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Топ по использованию</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-dark">
                  {equipmentStats.topByUsage.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-muted-foreground w-5">{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate" title={item.name}>{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="secondary" className="text-xs">{item.usage} смет</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========== SERVICES TAB ========== */}
        <TabsContent value="services" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Позиций услуг" value={String(equipmentStats.servicesTotal)} icon={Users} color="blue" />
            <KPICard title="Выручка услуг" value={formatCurrency(equipmentStats.servicesByCategory.reduce((s, c) => s + c.revenue, 0))} icon={DollarSign} color="green" />
            <KPICard title="Категорий услуг" value={String(equipmentStats.servicesByCategory.length)} icon={Settings2} color="purple" />
            <KPICard
              title="Средняя выручка"
              value={formatCurrency(equipmentStats.servicesTotal > 0 ? equipmentStats.servicesByCategory.reduce((s, c) => s + c.revenue, 0) / equipmentStats.servicesTotal : 0)}
              icon={BarChart3}
              color="amber"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by category */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Выручка по категориям услуг</CardTitle>
              </CardHeader>
              <CardContent>
                {equipmentStats.servicesByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={equipmentStats.servicesByCategory} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 19% 22%)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} tickFormatter={v => formatCurrency(v as number)} />
                      <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(210 40% 98%)', fontSize: 11 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} width={130} />
                      <Tooltip formatter={(v: number) => [formatCurrencyFull(v), 'Выручка']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                      <Bar dataKey="revenue" fill="#ec4899" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">Нет данных</div>
                )}
              </CardContent>
            </Card>

            {/* Top services table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Топ услуг по выручке</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-dark">
                  {equipmentStats.topServicesByRevenue.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-muted-foreground w-5">{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate" title={item.name}>{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatCurrency(item.revenue)}</p>
                        <Badge variant="secondary" className="text-xs">{item.usage} смет</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========== EXPENSES TAB ========== */}
        <TabsContent value="expenses" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Всего расходов" value={formatCurrencyFull(overviewMetrics.totalExpenses)} icon={Receipt} color="red" />
            <KPICard title="Количество" value={String(filteredExpenses.length)} icon={FileText} color="gray" />
            <KPICard
              title="Средний расход"
              value={formatCurrency(filteredExpenses.length > 0 ? overviewMetrics.totalExpenses / filteredExpenses.length : 0)}
              icon={BarChart3}
              color="amber"
            />
            <KPICard
              title="Топ категория"
              value={expensesByCategory[0]?.name || '—'}
              subtitle={expensesByCategory[0] ? formatCurrencyFull(expensesByCategory[0].value) : undefined}
              icon={TrendingDown}
              color="purple"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expense structure */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Структура расходов</CardTitle>
              </CardHeader>
              <CardContent>
                {expensesByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={expensesByCategory}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelStyle={{ fill: 'hsl(210 40% 98%)', fontSize: 11 }}
                      >
                        {expensesByCategory.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [formatCurrencyFull(v), 'Сумма']} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">Нет данных</div>
                )}
              </CardContent>
            </Card>

            {/* Monthly expenses dynamics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Динамика расходов по месяцам</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyExpensesByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={monthlyExpensesByCategory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 19% 22%)" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} />
                      <YAxis tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} tickFormatter={v => formatCurrency(v as number)} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(v: number) => formatCurrencyFull(v)} />
                      <Legend />
                      {expenseCategoryNames.map((cat, idx) => (
                        <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">Нет данных</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Expenses by category table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Расходы по категориям</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expensesByCategory.map((cat, idx) => {
                  const percent = overviewMetrics.totalExpenses > 0 ? (cat.value / overviewMetrics.totalExpenses) * 100 : 0;
                  return (
                    <div key={cat.name} className="flex items-center gap-4 p-2 rounded-lg bg-muted/50">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{cat.name}</span>
                          <span className="text-sm font-semibold">{formatCurrencyFull(cat.value)}</span>
                        </div>
                        <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{percent.toFixed(1)}% от общих расходов</div>
                      </div>
                    </div>
                  );
                })}
                {expensesByCategory.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Нет данных о расходах</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== STAFF TAB ========== */}
        <TabsContent value="staff" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Всего начислено" value={formatCurrencyFull(overviewMetrics.totalSalaryCalc)} icon={TrendingUp} color="blue" />
            <KPICard title="Всего выдано" value={formatCurrencyFull(overviewMetrics.totalSalary)} icon={DollarSign} color="green" />
            <KPICard
              title="Остаток"
              value={formatCurrencyFull(overviewMetrics.totalSalaryCalc - overviewMetrics.totalSalary)}
              icon={Wallet}
              color={overviewMetrics.totalSalaryCalc - overviewMetrics.totalSalary >= 0 ? 'amber' : 'red'}
            />
            <KPICard
              title="Средняя з/п"
              value={formatCurrency(staffStats.length > 0 ? overviewMetrics.totalSalary / staffStats.length : 0)}
              icon={Users}
              color="purple"
            />
          </div>

          {/* Salary chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Зарплаты по месяцам</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlySalary.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlySalary}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 19% 22%)" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} />
                    <YAxis tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(217 19% 22%)' }} tickFormatter={v => formatCurrency(v as number)} />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = { paid: 'Выдано', calculated: 'Начислено' };
                        return [formatCurrencyFull(value), labels[name] || name];
                      }}
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Legend />
                    <Bar dataKey="calculated" name="Начислено" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="paid" name="Выдано" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">Нет данных</div>
              )}
            </CardContent>
          </Card>

          {/* Staff table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Сотрудники по выплатам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-dark">
                {staffStats.map((item, idx) => (
                  <div key={item.staffId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-muted-foreground w-5">{idx + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate" title={item.name}>{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.position}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 text-xs space-y-0.5">
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrencyFull(item.paid)}</p>
                      <p className="text-muted-foreground">{item.projects} проектов</p>
                      {item.calculated > item.paid && (
                        <p className="text-amber-500">Остаток: {formatCurrencyFull(item.calculated - item.paid)}</p>
                      )}
                    </div>
                  </div>
                ))}
                {staffStats.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Нет данных</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
