import type { Staff } from '../../../types';
import type { SalaryRecord, SalaryPaymentEntry } from '../../../hooks/useSalary';
import { getPaymentTypeLabel } from '../../../hooks/useSalary';

interface SalaryPayslipPrintProps {
  staff: Staff;
  record: SalaryRecord | undefined;
  month: string;
}

export function SalaryPayslipPrint({ staff, record, month }: SalaryPayslipPrintProps) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const [year, mon] = month.split('-');
    const monthNames = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    const monthLabel = `${monthNames[parseInt(mon) - 1]} ${year}`;

    const projects = record?.projects || [];
    const payments = record?.payments || [];
    const calculated = record?.total_calculated || 0;
    const paid = record?.paid || 0;
    const balance = calculated - paid;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Расчётный листок — ${staff.full_name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 30px; color: #333; }
          h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
          h2 { text-align: center; font-size: 14px; color: #666; margin-bottom: 20px; font-weight: normal; }
          .info { margin-bottom: 20px; font-size: 13px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .info-label { color: #666; }
          .info-value { font-weight: 500; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
          th { background: #f0f0f0; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
          td { padding: 6px 8px; border-bottom: 1px solid #eee; }
          .text-right { text-align: right; }
          .summary { background: #f8f8f8; padding: 15px; border-radius: 6px; margin-top: 20px; }
          .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
          .summary-row.total { font-size: 15px; font-weight: bold; border-top: 2px solid #ddd; padding-top: 10px; margin-top: 10px; }
          .footer { margin-top: 40px; font-size: 11px; color: #999; text-align: center; }
          @media print {
            body { margin: 15px; }
          }
        </style>
      </head>
      <body>
        <h1>РАСЧЁТНЫЙ ЛИСТОК</h1>
        <h2>${monthLabel}</h2>
        
        <div class="info">
          <div class="info-row">
            <span class="info-label">Сотрудник:</span>
            <span class="info-value">${staff.full_name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Должность:</span>
            <span class="info-value">${staff.position || '-'}</span>
          </div>
          ${staff.base_salary ? `
          <div class="info-row">
            <span class="info-label">Оклад:</span>
            <span class="info-value">${staff.base_salary.toLocaleString('ru-RU')} ₽</span>
          </div>
          ` : ''}
        </div>

        ${projects.length > 0 ? `
        <h3 style="font-size: 13px; margin-bottom: 8px;">Начисления по проектам</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Проект / мероприятие</th>
              <th>Дата</th>
              <th class="text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            ${projects.map((p, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${p.name}</td>
                <td>${new Date(p.date).toLocaleDateString('ru-RU')}</td>
                <td class="text-right">${p.amount.toLocaleString('ru-RU')} ₽</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : '<p style="font-size: 12px; color: #999; margin-bottom: 20px;">Нет начислений по проектам</p>'}

        ${payments.length > 0 ? `
        <h3 style="font-size: 13px; margin-bottom: 8px;">Выплаты</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Дата</th>
              <th>Тип</th>
              <th>Примечание</th>
              <th class="text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map((p, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${new Date(p.date).toLocaleDateString('ru-RU')}</td>
                <td>${getPaymentTypeLabel(p.type)}</td>
                <td>${p.notes || '-'}</td>
                <td class="text-right">${p.amount.toLocaleString('ru-RU')} ₽</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : '<p style="font-size: 12px; color: #999; margin-bottom: 20px;">Нет выплат</p>'}

        <div class="summary">
          <div class="summary-row">
            <span>Всего начислено:</span>
            <span><strong>${calculated.toLocaleString('ru-RU')} ₽</strong></span>
          </div>
          <div class="summary-row">
            <span>Всего выдано:</span>
            <span><strong>${paid.toLocaleString('ru-RU')} ₽</strong></span>
          </div>
          <div class="summary-row total">
            <span>Остаток к выдаче:</span>
            <span style="color: ${balance > 0 ? '#d97706' : balance < 0 ? '#dc2626' : '#16a34a'};">
              ${balance.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>

        <div class="footer">
          Сформировано: ${new Date().toLocaleDateString('ru-RU')} | СкладОборуд
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <button
      onClick={handlePrint}
      className="text-xs text-muted-foreground hover:text-foreground underline"
      type="button"
    >
      Расчётный листок
    </button>
  );
}
