import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, Calendar, Package, DollarSign, BarChart3, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { Badge } from '../ui/badge';
import type { Estimate, EstimateItem } from '../../types';
import type { SalaryRecord } from '../../hooks/useSalary';

interface AnalyticsTabProps {
  estimates: Estimate[];
  salaryRecords?: SalaryRecord[];
  staff?: { id: string; full_name: string; position: string }[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const STATUS_COLORS: Record<string, string> = {
  draft: '#9ca3af',
  pending: '#f59e0b', 
  approved: '#3b82f6',
  completed: '#10b981',
  cancelled: '#ef4444'
};

export function AnalyticsTab({ estimates, salaryRecords = [], staff = [] }: AnalyticsTabProps) {
  const [showEquipmentStats, setShowEquipmentStats] = useState(true);

  // Статистика по месяцам (доходы)
  const monthlyData = useMemo(() => {
    const data: Record<string, { month: string; income: number; count: number }> = {};
    
    estimates.forEach(estimate => {
      if ((estimate.status === 'completed' || estimate.status === 'approved') && estimate.event_date) {
        const date = new Date(estimate.event_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
        
        if (!data[monthKey]) {
          data[monthKey] = { month: monthLabel, income: 0, count: 0 };
        }
        data[monthKey].income += estimate.total || 0;
        data[monthKey].count += 1;
      }
    });
    
    return Object.values(data).slice(-12); // Последние 12 месяцев
  }, [estimates]);

  // Статистика зарплат по месяцам
  const salaryMonthlyData = useMemo(() => {
    const data: Record<string, { month: string; paid: number; calculated: number; count: number }> = {};
    
    salaryRecords.forEach(record => {
      const monthKey = record.month;
      const date = new Date(monthKey + '-01');
      const monthLabel = date.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      
      if (!data[monthKey]) {
        data[monthKey] = { month: monthLabel, paid: 0, calculated: 0, count: 0 };
      }
      data[monthKey].paid += record.paid || 0;
      data[monthKey].calculated += record.total_calculated || 0;
      data[monthKey].count += 1;
    });
    
    return Object.values(data)
      .sort((a, b) => {
        const keyA = Object.keys(data).find(k => data[k] === a) || '';
        const keyB = Object.keys(data).find(k => data[k] === b) || '';
        return keyA.localeCompare(keyB);
      })
      .slice(-12);
  }, [salaryRecords]);

  // Топ сотрудников по зарплате
  const topStaffBySalary = useMemo(() => {
    const map = new Map<string, { staffId: string; paid: number; calculated: number; projects: number }>();
    
    salaryRecords.forEach(record => {
      const existing = map.get(record.staff_id);
      if (existing) {
        existing.paid += record.paid || 0;
        existing.calculated += record.total_calculated || 0;
        existing.projects += record.projects.length;
      } else {
        map.set(record.staff_id, {
          staffId: record.staff_id,
          paid: record.paid || 0,
          calculated: record.total_calculated || 0,
          projects: record.projects.length,
        });
      }
    });
    
    return Array.from(map.values())
      .map(item => {
        const member = staff.find(s => s.id === item.staffId);
        return {
          ...item,
          name: member?.full_name || 'Неизвестный',
          position: member?.position || '',
        };
      })
      .sort((a, b) => b.paid - a.paid)
      .slice(0, 10);
  }, [salaryRecords, staff]);

  // Статистика по статусам
  const statusData = useMemo(() => {
    const counts: Record<string, { name: string; value: number; color: string }> = {
      draft: { name: 'Черновик', value: 0, color: STATUS_COLORS.draft },
      pending: { name: 'В работе', value: 0, color: STATUS_COLORS.pending },
      approved: { name: 'Согласовано', value: 0, color: STATUS_COLORS.approved },
      completed: { name: 'Выполнено', value: 0, color: STATUS_COLORS.completed },
      cancelled: { name: 'Отменено', value: 0, color: STATUS_COLORS.cancelled }
    };
    
    estimates.forEach(e => {
      const status = e.status || 'draft';
      if (counts[status]) counts[status].value++;
    });
    
    return Object.values(counts).filter(d => d.value > 0);
  }, [estimates]);

  // Аналитика по оборудованию
  const equipmentStats = useMemo(() => {
    const equipmentMap: Record<string, {
      name: string;
      category: string;
      totalQuantity: number;
      totalRevenue: number;
      usageCount: number;
    }> = {};

    estimates.forEach(estimate => {
      const items = estimate.items || [];
      const uniqueEquipmentInEstimate = new Set<string>();

      items.forEach((item: EstimateItem) => {
        const key = item.name?.trim() || item.description?.trim() || 'Неизвестное оборудование';
        
        if (!equipmentMap[key]) {
          equipmentMap[key] = {
            name: key,
            category: item.category || 'Без категории',
            totalQuantity: 0,
            totalRevenue: 0,
            usageCount: 0
          };
        }

        equipmentMap[key].totalQuantity += item.quantity || 0;
        equipmentMap[key].totalRevenue += (item.price || 0) * (item.quantity || 0);
        uniqueEquipmentInEstimate.add(key);
      });

      uniqueEquipmentInEstimate.forEach(key => {
        if (equipmentMap[key]) {
          equipmentMap[key].usageCount += 1;
        }
      });
    });

    const equipmentList = Object.values(equipmentMap);

    const topByUsage = [...equipmentList]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    const topByRevenue = [...equipmentList]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    const topByQuantity = [...equipmentList]
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10);

    return { topByUsage, topByRevenue, topByQuantity, totalUniqueEquipment: equipmentList.length };
  }, [estimates]);

  // Общая статистика
  const stats = useMemo(() => {
    const completed = estimates.filter(e => e.status === 'completed');
    const approved = estimates.filter(e => e.status === 'approved');
    const pending = estimates.filter(e => e.status === 'pending');
    const draft = estimates.filter(e => e.status === 'draft' || !e.status);
    
    const totalIncome = completed.reduce((sum, e) => sum + (e.total || 0), 0);
    const approvedIncome = approved.reduce((sum, e) => sum + (e.total || 0), 0);
    const pendingIncome = pending.reduce((sum, e) => sum + (e.total || 0), 0);
    
    const avgEstimateValue = completed.length > 0 
      ? totalIncome / completed.length 
      : 0;

    const totalSalaryPaid = salaryRecords.reduce((sum, r) => sum + (r.paid || 0), 0);
    const totalSalaryCalculated = salaryRecords.reduce((sum, r) => sum + (r.total_calculated || 0), 0);

    return {
      totalEstimates: estimates.length,
      completed: completed.length,
      approved: approved.length,
      pending: pending.length,
      draft: draft.length,
      totalIncome,
      approvedIncome,
      pendingIncome,
      avgEstimateValue,
      totalSalaryPaid,
      totalSalaryCalculated,
    };
  }, [estimates, salaryRecords]);

  // Данные для графика оборудования по категориям
  const equipmentByCategory = useMemo(() => {
    const categoryMap: Record<string, { name: string; value: number; revenue: number }> = {};
    
    estimates.forEach(estimate => {
      const items = estimate.items || [];
      items.forEach((item: EstimateItem) => {
        const category = item.category || 'Без категории';
        if (!categoryMap[category]) {
          categoryMap[category] = { name: category, value: 0, revenue: 0 };
        }
        categoryMap[category].value += item.quantity || 0;
        categoryMap[category].revenue += (item.price || 0) * (item.quantity || 0);
      });
    });
    
    return Object.values(categoryMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [estimates]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M ₽`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K ₽`;
    }
    return `${value} ₽`;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Всего смет</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{stats.totalEstimates}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.completed} выполнено • {stats.pending} в работе
            </p>
          </CardContent>
        </Card>

        <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Выполнено
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-900 dark:text-green-300">{stats.completed}</p>
            <p className="text-xs text-green-700 dark:text-green-400 mt-1">
              {((stats.completed / Math.max(stats.totalEstimates, 1)) * 100).toFixed(0)}% от общего числа
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Средний чек
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">
              {formatCurrency(stats.avgEstimateValue)}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
              на выполненную смету
            </p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Доход
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">
              {formatCurrency(stats.totalIncome)}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
              + {formatCurrency(stats.approvedIncome)} согласовано
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Salary Summary Cards */}
      {salaryRecords.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-500/10 border-blue-500/20 dark:bg-blue-500/10 dark:border-blue-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Всего начислено
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {stats.totalSalaryCalculated.toLocaleString('ru-RU')} ₽
              </p>
            </CardContent>
          </Card>

          <Card className="bg-green-500/10 border-green-500/20 dark:bg-green-500/10 dark:border-green-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Всего выдано
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {stats.totalSalaryPaid.toLocaleString('ru-RU')} ₽
              </p>
            </CardContent>
          </Card>

          <Card className={`border ${stats.totalSalaryCalculated - stats.totalSalaryPaid >= 0 ? 'bg-amber-500/10 border-amber-500/20 dark:bg-amber-500/10 dark:border-amber-500/30' : 'bg-red-500/10 border-red-500/20 dark:bg-red-500/10 dark:border-red-500/30'}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm ${stats.totalSalaryCalculated - stats.totalSalaryPaid >= 0 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
                Остаток к выдаче
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${stats.totalSalaryCalculated - stats.totalSalaryPaid >= 0 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
                {(stats.totalSalaryCalculated - stats.totalSalaryPaid).toLocaleString('ru-RU')} ₽
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Income Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Доходы по месяцам</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 19% 22%)" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(217 19% 22%)' }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(217 19% 22%)' }}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString('ru-RU')} ₽`, 'Доход']}
                    labelStyle={{ color: 'hsl(210 40% 98%)' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(215 28% 10%)', 
                      border: '1px solid hsl(217 19% 22%)',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Нет данных о доходах
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
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
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelStyle={{ fill: 'hsl(210 40% 98%)', fontSize: 12 }}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(215 28% 10%)', 
                      border: '1px solid hsl(217 19% 22%)',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Нет данных
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Salary Analytics */}
      {salaryRecords.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Salary Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                Зарплаты по месяцам
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salaryMonthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={salaryMonthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 19% 22%)" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(217 19% 22%)' }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(217 19% 22%)' }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        const label = name === 'paid' ? 'Выдано' : 'Начислено';
                        return [`${value.toLocaleString('ru-RU')} ₽`, label];
                      }}
                      labelStyle={{ color: 'hsl(210 40% 98%)' }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(215 28% 10%)', 
                        border: '1px solid hsl(217 19% 22%)',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="calculated" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="paid" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Нет данных о зарплатах
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Staff by Salary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Топ сотрудников по выплатам
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[250px] overflow-y-auto scrollbar-dark">
                {topStaffBySalary.map((item, index) => (
                  <div 
                    key={item.staffId}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-muted-foreground w-5">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate" title={item.name}>
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.position}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {item.paid.toLocaleString('ru-RU')} ₽
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.projects} проектов
                      </p>
                    </div>
                  </div>
                ))}
                {topStaffBySalary.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Нет данных</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Equipment Analytics Section */}
      <Card className="overflow-hidden">
        <CardHeader 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setShowEquipmentStats(!showEquipmentStats)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">Аналитика по оборудованию</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {equipmentStats.totalUniqueEquipment} позиций • Топ-10 по использованию и выручке
                </p>
              </div>
            </div>
            <div className="text-muted-foreground">
              {showEquipmentStats ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </CardHeader>
        
        {showEquipmentStats && (
          <CardContent className="space-y-6">
            {/* Equipment by Category Chart */}
            {equipmentByCategory.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Выручка по категориям оборудования</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={equipmentByCategory} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 19% 22%)" horizontal={false} />
                    <XAxis 
                      type="number" 
                      tick={{ fill: 'hsl(215 20% 65%)', fontSize: 11 }}
                      axisLine={{ stroke: 'hsl(217 19% 22%)' }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fill: 'hsl(210 40% 98%)', fontSize: 11 }}
                      axisLine={{ stroke: 'hsl(217 19% 22%)' }}
                      width={120}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toLocaleString('ru-RU')} ₽`, 'Выручка']}
                      labelStyle={{ color: 'hsl(210 40% 98%)' }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(215 28% 10%)', 
                        border: '1px solid hsl(217 19% 22%)',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Equipment by Usage */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Часто используемое оборудование
                </h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-dark">
                  {equipmentStats.topByUsage.map((item, index) => (
                    <div 
                      key={item.name}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-muted-foreground w-5">{index + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate" title={item.name}>
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          {item.usageCount} смет
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {equipmentStats.topByUsage.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Нет данных</p>
                  )}
                </div>
              </div>

              {/* Top Equipment by Revenue */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Самое прибыльное оборудование
                </h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-dark">
                  {equipmentStats.topByRevenue.map((item, index) => (
                    <div 
                      key={item.name}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-muted-foreground w-5">{index + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate" title={item.name}>
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.totalQuantity} шт. в {item.usageCount} сметах
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {item.totalRevenue.toLocaleString('ru-RU')} ₽
                        </p>
                      </div>
                    </div>
                  ))}
                  {equipmentStats.topByRevenue.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Нет данных</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
