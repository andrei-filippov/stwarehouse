import { useState, useMemo } from 'react';
import { Users, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Spinner } from '../ui/spinner';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import type { Staff } from '../../types';
import type { SalaryRecord, SalaryProject, SalaryPaymentEntry, PaymentType } from '../../hooks/useSalary';
import {
  PeriodSelector,
  AddProjectDialog,
  PaymentDialog,
  DeleteConfirmDialog,
  StaffSalaryCard,
  SalaryAnalyticsTable,
} from './salary';

interface SalaryTabProps {
  staff: Staff[];
  companyId?: string;
  records?: SalaryRecord[];
  onAddOrUpdate?: (record: Partial<SalaryRecord>) => Promise<{ error: any }>;
  onDelete?: (id: string) => Promise<{ error: any }>;
  loading?: boolean;
}

type PeriodMode = 'month' | 'range';
type SortField = 'name' | 'calculated' | 'paid' | 'balance';
type SortDir = 'asc' | 'desc';

export function SalaryTab({ staff, companyId, records = [], onAddOrUpdate, onDelete, loading }: SalaryTabProps) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [activeMonth, setActiveMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Helpers для работы с периодами ───

  // Проверяет, есть ли у записи выплата в указанном месяце
  const hasPaymentInMonth = (record: SalaryRecord, month: string): boolean => {
    if (!record.payments || record.payments.length === 0) return false;
    return record.payments.some(p => p.date.startsWith(month));
  };

  // Сумма выплат за указанный месяц
  const getPaidForMonth = (record: SalaryRecord, month: string): number => {
    if (!record.payments || record.payments.length === 0) return 0;
    return record.payments
      .filter(p => p.date.startsWith(month))
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  };

  // Сумма проектов за указанный месяц
  const getCalculatedForMonth = (record: SalaryRecord, month: string): number => {
    if (!record.projects || record.projects.length === 0) return record.total_calculated || 0;
    const projectSum = record.projects
      .filter(p => p.date.startsWith(month))
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    return projectSum > 0 ? projectSum : record.total_calculated || 0;
  };

  // Фильтрация записей по периоду
  const filteredRecords = useMemo(() => {
    if (periodMode === 'month') {
      // Показываем записи где month совпадает ИЛИ есть выплата в этом месяце
      return records.filter(r => r.month === activeMonth || hasPaymentInMonth(r, activeMonth));
    }
    // Для диапазона фильтруем по payment_date и датам проектов
    const s = new Date(startDate);
    const e = new Date(endDate);
    return records.filter(r => {
      // Проверяем даты выплат
      if (r.payments && r.payments.length > 0) {
        return r.payments.some(p => {
          const pd = new Date(p.date);
          return pd >= s && pd <= e;
        });
      }
      // Проверяем даты проектов
      if (r.projects && r.projects.length > 0) {
        return r.projects.some(p => {
          const pd = new Date(p.date);
          return pd >= s && pd <= e;
        });
      }
      // Fallback на месяц записи
      const rMonth = new Date(r.month + '-01');
      return rMonth >= s && rMonth <= e;
    });
  }, [records, periodMode, activeMonth, startDate, endDate]);

  // Получаем запись для сотрудника на текущий месяц
  // Сначала ищем по exact month, если нет — ищем запись с выплатой в этом месяце
  const getRecordForStaff = (staffId: string, month: string): SalaryRecord | undefined => {
    const exact = records.find(r => r.staff_id === staffId && r.month === month);
    if (exact) return exact;
    // Ищем любую запись сотрудника с выплатой в этом месяце
    return records.find(r => r.staff_id === staffId && hasPaymentInMonth(r, month));
  };

  // Добавить проект сотруднику
  const handleAddProject = async (data: { name: string; amount: number; date: string }) => {
    if (!selectedStaff || !onAddOrUpdate || !companyId) return;
    setIsSubmitting(true);

    const existingRecord = getRecordForStaff(selectedStaff.id, activeMonth);
    const baseSalary = selectedStaff.base_salary || 0;

    const projects: SalaryProject[] = existingRecord
      ? [...existingRecord.projects, data]
      : [data];

    // Если есть оклад и это первый проект — добавляем оклад как проект
    if (baseSalary > 0 && !existingRecord) {
      projects.unshift({
        name: 'Оклад',
        amount: baseSalary,
        date: activeMonth + '-01',
      });
    }

    const totalCalculated = projects.reduce((sum, p) => sum + p.amount, 0);

    await onAddOrUpdate({
      staff_id: selectedStaff.id,
      company_id: companyId,
      month: activeMonth,
      projects,
      payments: existingRecord?.payments || [],
      total_calculated: totalCalculated,
      paid: existingRecord?.paid || 0,
    });

    setIsSubmitting(false);
    setIsProjectDialogOpen(false);
    setSelectedStaff(null);
  };

  // Редактировать проект сотрудника
  const handleEditProject = async (staffId: string, projectIndex: number, data: { name: string; amount: number; date: string }) => {
    if (!onAddOrUpdate || !companyId) return;

    const existingRecord = getRecordForStaff(staffId, activeMonth);
    if (!existingRecord) return;

    const projects = existingRecord.projects.map((p, idx) =>
      idx === projectIndex ? data : p
    );

    const totalCalculated = projects.reduce((sum, p) => sum + p.amount, 0);

    await onAddOrUpdate({
      staff_id: staffId,
      company_id: companyId,
      month: activeMonth,
      projects,
      payments: existingRecord.payments || [],
      total_calculated: totalCalculated,
      paid: existingRecord.paid || 0,
    });
  };

  // Удалить проект сотрудника
  const handleDeleteProject = async (staffId: string, projectIndex: number) => {
    if (!onAddOrUpdate || !companyId) return;

    const existingRecord = getRecordForStaff(staffId, activeMonth);
    if (!existingRecord) return;

    const projects = existingRecord.projects.filter((_, idx) => idx !== projectIndex);

    const totalCalculated = projects.reduce((sum, p) => sum + p.amount, 0);

    await onAddOrUpdate({
      staff_id: staffId,
      company_id: companyId,
      month: activeMonth,
      projects,
      payments: existingRecord.payments || [],
      total_calculated: totalCalculated,
      paid: existingRecord.paid || 0,
    });
  };

  // Отметить выплату
  const handlePayment = async (data: { amount: number; date: string; type: PaymentType; notes?: string }) => {
    if (!selectedStaff || !onAddOrUpdate || !companyId) return;
    setIsSubmitting(true);

    const existingRecord = getRecordForStaff(selectedStaff.id, activeMonth);

    const newPayment: SalaryPaymentEntry = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      amount: data.amount,
      date: data.date,
      type: data.type,
      notes: data.notes,
    };

    const payments: SalaryPaymentEntry[] = existingRecord
      ? [...existingRecord.payments, newPayment]
      : [newPayment];

    const totalPaid = (existingRecord?.paid || 0) + data.amount;

    await onAddOrUpdate({
      staff_id: selectedStaff.id,
      company_id: companyId,
      month: activeMonth,
      projects: existingRecord?.projects || [],
      payments,
      total_calculated: existingRecord?.total_calculated || 0,
      paid: totalPaid,
      payment_date: data.date,
    });

    setIsSubmitting(false);
    setIsPaymentDialogOpen(false);
    setSelectedStaff(null);
  };

  // Удалить запись
  const handleDeleteClick = (recordId: string) => {
    setRecordToDelete(recordId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete || !onDelete || !companyId) return;
    await onDelete(recordToDelete);
    setIsDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  // Статистика по периоду
  const periodStats = useMemo(() => {
    if (periodMode === 'month') {
      const totalCalculated = filteredRecords.reduce((sum, r) => sum + getCalculatedForMonth(r, activeMonth), 0);
      const totalPaid = filteredRecords.reduce((sum, r) => sum + getPaidForMonth(r, activeMonth), 0);
      return { totalCalculated, totalPaid, balance: totalCalculated - totalPaid };
    }
    // Для диапазона — суммы за весь период записи
    const totalCalculated = filteredRecords.reduce((sum, r) => sum + r.total_calculated, 0);
    const totalPaid = filteredRecords.reduce((sum, r) => sum + r.paid, 0);
    return { totalCalculated, totalPaid, balance: totalCalculated - totalPaid };
  }, [filteredRecords, periodMode, activeMonth]);

  // Аналитика по сотрудникам за период
  const staffAnalytics = useMemo(() => {
    const map = new Map<string, {
      staff: Staff;
      projectsCount: number;
      paymentsCount: number;
      totalCalculated: number;
      totalPaid: number;
    }>();

    for (const record of filteredRecords) {
      const member = staff.find(s => s.id === record.staff_id);
      if (!member) continue;

      const calculated = periodMode === 'month' ? getCalculatedForMonth(record, activeMonth) : record.total_calculated;
      const paid = periodMode === 'month' ? getPaidForMonth(record, activeMonth) : record.paid;
      const projCount = periodMode === 'month'
        ? record.projects.filter(p => p.date.startsWith(activeMonth)).length
        : record.projects.length;
      const payCount = periodMode === 'month'
        ? record.payments.filter(p => p.date.startsWith(activeMonth)).length
        : record.payments.length;

      const existing = map.get(record.staff_id);
      if (existing) {
        existing.projectsCount += projCount;
        existing.paymentsCount += payCount;
        existing.totalCalculated += calculated;
        existing.totalPaid += paid;
      } else {
        map.set(record.staff_id, {
          staff: member,
          projectsCount: projCount,
          paymentsCount: payCount,
          totalCalculated: calculated,
          totalPaid: paid,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalCalculated - a.totalCalculated);
  }, [filteredRecords, staff, periodMode, activeMonth]);

  // Фильтрация и сортировка сотрудников
  // records убран из зависимостей для мягкого обновления — сортировка не сбрасывается при обновлении данных
  const filteredStaff = useMemo(() => {
    let result = staff.filter(s => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.position.toLowerCase().includes(q)
      );
    });

    result = [...result].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'name':
          return dir * a.full_name.localeCompare(b.full_name);
        case 'calculated': {
          const ra = getRecordForStaff(a.id, activeMonth);
          const rb = getRecordForStaff(b.id, activeMonth);
          const ca = ra ? getCalculatedForMonth(ra, activeMonth) : 0;
          const cb = rb ? getCalculatedForMonth(rb, activeMonth) : 0;
          return dir * (ca - cb);
        }
        case 'paid': {
          const ra = getRecordForStaff(a.id, activeMonth);
          const rb = getRecordForStaff(b.id, activeMonth);
          const pa = ra ? getPaidForMonth(ra, activeMonth) : 0;
          const pb = rb ? getPaidForMonth(rb, activeMonth) : 0;
          return dir * (pa - pb);
        }
        case 'balance': {
          const ra = getRecordForStaff(a.id, activeMonth);
          const rb = getRecordForStaff(b.id, activeMonth);
          const ca = ra ? getCalculatedForMonth(ra, activeMonth) : 0;
          const cb = rb ? getCalculatedForMonth(rb, activeMonth) : 0;
          const pa = ra ? getPaidForMonth(ra, activeMonth) : 0;
          const pb = rb ? getPaidForMonth(rb, activeMonth) : 0;
          return dir * ((ca - pa) - (cb - pb));
        }
        default:
          return 0;
      }
    });

    return result;
  }, [staff, searchQuery, sortField, sortDir, activeMonth]);

  const periodLabel = useMemo(() => {
    if (periodMode === 'month') {
      const [year, month] = activeMonth.split('-');
      const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    return `${format(parseISO(startDate), 'dd.MM.yyyy')} – ${format(parseISO(endDate), 'dd.MM.yyyy')}`;
  }, [periodMode, activeMonth, startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

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
      <PeriodSelector
        periodMode={periodMode}
        setPeriodMode={setPeriodMode}
        activeMonth={activeMonth}
        setActiveMonth={setActiveMonth}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
      />

      {/* Analytics Table */}
      <SalaryAnalyticsTable data={staffAnalytics} periodLabel={periodLabel} />

      {/* Staff List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-semibold">Сотрудники ({filteredStaff.length})</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            <select
              value={`${sortField}-${sortDir}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split('-') as [SortField, SortDir];
                setSortField(field);
                setSortDir(dir);
              }}
              className="border rounded-md px-2 py-2 text-sm bg-background"
            >
              <option value="name-asc">Имя А→Я</option>
              <option value="name-desc">Имя Я→А</option>
              <option value="calculated-desc">Начислено ↓</option>
              <option value="calculated-asc">Начислено ↑</option>
              <option value="paid-desc">Выдано ↓</option>
              <option value="balance-desc">Остаток ↓</option>
            </select>
          </div>
        </div>

        {staff.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Нет сотрудников</p>
            <p className="text-sm">Добавьте сотрудников во вкладке "Персонал"</p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Сотрудники не найдены</p>
            <p className="text-sm">Попробуйте изменить поисковый запрос</p>
          </div>
        ) : (
          filteredStaff.map((member) => {
            const record = getRecordForStaff(member.id, activeMonth);
            // Для режима "месяц" создаём адаптированную запись с суммами за выбранный месяц
            const adaptedRecord = record && periodMode === 'month'
              ? {
                  ...record,
                  total_calculated: getCalculatedForMonth(record, activeMonth),
                  paid: getPaidForMonth(record, activeMonth),
                  // Фильтруем проекты и выплаты за выбранный месяц для отображения
                  projects: record.projects.filter(p => p.date.startsWith(activeMonth)),
                  payments: record.payments.filter(p => p.date.startsWith(activeMonth)),
                }
              : record;
            return (
              <StaffSalaryCard
                key={member.id}
                member={member}
                record={adaptedRecord}
                activeMonth={activeMonth}
                onAddProject={(s) => {
                  setSelectedStaff(s);
                  setIsProjectDialogOpen(true);
                }}
                onPayment={(s) => {
                  setSelectedStaff(s);
                  setIsPaymentDialogOpen(true);
                }}
                onDelete={handleDeleteClick}
                onEditProject={handleEditProject}
                onDeleteProject={handleDeleteProject}
              />
            );
          })
        )}
      </div>

      {/* Dialogs */}
      <AddProjectDialog
        open={isProjectDialogOpen}
        onOpenChange={setIsProjectDialogOpen}
        staff={selectedStaff}
        onSubmit={handleAddProject}
      />

      <PaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        staff={selectedStaff}
        record={selectedStaff ? getRecordForStaff(selectedStaff.id, activeMonth) : undefined}
        onSubmit={handlePayment}
      />

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
