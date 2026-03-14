import { useState, useMemo } from 'react';
import { Plus, FileText, CheckCircle2, Clock, Calendar } from 'lucide-react';
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

export function IncomeTab({ estimates, companyId }: IncomeTabProps) {
  const [manualIncomes, setManualIncomes] = useState<ManualIncome[]>([]);
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
        amount: e.total_price || 0,
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
        amount: e.total_price || 0,
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

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700">Получено (сметы)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">
              {totalEstimateIncome.toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-green-600">{estimateIncomes.length} завершенных смет</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-700">Ручные поступления</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">
              {totalManualIncome.toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-blue-600">{manualIncomes.length} записей</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-700">Ожидается</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">
              {totalPendingIncome.toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-amber-600">{pendingIncomes.length} ожидают оплаты</p>
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
          <DialogContent>
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

      {/* Income List */}
      <div className="space-y-4">
        {/* From Estimates */}
        {estimateIncomes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-500">От смет</h4>
            {estimateIncomes.map((income) => (
              <Card key={income.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">{income.source}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(income.date), 'dd MMMM yyyy', { locale: ru })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
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
        {manualIncomes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-500">Ручные поступления</h4>
            {manualIncomes.map((income) => (
              <Card key={income.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Plus className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{income.source}</p>
                        {income.description && (
                          <p className="text-sm text-gray-500">{income.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(income.date), 'dd MMMM yyyy', { locale: ru })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">
                        +{income.amount.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pending */}
        {pendingIncomes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-500">Ожидается оплата</h4>
            {pendingIncomes.map((income) => (
              <Card key={income.id} className="hover:shadow-md transition-shadow opacity-70">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium">{income.source}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(income.date), 'dd MMMM yyyy', { locale: ru })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-600">
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

        {estimateIncomes.length === 0 && manualIncomes.length === 0 && pendingIncomes.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Нет данных о поступлениях</p>
            <p className="text-sm">Завершите сметы или добавьте поступления вручную</p>
          </div>
        )}
      </div>
    </div>
  );
}
