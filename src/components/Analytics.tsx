import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  Calendar,
  Users,
  DollarSign,
  PieChart,
  Activity
} from 'lucide-react';
import type { Equipment, Estimate, Staff } from '../types';

interface AnalyticsProps {
  equipment: Equipment[];
  estimates: Estimate[];
  staff: Staff[];
}

export function Analytics({ equipment, estimates, staff }: AnalyticsProps) {
  const [period, setPeriod] = useState<'all' | 'year' | 'month'>('all');

  // Фильтруем сметы по периоду
  const filteredEstimates = useMemo(() => {
    if (period === 'all') return estimates;
    
    const now = new Date();
    const cutoff = new Date();
    
    if (period === 'year') {
      cutoff.setFullYear(now.getFullYear() - 1);
    } else if (period === 'month') {
      cutoff.setMonth(now.getMonth() - 1);
    }
    
    return estimates.filter(e => {
      if (!e.event_date) return false;
      return new Date(e.event_date) >= cutoff;
    });
  }, [estimates, period]);

  // === ОБОРУДОВАНИЕ ===
  
  // Частота использования оборудования (сколько раз использовалось в сметах)
  const equipmentUsage = useMemo(() => {
    const usage: Record<string, { count: number; revenue: number; name: string; category: string }> = {};
    
    filteredEstimates.forEach(estimate => {
      estimate.items?.forEach(item => {
        const key = item.equipment_id || item.name;
        if (!usage[key]) {
          usage[key] = { 
            count: 0, 
            revenue: 0, 
            name: item.name,
            category: item.category 
          };
        }
        usage[key].count += item.quantity;
        usage[key].revenue += item.price * item.quantity * (item.coefficient || 1);
      });
    });
    
    return Object.values(usage).sort((a, b) => b.count - a.count);
  }, [filteredEstimates]);

  // Топ оборудование по прибыли
  const topEquipmentByRevenue = useMemo(() => {
    return [...equipmentUsage]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [equipmentUsage]);

  // Топ оборудование по частоте использования
  const topEquipmentByUsage = useMemo(() => {
    return equipmentUsage.slice(0, 10);
  }, [equipmentUsage]);

  // === КАТЕГОРИИ ===

  // Прибыль по категориям
  const categoryStats = useMemo(() => {
    const stats: Record<string, { revenue: number; count: number; items: number }> = {};
    
    filteredEstimates.forEach(estimate => {
      estimate.items?.forEach(item => {
        const category = item.category || 'Без категории';
        if (!stats[category]) {
          stats[category] = { revenue: 0, count: 0, items: 0 };
        }
        const itemRevenue = item.price * item.quantity * (item.coefficient || 1);
        stats[category].revenue += itemRevenue;
        stats[category].count += item.quantity;
        stats[category].items += 1;
      });
    });
    
    return Object.entries(stats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredEstimates]);

  // === СМЕТЫ ===

  // Общая сумма по сметам
  const totalRevenue = useMemo(() => {
    return filteredEstimates.reduce((sum, e) => sum + (e.total || 0), 0);
  }, [filteredEstimates]);

  // Средняя сумма сметы
  const avgEstimate = useMemo(() => {
    if (filteredEstimates.length === 0) return 0;
    return totalRevenue / filteredEstimates.length;
  }, [totalRevenue, filteredEstimates]);

  // Количество смет
  const estimateCount = filteredEstimates.length;

  // Динамика по месяцам
  const monthlyStats = useMemo(() => {
    const months: Record<string, { revenue: number; count: number }> = {};
    
    // Последние 12 месяцев
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { revenue: 0, count: 0 };
    }
    
    filteredEstimates.forEach(estimate => {
      if (estimate.event_date) {
        const d = new Date(estimate.event_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (months[key]) {
          months[key].revenue += estimate.total || 0;
          months[key].count += 1;
        }
      }
    });
    
    return Object.entries(months).map(([month, data]) => ({
      month: month.slice(5), // ММ
      year: month.slice(0, 4),
      ...data
    }));
  }, [filteredEstimates]);

  // === СКЛАД ===

  // Статистика по складу
  const warehouseStats = useMemo(() => {
    const totalItems = equipment.length;
    const totalQuantity = equipment.reduce((sum, e) => sum + (e.quantity || 0), 0);
    const totalValue = equipment.reduce((sum, e) => sum + (e.price || 0) * (e.quantity || 0), 0);
    const avgPrice = totalItems > 0 ? totalValue / totalQuantity : 0;
    
    return { totalItems, totalQuantity, totalValue, avgPrice };
  }, [equipment]);

  // === ПЕРСОНАЛ ===

  const staffStats = useMemo(() => {
    const active = staff.filter(s => s.is_active).length;
    const inactive = staff.filter(s => !s.is_active).length;
    const withCar = staff.filter(s => s.car_info && s.car_info.trim()).length;
    
    return { total: staff.length, active, inactive, withCar };
  }, [staff]);

  const formatCurrency = (val: number) => 
    val.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      {/* Заголовок и фильтр */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Аналитика
        </h2>
        <div className="flex gap-2">
          {(['all', 'year', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p === 'all' ? 'Всё время' : p === 'year' ? 'Год' : 'Месяц'}
            </button>
          ))}
        </div>
      </div>

      {/* Основные KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Выручка</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Смет</p>
                <p className="text-2xl font-bold">{estimateCount}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Средний чек</p>
                <p className="text-2xl font-bold">{formatCurrency(avgEstimate)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Позиций на складе</p>
                <p className="text-2xl font-bold">{warehouseStats.totalQuantity}</p>
              </div>
              <Package className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* График динамики */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Динамика по месяцам
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-end gap-2">
            {monthlyStats.map((m, i) => {
              const maxRevenue = Math.max(...monthlyStats.map(x => x.revenue)) || 1;
              const height = (m.revenue / maxRevenue) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600 relative group"
                    style={{ height: `${Math.max(height, 5)}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                      {formatCurrency(m.revenue)}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{m.month}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Топ категорий по прибыли */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Прибыль по категориям
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryStats.slice(0, 5).map((cat, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500 w-6">{i + 1}</span>
                    <span className="text-sm">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">{cat.count} шт</Badge>
                    <span className="text-sm font-medium">{formatCurrency(cat.revenue)}</span>
                  </div>
                </div>
              ))}
              {categoryStats.length === 0 && (
                <p className="text-center text-gray-500 py-4">Нет данных</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Топ оборудование по прибыли */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Топ оборудование по прибыли
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topEquipmentByRevenue.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500 w-6">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.category}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(item.revenue)}</span>
                </div>
              ))}
              {topEquipmentByRevenue.length === 0 && (
                <p className="text-center text-gray-500 py-4">Нет данных</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Топ оборудование по использованию */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5" />
              Часто используемое оборудование
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topEquipmentByUsage.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500 w-6">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.category}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">{item.count} раз</Badge>
                </div>
              ))}
              {topEquipmentByUsage.length === 0 && (
                <p className="text-center text-gray-500 py-4">Нет данных</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Статистика персонала */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Персонал
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold">{staffStats.total}</p>
                <p className="text-sm text-gray-500">Всего</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{staffStats.active}</p>
                <p className="text-sm text-gray-500">Активных</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold">{staffStats.withCar}</p>
                <p className="text-sm text-gray-500">С авто</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">{warehouseStats.totalItems}</p>
                <p className="text-sm text-gray-500">Видов оборудования</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Стоимость склада */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Стоимость складских запасов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Общая стоимость оборудования на складе</p>
              <p className="text-3xl font-bold text-blue-600">{formatCurrency(warehouseStats.totalValue)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Средняя цена за ед.</p>
              <p className="text-xl font-medium">{formatCurrency(warehouseStats.avgPrice)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
