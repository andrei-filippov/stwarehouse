import { Document, Paragraph, Table, TableCell, TableRow, TextRun, AlignmentType, 
         BorderStyle } from 'docx';
import { downloadBlob } from './fileDownload';
import { Packer } from 'docx';
import type { Act, PDFSettings, CompanyBankAccount, Company } from '../types';
import { numberToWords } from '../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// Вспомогательная функция для форматирования названия компании
function formatCompanyName(name: string, type?: string): string {
  if (!name) return '-';
  if (type === 'ip') {
    return name.match(/^ИП\s+/i) ? name : `ИП ${name}`;
  }
  if (type === 'company' || !type) {
    return name.match(/^(ООО|ОАО|ЗАО|ПАО|АО)\s*["']?/i) ? name : `ООО "${name}"`;
  }
  return name;
}

// Генерация HTML для предпросмотра акта
// showItems: true - показывать позиции из сметы, false - показывать предмет договора
export function generateActHTML(act: Act, settings: PDFSettings, bankAccounts: CompanyBankAccount[] = [], company?: Company | null, showItems: boolean = true): string {
  const customer = act.contract?.customer;
  const contractSubject = act.contract?.subject || '';
  const periodText = act.period_start && act.period_end
    ? `${format(new Date(act.period_start), 'dd.MM.yyyy')} — ${format(new Date(act.period_end), 'dd.MM.yyyy')}`
    : '-';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 20mm; }
    body { 
      font-family: "Times New Roman", Times, serif; 
      font-size: 12pt; 
      line-height: 1.5;
      color: #000;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .title { 
      text-align: center; 
      font-size: 14pt; 
      font-weight: bold;
      margin: 20px 0;
      text-transform: uppercase;
    }
    .subtitle {
      text-align: center;
      margin-bottom: 30px;
    }
    .info-block { margin-bottom: 20px; }
    .info-row { margin-bottom: 10px; text-align: justify; }
    .info-label { font-weight: bold; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 20px 0;
      font-size: 11pt;
    }
    th, td { 
      border: 1px solid #000; 
      padding: 8px; 
      text-align: left;
    }
    th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .total-row { font-weight: bold; background-color: #f5f5f5; }
    .signatures { margin-top: 50px; }
    .signature-block { margin-bottom: 30px; }
    .signature-title { font-weight: bold; margin-bottom: 10px; }
    .signature-line { 
      border-top: 1px solid #000; 
      width: 250px; 
      margin-top: 40px;
      display: inline-block;
    }
    .page-break { page-break-after: always; }
    
    /* Шапка с логотипом */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      border-bottom: 2px solid #333;
      padding-bottom: 15px;
    }
    .logo-section { width: 45%; }
    .logo-section img { max-height: 80px; max-width: 100%; }
    .company-section { width: 50%; text-align: right; font-size: 11px; }
    .company-section h2 { margin: 0 0 5px 0; font-size: 14px; }
    .company-section p { margin: 3px 0; }
  </style>
</head>
<body>
  <!-- Шапка с логотипом -->
  <div class="header">
    <div class="logo-section">
      ${settings.logo ? `<img src="${settings.logo}" alt="Логотип" />` : '<p>&nbsp;</p>'}
    </div>
    <div class="company-section">
      ${company?.name ? `<h2>${company.name}</h2>` : settings.companyName ? `<h2>${settings.companyName}</h2>` : ''}
      ${company?.inn || company?.kpp || company?.ogrn ? `<p>ИНН: ${company.inn || '-'} / КПП: ${company.kpp || '-'} / ОГРН: ${company.ogrn || '-'}</p>` : ''}
      ${company?.legal_address ? `<p>${company.legal_address}</p>` : settings.companyDetails ? settings.companyDetails.split('\n').map(line => `<p>${line}</p>`).join('') : ''}
    </div>
  </div>

  <div class="title">Акт выполненных работ</div>
  <div class="subtitle">
    № ${act.number} от ${format(new Date(act.date), 'dd.MM.yyyy')}
  </div>

  <div class="info-block">
    <div class="info-row">
      <span class="info-label">Исполнитель:</span> ${formatCompanyName(settings.companyName, company?.type)}, 
      ИНН ${settings.companyDetails.includes('ИНН') ? settings.companyDetails.match(/ИНН\s*(\d+)/)?.[1] || '-' : '-'}, 
      ${settings.companyDetails}
    </div>
    <div class="info-row">
      <span class="info-label">Заказчик:</span> ${formatCompanyName(customer?.name || '-', customer?.type)}, 
      ИНН ${customer?.inn || '-'}, КПП ${customer?.kpp || '-'}, 
      ${customer?.legal_address || '-'}
    </div>
  </div>

  <div class="info-row" style="margin: 20px 0;">
    К настоящему акту Исполнитель сдал, а Заказчик принял следующие работы (услуги):
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 5%;">№</th>
        <th style="width: 45%;">Наименование работ (услуг)</th>
        <th style="width: 10%;">Ед.</th>
        <th style="width: 10%;">Кол-во</th>
        <th style="width: 15%;">Цена</th>
        <th style="width: 15%;">Сумма</th>
      </tr>
    </thead>
    <tbody>
      ${showItems && act.items && act.items.length > 0 
        ? act.items.map((item, index) => `
          <tr>
            <td class="text-center">${index + 1}</td>
            <td>${item.name}${item.description ? `<br><small>${item.description}</small>` : ''}</td>
            <td class="text-center">${item.unit}</td>
            <td class="text-right">${item.quantity}</td>
            <td class="text-right">${item.price.toLocaleString('ru-RU')}</td>
            <td class="text-right">${item.total.toLocaleString('ru-RU')}</td>
          </tr>
        `).join('')
        : `
          <tr>
            <td class="text-center">1</td>
            <td>${contractSubject || `Оказание услуг по договору № ${act.contract?.number}`}</td>
            <td class="text-center">шт</td>
            <td class="text-right">1</td>
            <td class="text-right">${act.amount.toLocaleString('ru-RU')}</td>
            <td class="text-right">${act.amount.toLocaleString('ru-RU')}</td>
          </tr>
        `
      }
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="5" class="text-right">Итого:</td>
        <td class="text-right">${act.amount.toLocaleString('ru-RU')}</td>
      </tr>
      ${act.vat_rate > 0 ? `
      <tr class="total-row">
        <td colspan="5" class="text-right">В том числе НДС (${act.vat_rate}%):</td>
        <td class="text-right">${act.vat_amount.toLocaleString('ru-RU')}</td>
      </tr>
      ` : ''}
      <tr class="total-row">
        <td colspan="5" class="text-right"><strong>Всего:</strong></td>
        <td class="text-right"><strong>${act.total_amount.toLocaleString('ru-RU')}</strong></td>
      </tr>
    </tfoot>
  </table>

  <div style="margin: 20px 0;">
    <strong>Всего оказано услуг на сумму:</strong> ${numberToWords(act.total_amount)}
  </div>

  <div class="info-row" style="margin: 20px 0;">
    Настоящий акт составлен в двух экземплярах, по одному для каждой из сторон.
  </div>

  <div class="info-row" style="margin: 20px 0;">
    Заказчик претензий по объему, качеству и срокам оказанных услуг не имеет.
  </div>

  ${act.notes ? `
  <div style="margin: 20px 0;">
    <strong>Примечания:</strong> ${act.notes}
  </div>
  ` : ''}

  <div class="signatures">
    <table style="border: none; margin-top: 40px;">
      <tr style="border: none;">
        <td style="border: none; width: 50%; vertical-align: top;">
          <div class="signature-block">
            <div class="signature-title">От Исполнителя:</div>
            <div>${formatCompanyName(settings.companyName, company?.type)}</div>
            <div style="margin-top: 10px;">${settings.position}</div>
            <div style="margin-top: 40px;">
              <span style="border-top: 1px solid #000; display: inline-block; width: 150px; margin-right: 10px;"></span>
              / ${settings.personName} /
            </div>
            <div style="margin-top: 5px; font-size: 10pt; color: #666;">
              подпись
            </div>
          </div>
        </td>
        <td style="border: none; width: 50%; vertical-align: top;">
          <div class="signature-block">
            <div class="signature-title">От Заказчика:</div>
            <div>${formatCompanyName(customer?.name || '_______________________', customer?.type)}</div>
            <div style="margin-top: 10px;">_______________________</div>
            <div style="margin-top: 40px;">
              <span style="border-top: 1px solid #000; display: inline-block; width: 150px; margin-right: 10px;"></span>
              / _______________________ /
            </div>
            <div style="margin-top: 5px; font-size: 10pt; color: #666;">
              подпись
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <div style="margin-top: 60px; text-align: center; font-size: 9pt; color: #666;">
    М.П.
  </div>
</body>
</html>
  `;
}

// Экспорт акта в DOCX
// showItems: true - показывать позиции из сметы, false - показывать предмет договора
export async function exportActToDOCX(act: Act, settings: PDFSettings, bankAccounts: CompanyBankAccount[] = [], company?: Company | null, showItems: boolean = true): Promise<void> {
  const customer = act.contract?.customer;
  const contractSubject = act.contract?.subject || '';
  const periodText = act.period_start && act.period_end
    ? `${format(new Date(act.period_start), 'dd.MM.yyyy')} — ${format(new Date(act.period_end), 'dd.MM.yyyy')}`
    : '-';
  
  // Форматирование названий компаний
  const companyNameFormatted = formatCompanyName(settings.companyName, company?.type);
  const customerNameFormatted = formatCompanyName(customer?.name || '-', customer?.type);

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 850, bottom: 1134, left: 1701 },
        },
      },
      children: [
        // Шапка с названием компании и реквизитами
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 100 },
          children: [
            new TextRun({ text: company?.name || settings.companyName || '', bold: true, size: 24 }),
          ],
        }),
        ...(company?.inn ? [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: `ИНН: ${company.inn}${company.kpp ? ' / КПП: ' + company.kpp : ''}${company.ogrn ? ' / ОГРН: ' + company.ogrn : ''}`, size: 20 })],
        })] : []),
        ...(company?.legal_address ? [new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 200 },
          children: [new TextRun({ text: company.legal_address, size: 20 })],
        })] : settings.companyDetails ? settings.companyDetails.split('\n').map(line => new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 50 },
          children: [new TextRun({ text: line, size: 20 })],
        })) : []),
        new Paragraph({ spacing: { after: 300 } }),

        // Заголовок
        new Paragraph({
          text: 'Акт выполненных работ',
          heading: 1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          bold: true,
        }),
        new Paragraph({
          text: `№ ${act.number} от ${format(new Date(act.date), 'dd.MM.yyyy')}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),

        // Стороны
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'Исполнитель: ', bold: true }),
            new TextRun(`${companyNameFormatted}, ИНН ${settings.companyDetails.includes('ИНН') ? settings.companyDetails.match(/ИНН\s*(\d+)/)?.[1] || '-' : '-'}, ${settings.companyDetails}`),
          ],
        }),
        new Paragraph({
          spacing: { after: 300 },
          children: [
            new TextRun({ text: 'Заказчик: ', bold: true }),
            new TextRun(`${customerNameFormatted}, ИНН ${customer?.inn || '-'}, КПП ${customer?.kpp || '-'}, ${customer?.legal_address || '-'}`),
          ],
        }),

        // Вводный текст
        new Paragraph({
          text: 'К настоящему акту Исполнитель сдал, а Заказчик принял следующие работы (услуги):',
          spacing: { after: 200 },
        }),

        // Таблица работ
        new Table({
          width: { size: 100, type: 'pct' },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
          rows: [
            // Заголовок
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: '№', bold: true, alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: 'Наименование работ (услуг)', bold: true, alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: 'Ед.', bold: true, alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: 'Кол-во', bold: true, alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: 'Цена', bold: true, alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: 'Сумма', bold: true, alignment: AlignmentType.CENTER })] }),
              ],
            }),
            // Позиции
            ...(showItems && act.items && act.items.length > 0
              ? act.items.map((item, index) => new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: String(index + 1), alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [new Paragraph(item.name)] }),
                    new TableCell({ children: [new Paragraph({ text: item.unit, alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [new Paragraph({ text: String(item.quantity), alignment: AlignmentType.RIGHT })] }),
                    new TableCell({ children: [new Paragraph({ text: item.price.toLocaleString('ru-RU'), alignment: AlignmentType.RIGHT })] }),
                    new TableCell({ children: [new Paragraph({ text: item.total.toLocaleString('ru-RU'), alignment: AlignmentType.RIGHT })] }),
                  ],
                }))
              : [
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: '1', alignment: AlignmentType.CENTER })] }),
                      new TableCell({ children: [new Paragraph(contractSubject || `Оказание услуг по договору № ${act.contract?.number}`)] }),
                      new TableCell({ children: [new Paragraph({ text: 'шт', alignment: AlignmentType.CENTER })] }),
                      new TableCell({ children: [new Paragraph({ text: '1', alignment: AlignmentType.RIGHT })] }),
                      new TableCell({ children: [new Paragraph({ text: act.amount.toLocaleString('ru-RU'), alignment: AlignmentType.RIGHT })] }),
                      new TableCell({ children: [new Paragraph({ text: act.amount.toLocaleString('ru-RU'), alignment: AlignmentType.RIGHT })] }),
                    ],
                  }),
                ]
            ),
            // Итого
            new TableRow({
              children: [
                new TableCell({ columnSpan: 5, children: [new Paragraph({ text: 'Итого:', bold: true, alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ text: act.amount.toLocaleString('ru-RU'), bold: true, alignment: AlignmentType.RIGHT })] }),
              ],
            }),
            // НДС
            act.vat_rate > 0
              ? new TableRow({
                  children: [
                    new TableCell({ columnSpan: 5, children: [new Paragraph({ text: `В том числе НДС (${act.vat_rate}%):`, bold: true, alignment: AlignmentType.RIGHT })] }),
                    new TableCell({ children: [new Paragraph({ text: act.vat_amount.toLocaleString('ru-RU'), bold: true, alignment: AlignmentType.RIGHT })] }),
                  ],
                })
              : new TableRow({
                  children: [
                    new TableCell({ columnSpan: 5, children: [new Paragraph({ text: 'В том числе НДС:', bold: true, alignment: AlignmentType.RIGHT })] }),
                    new TableCell({ children: [new Paragraph({ text: '—', bold: true, alignment: AlignmentType.RIGHT })] }),
                  ],
                }),
            // Всего
            new TableRow({
              children: [
                new TableCell({ columnSpan: 5, children: [new Paragraph({ text: 'Всего:', bold: true, alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ text: act.total_amount.toLocaleString('ru-RU'), bold: true, alignment: AlignmentType.RIGHT })] }),
              ],
            }),
          ],
        }),

        // Сумма прописью
        new Paragraph({
          spacing: { before: 200 },
          children: [
            new TextRun({ text: 'Всего оказано услуг на сумму: ', bold: true }),
            new TextRun(numberToWords(act.total_amount)),
          ],
        }),

        // Примечания
        new Paragraph({
          text: 'Настоящий акт составлен в двух экземплярах, по одному для каждой из сторон.',
          spacing: { before: 200 },
        }),
        new Paragraph({
          text: 'Заказчик претензий по объему, качеству и срокам оказанных услуг не имеет.',
          spacing: { after: 200 },
        }),

        // Примечания если есть
        ...(act.notes
          ? [
              new Paragraph({
                spacing: { before: 100, after: 200 },
                children: [
                  new TextRun({ text: 'Примечания: ', bold: true }),
                  new TextRun(act.notes),
                ],
              }),
            ]
          : []),

        // Подписи
        new Paragraph({ spacing: { before: 400 } }),
        new Table({
          width: { size: 100, type: 'pct' },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: 'pct' },
                  children: [
                    new Paragraph({ text: 'От Исполнителя:', bold: true }),
                    new Paragraph(companyNameFormatted),
                    new Paragraph(settings.position),
                    new Paragraph({ text: '_'.repeat(30), spacing: { before: 400 } }),
                    new Paragraph(`/ ${settings.personName} /`),
                  ],
                }),
                new TableCell({
                  width: { size: 50, type: 'pct' },
                  children: [
                    new Paragraph({ text: 'От Заказчика:', bold: true }),
                    new Paragraph(customerNameFormatted),
                    new Paragraph('_______________________'),
                    new Paragraph({ text: '_'.repeat(30), spacing: { before: 400 } }),
                    new Paragraph('/ _______________________ /'),
                  ],
                }),
              ],
            }),
          ],
        }),

        // М.П.
        new Paragraph({
          text: 'М.П.',
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `Акт_${act.number}_${format(new Date(act.date), 'yyyy-MM-dd')}.docx`);
}
