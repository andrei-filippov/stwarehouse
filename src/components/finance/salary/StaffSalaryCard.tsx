import { useState } from 'react';
import { Plus, Wallet, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible';
import type { Staff } from '../../../types';
import type { SalaryRecord } from '../../../hooks/useSalary';
import { getPaymentTypeLabel } from '../../../hooks/useSalary';
import { SalaryPayslipPrint } from './SalaryPayslipPrint';

interface StaffSalaryCardProps {
  member: Staff;
  record: SalaryRecord | undefined;
  activeMonth: string;
  onAddProject: (staff: Staff) => void;
  onPayment: (staff: Staff) => void;
  onDelete: (recordId: string) => void;
}

export function StaffSalaryCard({
  member,
  record,
  activeMonth,
  onAddProject,
  onPayment,
  onDelete,
}: StaffSalaryCardProps) {
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);

  const calculated = record?.total_calculated || 0;
  const paid = record?.paid || 0;
  const balance = calculated - paid;
  const projects = record?.projects || [];
  const payments = record?.payments || [];

  // Проверка просрочки: месяц прошёл и есть долг
  const now = new Date();
  const [year, month] = activeMonth.split('-').map(Number);
  const isPastMonth = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
  const isOverdue = isPastMonth && balance > 0;

  return (
    <Card className={`hover:shadow-md transition-shadow ${isOverdue ? 'border-red-300' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOverdue ? 'bg-red-500/20' : 'bg-indigo-500/20'}`}>
              <span className={`font-bold ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                {member.full_name?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{member.full_name || 'Без имени'}</p>
                {isOverdue && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Долг
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{member.position || 'Сотрудник'}</p>
              {member.base_salary && (
                <p className="text-xs text-muted-foreground">
                  Оклад: {member.base_salary.toLocaleString('ru-RU')} ₽
                </p>
              )}
              {(projects.length > 0 || payments.length > 0) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {projects.length > 0 && `${projects.length} проектов`}
                  {projects.length > 0 && payments.length > 0 && ' · '}
                  {payments.length > 0 && `${payments.length} выплат`}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Начислено</p>
              <p className="font-semibold">{calculated.toLocaleString('ru-RU')} ₽</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Выдано</p>
              <p className="font-semibold text-green-600 dark:text-green-400">{paid.toLocaleString('ru-RU')} ₽</p>
            </div>
            <div className="text-right min-w-[80px]">
              <p className="text-sm text-muted-foreground">Остаток</p>
              <Badge variant={balance <= 0 ? "default" : isOverdue ? "destructive" : "secondary"}>
                {balance.toLocaleString('ru-RU')} ₽
              </Badge>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddProject(member)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Проект
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPayment(member)}
              >
                <Wallet className="w-4 h-4 mr-1" />
                Выдано
              </Button>
              {record && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(record.id)}
                  className="text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Projects Detail */}
        {projects.length > 0 && (
          <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
            <CollapsibleTrigger asChild>
              <button className="mt-3 pt-3 border-t w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors">
                <span className="font-medium">Проекты ({projects.length})</span>
                {projectsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-1.5">
                {projects.map((project, idx) => (
                  <div key={idx} className="flex justify-between text-sm pl-4 py-1 hover:bg-muted/50 rounded">
                    <span className="text-muted-foreground">{project.name}</span>
                    <span className="font-medium">{project.amount.toLocaleString('ru-RU')} ₽</span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Payments History */}
        {payments.length > 0 && (
          <Collapsible open={paymentsOpen} onOpenChange={setPaymentsOpen}>
            <CollapsibleTrigger asChild>
              <button className={`mt-3 pt-3 border-t w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors ${!projects.length ? 'mt-3 pt-3 border-t' : ''}`}>
                <span className="font-medium">История выплат ({payments.length})</span>
                {paymentsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-1.5">
                {payments.map((payment, idx) => (
                  <div key={idx} className="flex justify-between text-sm pl-4 py-1 hover:bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs h-5">
                        {getPaymentTypeLabel(payment.type)}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(payment.date).toLocaleDateString('ru-RU')}
                      </span>
                      {payment.notes && (
                        <span className="text-xs text-muted-foreground">({payment.notes})</span>
                      )}
                    </div>
                    <span className="font-medium text-green-600">{payment.amount.toLocaleString('ru-RU')} ₽</span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Payslip link */}
        <div className="mt-3 pt-2 border-t flex justify-end">
          <SalaryPayslipPrint staff={member} record={record} month={activeMonth} />
        </div>
      </CardContent>
    </Card>
  );
}
