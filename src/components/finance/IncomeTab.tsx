import { useState, useMemo, useEffect } from 'react';
import { Plus, FileText, CheckCircle2, Clock, Calendar, Trash2, TrendingUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Estimate } from '../../types';

interface IncomeTabProps {
  estimates: Estimate[];
  companyId?: string;
}

interface ManualIncome {
  id: string;
  date: string;
  source: string;
  amount: number;
  description?: string;
}

type IncomeFilter = 'all' | 'estimates' | 'manual' | 'pending';

export function IncomeTab({ estimates, companyId }: IncomeTabProps) {
  // Загружаем из localStorage при инициализации
  const [manualIncomes, setManualIncomes] = useState<ManualIncome[]>(() => {
    if (!companyId) return [];
    const saved = localStorage.getItem(`income_manual_${companyId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [activeFilter, setActiveFilter] = useState<IncomeFilter>('all');

  // Сохраняем в localStorage при изменении
  useEffect(() => {
    if (companyId) {
      localStorage.setItem(`income_manual_${companyId}`, JSON.stringify(manualIncomes));
    }
  }, [manualIncomes, companyId]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newIncome, setNewIncome] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    source: '',
    amount: '',
    description: ''
  });

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

  const totalEstimateIncome = estimateIncomes.reduce((sum, i) => sum + i.amount, 0);
  const totalManualIncome = manualIncomes.reduce((sum, i) => sum + i.amount, 0);
  const totalPendingIncome = pendingIncomes.reduce((sum, i) => sum + i.amount, 0);

  const handleAddIncome = () => {
    if (!newIncome.source || !newIncome.amount) return;
    
    const income: ManualIncome = {
      id: `manual_${Date.now()}`,
      date: newIncome.date,
      source: newIncome.source,
      amount: parseFloat(newIncome.amount),
      description: newIncome.description
    };
    
    setManualIncomes(prev => [income, ...prev]);
    setNewIncome({
      date: format(new Date(), 'yyyy-MM-dd'),
      source: '',
      amount: '',
      description: ''
    });
    setIsDialogOpen(false);
  };

  const handleDeleteIncome = (id: string) => {
    setManualIncomes(prev => prev.filter(income => income.id !== id));
  };

  return (
    <div className="space-y-6">
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
            <CardTitle className="text-sm text-foreground">Всего</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {(totalEstimateIncome + totalManualIncome).toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-muted-foreground">
              {estimateIncomes.length + manualIncomes.length} записей
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
            <CardTitle className="text-sm text-green-700 dark:text-green-300">Получено (сметы)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {totalEstimateIncome.toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-green-600 dark:text-green-400">{estimateIncomes.length} завершенных смет</p>
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
            <CardTitle className="text-sm text-blue-700 dark:text-blue-300">Ручные поступления</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {totalManualIncome.toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">{manualIncomes.length} записей</p>
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
              {totalPendingIncome.toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">{pendingIncomes.length} ожидают оплаты</p>
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
            className="cursor-pointer hover:bg-gray-100"
            onClick={() => setActiveFilter('all')}
          >
            {activeFilter === 'estimates' && 'Получено от смет'}
            {activeFilter === 'manual' && 'Ручные поступления'}
            {activeFilter === 'pending' && 'Ожидается'}
            <span className="ml-1">×</span>
          </Badge>
        </div>
      )}

      {/* Income List */}
      <div className="space-y-4">
        {/* From Estimates */}
        {(activeFilter === 'all' || activeFilter === 'estimates') && estimateIncomes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-500">От смет</h4>
            {estimateIncomes.map((income) => (
              <Card key={income.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{income.source}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(income.date), 'dd MMMM yyyy', { locale: ru })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        +{income.amount.toLocaleString('ru-RU')} ₽
                      </p>
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Получено
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Manual Incomes */}
        {(activeFilter === 'all' || activeFilter === 'manual') && manualIncomes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-500">Ручные поступления</h4>
            {manualIncomes.map((income) => (
              <Card key={income.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Plus className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{income.source}</p>
                        {income.description && (
                          <p className="text-sm text-muted-foreground">{income.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(income.date), 'dd MMMM yyyy', { locale: ru })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        +{income.amount.toLocaleString('ru-RU')} ₽
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteIncome(income.id)}
                        className="text-gray-400 hover:text-red-500 mt-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pending */}
        {(activeFilter === 'all' || activeFilter === 'pending') && pendingIncomes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-500">Ожидается оплата</h4>
            {pendingIncomes.map((income) => (
              <Card key={income.id} className="hover:shadow-md transition-shadow opacity-70">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{income.source}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(income.date), 'dd MMMM yyyy', { locale: ru })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                        {income.amount.toLocaleString('ru-RU')} ₽
                      </p>
                      <Badge variant="outline" className="text-amber-600 border-amber-200">
                        <Clock className="w-3 h-3 mr-1" />
                        Ожидается
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {(
          (activeFilter === 'all' && estimateIncomes.length === 0 && manualIncomes.length === 0 && pendingIncomes.length === 0) ||
          (activeFilter === 'estimates' && estimateIncomes.length === 0) ||
          (activeFilter === 'manual' && manualIncomes.length === 0) ||
          (activeFilter === 'pending' && pendingIncomes.length === 0)
        ) && (
          <div className="text-center py-12 text-muted-foreground">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              {activeFilter === 'all' && 'Нет данных о поступлениях'}
              {activeFilter === 'estimates' && 'Нет полученных доходов от смет'}
              {activeFilter === 'manual' && 'Нет ручных поступлений'}
              {activeFilter === 'pending' && 'Нет ожидаемых поступлений'}
            </p>
            <p className="text-sm">
              {activeFilter === 'all' && 'Завершите сметы или добавьте поступления вручную'}
              {activeFilter !== 'all' && 'Выберите другой фильтр или добавьте запись'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
