import { useState, useMemo } from 'react';
import { Users, Calendar, CheckCircle2, DollarSign, Plus, Wallet, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { format } from 'date-fns';
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

export function SalaryTab({ staff, records = [], onAddOrUpdate, onDelete }: SalaryTabProps) {
  const [activeMonth, setActiveMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [newProject, setNewProject] = useState({ name: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Получаем запись для сотрудника на текущий месяц
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

  // Статистика по месяцу
  const monthStats = useMemo(() => {
    const monthRecords = records.filter(r => r.month === activeMonth);
    const totalCalculated = monthRecords.reduce((sum, r) => sum + r.total_calculated, 0);
    const totalPaid = monthRecords.reduce((sum, r) => sum + r.paid, 0);
    return { totalCalculated, totalPaid, balance: totalCalculated - totalPaid };
  }, [records, activeMonth]);

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

  return (
    <div className="space-y-6">
      {/* Month Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-700">Начислено</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">
              {monthStats.totalCalculated.toLocaleString('ru-RU')} ₽
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700">Выдано</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">
              {monthStats.totalPaid.toLocaleString('ru-RU')} ₽
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${monthStats.balance >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm ${monthStats.balance >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
              Остаток к выдаче
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthStats.balance >= 0 ? 'text-amber-900' : 'text-red-900'}`}>
              {monthStats.balance.toLocaleString('ru-RU')} ₽
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-4">
        <Label>Месяц:</Label>
        <select
          value={activeMonth}
          onChange={(e) => setActiveMonth(e.target.value)}
          className="border rounded-md px-3 py-2"
        >
          {months.map(m => (
            <option key={m} value={m}>
              {format(new Date(m + '-01'), 'MMMM yyyy', { locale: ru })}
            </option>
          ))}
        </select>
      </div>

      {/* Staff List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Сотрудники ({staff.length})</h3>
        
        {staff.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="font-bold text-indigo-600">
                          {member.full_name?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{member.full_name || 'Без имени'}</p>
                        <p className="text-sm text-gray-500">{member.position || 'Сотрудник'}</p>
                        {record?.projects && record.projects.length > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            {record.projects.length} проектов
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Начислено</p>
                        <p className="font-semibold">{record?.total_calculated?.toLocaleString('ru-RU') || 0} ₽</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Выдано</p>
                        <p className="font-semibold text-green-600">{record?.paid?.toLocaleString('ru-RU') || 0} ₽</p>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p className="text-sm text-gray-500">Остаток</p>
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
                            className="text-gray-400 hover:text-red-500"
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
        <DialogContent>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отметить выплату - {selectedStaff?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {selectedStaff && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
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
