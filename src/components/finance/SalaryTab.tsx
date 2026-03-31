import { useState, useMemo } from 'react';
import { Users, Calendar, CheckCircle2, DollarSign, Plus, Wallet, Trash2, BarChart3 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Staff } from '../../types';
import type { SalaryRecord, SalaryProject } from '../../hooks/useSalary';

interface SalaryTabProps {
  staff: Staff[];
  companyId?: string;
  records?: SalaryRecord[];
  onAddOrUpdate?: (record: Partial<SalaryRecord>) => Promise<{ error: any }>;
  onDelete?: (id: string) => Promise<{ error: any }>;
}

type PeriodMode = 'month' | 'range';

export function SalaryTab({ staff, records = [], onAddOrUpdate, onDelete }: SalaryTabProps) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [activeMonth, setActiveMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [newProject, setNewProject] = useState({ name: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Фильтрация записей по периоду
  const filteredRecords = useMemo(() => {
    if (periodMode === 'month') {
      return records.filter(r => r.month === activeMonth);
    }
    const start = startDate.slice(0, 7); // yyyy-MM
    const end = endDate.slice(0, 7);
    return records.filter(r => r.month >= start && r.month <= end);
  }, [records, periodMode, activeMonth, startDate, endDate]);

  // Получаем запись для сотрудника на текущий месяц (для диалогов)
  const getRecordForStaff = (staffId: string, month: string): SalaryRecord | undefined => {
    return records.find(r => r.staff_id === staffId && r.month === month);
  };

  // Добавить проект сотруднику
  const handleAddProject = async () => {
    if (!selectedStaff || !newProject.name || !newProject.amount || !onAddOrUpdate) return;
    
    setIsSubmitting(true);
    const projectAmount = parseFloat(newProject.amount);
    const existingRecord = getRecordForStaff(selectedStaff.id, activeMonth);
    
    const projects: SalaryProject[] = existingRecord 
      ? [...existingRecord.projects, { name: newProject.name, amount: projectAmount, date: newProject.date }]
      : [{ name: newProject.name, amount: projectAmount, date: newProject.date }];
    
    const totalCalculated = projects.reduce((sum, p) => sum + p.amount, 0);
    
    await onAddOrUpdate({
      staff_id: selectedStaff.id,
      month: activeMonth,
      projects,
      total_calculated: totalCalculated,
      paid: existingRecord?.paid || 0
    });
    
    setIsSubmitting(false);
    setNewProject({ name: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') });
    setIsProjectDialogOpen(false);
  };

  // Отметить выплату
  const handlePayment = async () => {
    if (!selectedStaff || !paymentAmount || !onAddOrUpdate) return;
    
    setIsSubmitting(true);
    const amount = parseFloat(paymentAmount);
    const existingRecord = getRecordForStaff(selectedStaff.id, activeMonth);
    
    await onAddOrUpdate({
      staff_id: selectedStaff.id,
      month: activeMonth,
      projects: existingRecord?.projects || [],
      total_calculated: existingRecord?.total_calculated || 0,
      paid: (existingRecord?.paid || 0) + amount,
      payment_date: format(new Date(), 'yyyy-MM-dd')
    });
    
    setIsSubmitting(false);
    setPaymentAmount('');
    setIsPaymentDialogOpen(false);
  };

  // Удалить запись
  const handleDelete = async (recordId: string) => {
    if (!onDelete) return;
    await onDelete(recordId);
  };

  // Статистика по периоду
  const periodStats = useMemo(() => {
    const totalCalculated = filteredRecords.reduce((sum, r) => sum + r.total_calculated, 0);
    const totalPaid = filteredRecords.reduce((sum, r) => sum + r.paid, 0);
    return { totalCalculated, totalPaid, balance: totalCalculated - totalPaid };
  }, [filteredRecords]);

  // Аналитика по сотрудникам за период
  const staffAnalytics = useMemo(() => {
    const map = new Map<string, {
      staff: Staff;
      projectsCount: number;
      totalCalculated: number;
      totalPaid: number;
    }>();

    for (const record of filteredRecords) {
      const member = staff.find(s => s.id === record.staff_id);
      if (!member) continue;

      const existing = map.get(record.staff_id);
      if (existing) {
        existing.projectsCount += record.projects.length;
        existing.totalCalculated += record.total_calculated;
        existing.totalPaid += record.paid;
      } else {
        map.set(record.staff_id, {
          staff: member,
          projectsCount: record.projects.length,
          totalCalculated: record.total_calculated,
          totalPaid: record.paid,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalCalculated - a.totalCalculated);
  }, [filteredRecords, staff]);

  // Генерация списка месяцев
  const months = useMemo(() => {
    const list = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      list.push(format(date, 'yyyy-MM'));
    }
    return list;
  }, []);

  const periodLabel = useMemo(() => {
    if (periodMode === 'month') {
      const [year, month] = activeMonth.split('-');
      const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    return `${format(parseISO(startDate), 'dd.MM.yyyy')} – ${format(parseISO(endDate), 'dd.MM.yyyy')}`;
  }, [periodMode, activeMonth, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Period Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-500/10 border-blue-500/20 dark:bg-blue-500/10 dark:border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-700 dark:text-blue-300">Начислено</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {periodStats.totalCalculated.toLocaleString('ru-RU')} ₽
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/10 border-green-500/20 dark:bg-green-500/10 dark:border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700 dark:text-green-300">Выдано</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {periodStats.totalPaid.toLocaleString('ru-RU')} ₽
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${periodStats.balance >= 0 ? 'bg-amber-500/10 border-amber-500/20 dark:bg-amber-500/10 dark:border-amber-500/30' : 'bg-red-500/10 border-red-500/20 dark:bg-red-500/10 dark:border-red-500/30'}`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm ${periodStats.balance >= 0 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
              Остаток к выдаче
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${periodStats.balance >= 0 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
              {periodStats.balance.toLocaleString('ru-RU')} ₽
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant={periodMode === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriodMode('month')}
              >
                Месяц
              </Button>
              <Button
                variant={periodMode === 'range' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriodMode('range')}
              >
                Период
              </Button>
            </div>

            {periodMode === 'month' ? (
              <select
                value={activeMonth}
                onChange={(e) => setActiveMonth(e.target.value)}
                className="border rounded-md px-3 py-2"
              >
                {months.map(m => {
                  const [year, month] = m.split('-');
                  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
                  const monthName = monthNames[parseInt(month) - 1];
                  return (
                    <option key={m} value={m}>
                      {monthName} {year}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-auto"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-auto"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analytics Table */}
      {staffAnalytics.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Аналитика за период: {periodLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Сотрудник</th>
                    <th className="text-center px-4 py-2 font-medium">Проекты</th>
                    <th className="text-right px-4 py-2 font-medium">Начислено</th>
                    <th className="text-right px-4 py-2 font-medium">Выдано</th>
                    <th className="text-right px-4 py-2 font-medium">Остаток</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {staffAnalytics.map(({ staff: member, projectsCount, totalCalculated, totalPaid }) => {
                    const balance = totalCalculated - totalPaid;
                    return (
                      <tr key={member.id} className="hover:bg-muted/50">
                        <td className="px-4 py-2">
                          <div className="font-medium">{member.full_name || 'Без имени'}</div>
                          <div className="text-xs text-muted-foreground">{member.position || 'Сотрудник'}</div>
                        </td>
                        <td className="px-4 py-2 text-center">{projectsCount}</td>
                        <td className="px-4 py-2 text-right">{totalCalculated.toLocaleString('ru-RU')} ₽</td>
                        <td className="px-4 py-2 text-right text-green-600">{totalPaid.toLocaleString('ru-RU')} ₽</td>
                        <td className="px-4 py-2 text-right">
                          <span className={balance > 0 ? 'text-amber-600' : balance < 0 ? 'text-red-600' : ''}>
                            {balance.toLocaleString('ru-RU')} ₽
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/70 font-medium">
                    <td className="px-4 py-2">Итого</td>
                    <td className="px-4 py-2 text-center">
                      {staffAnalytics.reduce((sum, s) => sum + s.projectsCount, 0)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {staffAnalytics.reduce((sum, s) => sum + s.totalCalculated, 0).toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-4 py-2 text-right text-green-700">
                      {staffAnalytics.reduce((sum, s) => sum + s.totalPaid, 0).toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-4 py-2 text-right">
                      {staffAnalytics.reduce((sum, s) => sum + (s.totalCalculated - s.totalPaid), 0).toLocaleString('ru-RU')} ₽
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Сотрудники ({staff.length})</h3>
        
        {staff.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Нет сотрудников</p>
            <p className="text-sm">Добавьте сотрудников во вкладке "Персонал"</p>
          </div>
        ) : (
          staff.map((member) => {
            const record = getRecordForStaff(member.id, activeMonth);
            const balance = (record?.total_calculated || 0) - (record?.paid || 0);
            
            return (
              <Card key={member.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {member.full_name?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{member.full_name || 'Без имени'}</p>
                        <p className="text-sm text-muted-foreground">{member.position || 'Сотрудник'}</p>
                        {record?.projects && record.projects.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {record.projects.length} проектов
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Начислено</p>
                        <p className="font-semibold">{record?.total_calculated?.toLocaleString('ru-RU') || 0} ₽</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Выдано</p>
                        <p className="font-semibold text-green-600 dark:text-green-400">{record?.paid?.toLocaleString('ru-RU') || 0} ₽</p>
                      </div>
                      <div className="text-right min-w-[80px]">
                        <p className="text-sm text-muted-foreground">Остаток</p>
                        <Badge variant={balance <= 0 ? "default" : "secondary"}>
                          {balance.toLocaleString('ru-RU')} ₽
                        </Badge>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedStaff(member);
                            setIsProjectDialogOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Проект
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedStaff(member);
                            setIsPaymentDialogOpen(true);
                          }}
                        >
                          <Wallet className="w-4 h-4 mr-1" />
                          Выдано
                        </Button>
                        {record && onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(record.id)}
                            className="text-muted-foreground hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Projects Detail */}
                  {record && record.projects.length > 0 && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <p className="text-sm font-medium text-gray-500">Проекты:</p>
                      {record.projects.map((project, idx) => (
                        <div key={idx} className="flex justify-between text-sm pl-4">
                          <span>{project.name}</span>
                          <span className="font-medium">{project.amount.toLocaleString('ru-RU')} ₽</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add Project Dialog */}
      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Добавить проект - {selectedStaff?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Название проекта / мероприятия</Label>
              <Input
                placeholder="Например: Концерт в Крокусе"
                value={newProject.name}
                onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Сумма (₽)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newProject.amount}
                  onChange={(e) => setNewProject(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Дата</Label>
                <Input
                  type="date"
                  value={newProject.date}
                  onChange={(e) => setNewProject(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
            </div>
            <Button 
              onClick={handleAddProject} 
              className="w-full"
              disabled={isSubmitting || !newProject.name || !newProject.amount}
            >
              {isSubmitting ? 'Сохранение...' : 'Добавить проект'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Отметить выплату - {selectedStaff?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {selectedStaff && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p>Начислено: {getRecordForStaff(selectedStaff.id, activeMonth)?.total_calculated?.toLocaleString('ru-RU') || 0} ₽</p>
                <p>Уже выдано: {getRecordForStaff(selectedStaff.id, activeMonth)?.paid?.toLocaleString('ru-RU') || 0} ₽</p>
                <p className="font-medium">
                  Остаток: {((getRecordForStaff(selectedStaff.id, activeMonth)?.total_calculated || 0) - 
                    (getRecordForStaff(selectedStaff.id, activeMonth)?.paid || 0)).toLocaleString('ru-RU')} ₽
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Сумма выплаты (₽)</Label>
              <Input
                type="number"
                placeholder="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <Button 
              onClick={handlePayment} 
              className="w-full"
              disabled={isSubmitting || !paymentAmount}
            >
              {isSubmitting ? 'Сохранение...' : 'Отметить как выдано'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
