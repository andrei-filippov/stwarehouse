import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import type { Staff } from '../../../types';
import type { SalaryRecord } from '../../../hooks/useSalary';

interface StaffAnalyticsItem {
  staff: Staff;
  projectsCount: number;
  paymentsCount: number;
  totalCalculated: number;
  totalPaid: number;
}

interface SalaryAnalyticsTableProps {
  data: StaffAnalyticsItem[];
  periodLabel: string;
}

export function SalaryAnalyticsTable({ data, periodLabel }: SalaryAnalyticsTableProps) {
  if (data.length === 0) return null;

  const totalProjects = data.reduce((sum, s) => sum + s.projectsCount, 0);
  const totalPayments = data.reduce((sum, s) => sum + s.paymentsCount, 0);
  const totalCalculated = data.reduce((sum, s) => sum + s.totalCalculated, 0);
  const totalPaid = data.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalBalance = totalCalculated - totalPaid;

  return (
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
                <th className="text-center px-4 py-2 font-medium">Выплаты</th>
                <th className="text-right px-4 py-2 font-medium">Начислено</th>
                <th className="text-right px-4 py-2 font-medium">Выдано</th>
                <th className="text-right px-4 py-2 font-medium">Остаток</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map(({ staff: member, projectsCount, paymentsCount, totalCalculated, totalPaid }) => {
                const balance = totalCalculated - totalPaid;
                return (
                  <tr key={member.id} className="hover:bg-muted/50">
                    <td className="px-4 py-2">
                      <div className="font-medium">{member.full_name || 'Без имени'}</div>
                      <div className="text-xs text-muted-foreground">{member.position || 'Сотрудник'}</div>
                    </td>
                    <td className="px-4 py-2 text-center">{projectsCount}</td>
                    <td className="px-4 py-2 text-center">{paymentsCount}</td>
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
                <td className="px-4 py-2 text-center">{totalProjects}</td>
                <td className="px-4 py-2 text-center">{totalPayments}</td>
                <td className="px-4 py-2 text-right">{totalCalculated.toLocaleString('ru-RU')} ₽</td>
                <td className="px-4 py-2 text-right text-green-700">{totalPaid.toLocaleString('ru-RU')} ₽</td>
                <td className="px-4 py-2 text-right">
                  <span className={totalBalance > 0 ? 'text-amber-700' : totalBalance < 0 ? 'text-red-700' : ''}>
                    {totalBalance.toLocaleString('ru-RU')} ₽
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
