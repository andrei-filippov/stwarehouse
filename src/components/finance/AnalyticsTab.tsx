import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import type { Estimate } from '../../types';

interface AnalyticsTabProps {
  estimates: Estimate[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function AnalyticsTab({ estimates }: AnalyticsTabProps) {
  // Статистика по месяцам
  const monthlyData = useMemo(() => {
    const data: Record<string, { month: string; income: number; expenses: number }> = {};
    
    estimates.forEach(estimate => {
      if (estimate.status === 'completed' && estimate.event_date) {
        const date = new Date(estimate.event_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
        
        if (!data[monthKey]) {
          data[monthKey] = { month: monthLabel, income: 0, expenses: 0 };
        }
        data[monthKey].income += estimate.total_price || 0;
      }
    });
    
    return Object.values(data).slice(-6); // Последние 6 месяцев
  }, [estimates]);

  // Статистика по статусам
  const statusData = useMemo(() => {
    const counts: Record<string, { name: string; value: number; color: string }> = {
      draft: { name: 'Черновик', value: 0, color: '#9ca3af' },
      pending: { name: 'В работе', value: 0, color: '#f59e0b' },
      approved: { name: 'Согласовано', value: 0, color: '#3b82f6' },
      completed: { name: 'Выполнено', value: 0, color: '#10b981' },
      cancelled: { name: 'Отменено', value: 0, color: '#ef4444' }
    };
    
    estimates.forEach(e => {
      const status = e.status || 'draft';
      if (counts[status]) counts[status].value++;
    });
    
    return Object.values(counts).filter(d => d.value > 0);
  }, [estimates]);

  // Общая статистика
  const stats = useMemo(() => {
    const completed = estimates.filter(e => e.status === 'completed');
    const approved = estimates.filter(e => e.status === 'approved');
    const pending = estimates.filter(e => e.status === 'pending');
    const totalIncome = completed.reduce((sum, e) => sum + (e.total_price || 0), 0);
    const approvedIncome = approved.reduce((sum, e) => sum + (e.total_price || 0), 0);
    const pendingIncome = pending.reduce((sum, e) => sum + (e.total_price || 0), 0);
    
    return {
      totalEstimates: estimates.length,
      completed: completed.length,
      approved: approved.length,
      pending: pending.length,
      totalIncome,
      approvedIncome,
      pendingIncome
    };
  }, [estimates]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Всего смет</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalEstimates}</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Выполнено
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-900">{stats.completed}</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              В работе
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-900">{stats.pending}</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-700 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Доход
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-900">
              {stats.totalIncome.toLocaleString('ru-RU')} ₽
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Income Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Доходы по месяцам</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => `${value.toLocaleString('ru-RU')} ₽`}
                    labelStyle={{ color: '#000' }}
                  />
                  <Bar dataKey="income" fill="#10b981" name="Доход" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                Нет данных о доходах
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Распределение по статусам</CardTitle>
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
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                Нет данных
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Income Alert */}
      {stats.pendingIncome > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-8 h-8 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">Ожидаемые доходы</p>
                <p className="text-sm text-amber-700">
                  {stats.pending} смет ожидают оплаты
                </p>
              </div>
            </div>
            <p className="text-xl font-bold text-amber-900">
              {stats.pendingIncome.toLocaleString('ru-RU')} ₽
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
