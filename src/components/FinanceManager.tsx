import { useState } from 'react';
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

interface FinanceManagerProps {
  estimates: Estimate[];
  staff: Staff[];
  expenses: Expense[];
  companyId?: string;
}

export function FinanceManager({ estimates, staff, expenses, companyId }: FinanceManagerProps) {
  const [activeTab, setActiveTab] = useState('income');

  // Фильтруем подтвержденные/завершенные сметы для доходов
  const completedEstimates = estimates.filter(e => 
    e.status === 'completed' || e.status === 'pending'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Финансы</h1>
          <p className="text-gray-500 mt-1">Управление доходами, расходами и зарплатами</p>
        </div>

      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Доходы (мес)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">0 ₽</div>
            <p className="text-xs text-green-600 mt-1">+0% к прошлому месяцу</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Расходы (мес)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900">0 ₽</div>
            <p className="text-xs text-red-600 mt-1">+0% к прошлому месяцу</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Зарплаты (мес)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">0 ₽</div>
            <p className="text-xs text-blue-600 mt-1">{staff.length} сотрудников</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Прибыль (мес)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">0 ₽</div>
            <p className="text-xs text-purple-600 mt-1">Маржа: 0%</p>
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
          <IncomeTab estimates={completedEstimates} companyId={companyId} />
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <ExpensesTab expenses={expenses} companyId={companyId} />
        </TabsContent>

        <TabsContent value="salary" className="space-y-4">
          <SalaryTab staff={staff} companyId={companyId} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AnalyticsTab estimates={estimates} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
