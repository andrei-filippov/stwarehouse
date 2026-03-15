import { useState, useMemo } from 'react';
import { Users, Calendar, CheckCircle2, DollarSign, Plus, Wallet } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Staff } from '../../types';

interface SalaryTabProps {
  staff: Staff[];
  companyId?: string;
}

interface SalaryRecord {
  id: string;
  staffId: string;
  month: string; // YYYY-MM
  projects: {
    name: string;
    amount: number;
    date: string;
  }[];
  totalCalculated: number;
  paid: number;
  paymentDate?: string;
  notes?: string;
}

export function SalaryTab({ staff, companyId }: SalaryTabProps) {
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [activeMonth, setActiveMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [newProject, setNewProject] = useState({ name: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [paymentAmount, setPaymentAmount] = useState('');

  // Получаем запись для сотрудника на текущий месяц
  const getRecordForStaff = (staffId: string, month: string): SalaryRecord | undefined => {
    return salaryRecords.find(r => r.staffId === staffId && r.month === month);
  };

  // Добавить проект сотруднику
  const handleAddProject = () => {
    if (!selectedStaff || !newProject.name || !newProject.amount) return;
    
    const projectAmount = parseFloat(newProject.amount);
    const existingRecord = getRecordForStaff(selectedStaff.id, activeMonth);
    
    if (existingRecord) {
      // Обновляем существующую запись
      setSalaryRecords(prev => prev.map(r => {
        if (r.id === existingRecord.id) {
          return {
            ...r,
            projects: [...r.projects, {
              name: newProject.name,
              amount: projectAmount,
              date: newProject.date
            }],
            totalCalculated: r.totalCalculated + projectAmount
          };
        }
        return r;
      }));
    } else {
      // Создаем новую запись
      const newRecord: SalaryRecord = {
        id: `sal_${Date.now()}`,
        staffId: selectedStaff.id,
        month: activeMonth,
        projects: [{
          name: newProject.name,
          amount: projectAmount,
          date: newProject.date
        }],
        totalCalculated: projectAmount,
        paid: 0
      };
      setSalaryRecords(prev => [...prev, newRecord]);
    }
    
    setNewProject({ name: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') });
    setIsProjectDialogOpen(false);
  };

  // Отметить выплату
  const handlePayment = () => {
    if (!selectedStaff || !paymentAmount) return;
    
    const amount = parseFloat(paymentAmount);
    const existingRecord = getRecordForStaff(selectedStaff.id, activeMonth);
    
    if (existingRecord) {
      setSalaryRecords(prev => prev.map(r => {
        if (r.id === existingRecord.id) {
          return {
            ...r,
            paid: r.paid + amount,
            paymentDate: format(new Date(), 'yyyy-MM-dd')
          };
        }
        return r;
      }));
    } else {
      // Создаем запись с нулевым начислением но с выплатой (аванс)
      const newRecord: SalaryRecord = {
        id: `sal_${Date.now()}`,
        staffId: selectedStaff.id,
        month: activeMonth,
        projects: [],
        totalCalculated: 0,
        paid: amount,
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        notes: 'Аванс'
      };
      setSalaryRecords(prev => [...prev, newRecord]);
    }
    
    setPaymentAmount('');
    setIsPaymentDialogOpen(false);
  };

  // Статистика по месяцу
  const monthStats = useMemo(() => {
    const monthRecords = salaryRecords.filter(r => r.month === activeMonth);
    const totalCalculated = monthRecords.reduce((sum, r) => sum + r.totalCalculated, 0);
    const totalPaid = monthRecords.reduce((sum, r) => sum + r.paid, 0);
    return { totalCalculated, totalPaid, balance: totalCalculated - totalPaid };
  }, [salaryRecords, activeMonth]);

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
            const balance = (record?.totalCalculated || 0) - (record?.paid || 0);
            
            return (
              <Card key={member.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="font-bold text-indigo-600">
                          {(member as any).full_name?.charAt(0).toUpperCase() || (member as any).name?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{(member as any).full_name || (member as any).name || 'Без имени'}</p>
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
                        <p className="font-semibold">{record?.totalCalculated?.toLocaleString('ru-RU') || 0} ₽</p>
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
            <DialogTitle>Добавить проект - {selectedStaff?.name}</DialogTitle>
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
            <Button onClick={handleAddProject} className="w-full">
              Добавить проект
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отметить выплату - {selectedStaff?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {selectedStaff && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <p>Начислено: {getRecordForStaff(selectedStaff.id, activeMonth)?.totalCalculated?.toLocaleString('ru-RU') || 0} ₽</p>
                <p>Уже выдано: {getRecordForStaff(selectedStaff.id, activeMonth)?.paid?.toLocaleString('ru-RU') || 0} ₽</p>
                <p className="font-medium">
                  Остаток: {((getRecordForStaff(selectedStaff.id, activeMonth)?.totalCalculated || 0) - 
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
            <Button onClick={handlePayment} className="w-full">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Отметить как выдано
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
