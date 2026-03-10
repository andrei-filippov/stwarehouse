import { Document, Paragraph, Table, TableCell, TableRow, TextRun, AlignmentType, 
         BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { Packer } from 'docx';
import type { Act, PDFSettings } from '../types';
import { numberToWords } from '../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// Генерация HTML для предпросмотра акта
export function generateActHTML(act: Act, settings: PDFSettings): string {
  const customer = act.contract?.customer;
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
  </style>
</head>
<body>
  <div class="title">Акт выполненных работ</div>
  <div class="subtitle">
    № ${act.number} от ${format(new Date(act.date), 'dd.MM.yyyy')}
  </div>

  <div class="info-block">
    <div class="info-row">
      <span class="info-label">Исполнитель:</span> ${settings.companyName}, 
      ИНН ${settings.companyDetails.includes('ИНН') ? settings.companyDetails.match(/ИНН\s*(\d+)/)?.[1] || '-' : '-'}, 
      ${settings.companyDetails}
    </div>
    <div class="info-row">
      <span class="info-label">Заказчик:</span> ${customer?.name || '-'}, 
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
      ${act.items?.map((item, index) => `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td>${item.name}${item.description ? `<br><small>${item.description}</small>` : ''}</td>
          <td class="text-center">${item.unit}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">${item.price.toLocaleString('ru-RU')}</td>
          <td class="text-right">${item.total.toLocaleString('ru-RU')}</td>
        </tr>
      `).join('') || `
        <tr>
          <td class="text-center">1</td>
          <td>Оказание услуг по договору № ${act.contract?.number}</td>
          <td class="text-center">шт</td>
          <td class="text-right">1</td>
          <td class="text-right">${act.amount.toLocaleString('ru-RU')}</td>
          <td class="text-right">${act.amount.toLocaleString('ru-RU')}</td>
        </tr>
      `}
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
            <div>${settings.companyName}</div>
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
            <div>${customer?.name || '_______________________'}</div>
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
export async function exportActToDOCX(act: Act, settings: PDFSettings): Promise<void> {
  const customer = act.contract?.customer;
  const periodText = act.period_start && act.period_end
    ? `${format(new Date(act.period_start), 'dd.MM.yyyy')} — ${format(new Date(act.period_end), 'dd.MM.yyyy')}`
    : '-';

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 850, bottom: 1134, left: 1701 },
        },
      },
      children: [
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
            new TextRun(`${settings.companyName}, ИНН ${settings.companyDetails.includes('ИНН') ? settings.companyDetails.match(/ИНН\s*(\d+)/)?.[1] || '-' : '-'}, ${settings.companyDetails}`),
          ],
        }),
        new Paragraph({
          spacing: { after: 300 },
          children: [
            new TextRun({ text: 'Заказчик: ', bold: true }),
            new TextRun(`${customer?.name || '-'}, ИНН ${customer?.inn || '-'}, КПП ${customer?.kpp || '-'}, ${customer?.legal_address || '-'}`),
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
            ...(act.items?.map((item, index) => new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: String(index + 1), alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph(item.name)] }),
                new TableCell({ children: [new Paragraph({ text: item.unit, alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: String(item.quantity), alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ text: item.price.toLocaleString('ru-RU'), alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ text: item.total.toLocaleString('ru-RU'), alignment: AlignmentType.RIGHT })] }),
              ],
            })) || [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: '1', alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph(`Оказание услуг по договору № ${act.contract?.number}`)] }),
                  new TableCell({ children: [new Paragraph({ text: 'шт', alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: '1', alignment: AlignmentType.RIGHT })] }),
                  new TableCell({ children: [new Paragraph({ text: act.amount.toLocaleString('ru-RU'), alignment: AlignmentType.RIGHT })] }),
                  new TableCell({ children: [new Paragraph({ text: act.amount.toLocaleString('ru-RU'), alignment: AlignmentType.RIGHT })] }),
                ],
              }),
            ]),
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
                    new Paragraph(settings.companyName),
                    new Paragraph(settings.position),
                    new Paragraph({ text: '_'.repeat(30), spacing: { before: 400 } }),
                    new Paragraph(`/ ${settings.personName} /`),
                  ],
                }),
                new TableCell({
                  width: { size: 50, type: 'pct' },
                  children: [
                    new Paragraph({ text: 'От Заказчика:', bold: true }),
                    new Paragraph(customer?.name || '_______________________'),
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
  saveAs(blob, `Акт_${act.number}_${format(new Date(act.date), 'yyyy-MM-dd')}.docx`);
}
