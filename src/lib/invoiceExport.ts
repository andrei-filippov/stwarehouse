import { Document, Paragraph, Table, TableCell, TableRow, TextRun, AlignmentType, 
         Header, Footer, PageNumber, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { Packer } from 'docx';
import type { Invoice, PDFSettings } from '../types';
import { numberToWords } from '../types';

// Генерация HTML для предпросмотра счета
export function generateInvoiceHTML(invoice: Invoice, settings: PDFSettings): string {
  const customer = invoice.contract?.customer;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 15mm; }
    body { 
      font-family: Arial, sans-serif; 
      font-size: 11pt; 
      line-height: 1.4;
      color: #000;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header { margin-bottom: 20px; }
    .bank-details { 
      border: 1px solid #000; 
      padding: 10px; 
      margin-bottom: 20px;
      font-size: 10pt;
    }
    .bank-row { display: flex; margin-bottom: 5px; }
    .bank-label { width: 150px; font-weight: bold; }
    .bank-value { flex: 1; }
    .title { 
      text-align: center; 
      font-size: 16pt; 
      font-weight: bold;
      margin: 20px 0;
    }
    .info-row { margin-bottom: 8px; }
    .info-label { font-weight: bold; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 20px 0;
    }
    th, td { 
      border: 1px solid #000; 
      padding: 8px; 
      text-align: left;
    }
    th { background-color: #f0f0f0; font-weight: bold; }
    .text-right { text-align: right; }
    .total-row { font-weight: bold; background-color: #f5f5f5; }
    .signature { margin-top: 40px; }
    .signature-line { border-top: 1px solid #000; width: 200px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <div style="text-align: right; margin-bottom: 10px;">
      <strong>${settings.companyName}</strong>
    </div>
  </div>

  <div class="bank-details">
    <div class="bank-row">
      <div class="bank-label">Банк получателя:</div>
      <div class="bank-value">${customer?.bank_name || 'АО "ТБАНК"'}</div>
    </div>
    <div class="bank-row">
      <div class="bank-label">БИК:</div>
      <div class="bank-value">${customer?.bank_bik || '044525974'}</div>
    </div>
    <div class="bank-row">
      <div class="bank-label">Р/с:</div>
      <div class="bank-value">${customer?.bank_account || '40802810200005568272'}</div>
    </div>
    <div class="bank-row">
      <div class="bank-label">К/с:</div>
      <div class="bank-value">${customer?.bank_corr_account || '30101810145250000974'}</div>
    </div>
  </div>

  <div class="title">
    Счет на оплату № ${invoice.number} от ${new Date(invoice.date).toLocaleDateString('ru-RU')}
  </div>

  <div class="info-row">
    <span class="info-label">Плательщик:</span> ${customer?.name || '-'}, 
    ИНН ${customer?.inn || '-'}, КПП ${customer?.kpp || '-'}, 
    ${customer?.legal_address || '-'}
  </div>

  <div class="info-row">
    <span class="info-label">Грузополучатель:</span> ${customer?.name || '-'}
  </div>

  <table>
    <thead>
      <tr>
        <th>№</th>
        <th>Наименование</th>
        <th>Ед.</th>
        <th class="text-right">Кол-во</th>
        <th class="text-right">Цена</th>
        <th class="text-right">Сумма</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>${invoice.description || `Оплата по договору № ${invoice.contract?.number}`}</td>
        <td>шт</td>
        <td class="text-right">1</td>
        <td class="text-right">${invoice.amount.toLocaleString('ru-RU')}</td>
        <td class="text-right">${invoice.amount.toLocaleString('ru-RU')}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="5" class="text-right">Итого:</td>
        <td class="text-right">${invoice.amount.toLocaleString('ru-RU')}</td>
      </tr>
      ${invoice.vat_rate > 0 ? `
      <tr class="total-row">
        <td colspan="5" class="text-right">В том числе НДС (${invoice.vat_rate}%):</td>
        <td class="text-right">${invoice.vat_amount.toLocaleString('ru-RU')}</td>
      </tr>
      ` : `
      <tr class="total-row">
        <td colspan="5" class="text-right">НДС не облагается:</td>
        <td class="text-right">—</td>
      </tr>
      `}
      <tr class="total-row">
        <td colspan="5" class="text-right"><strong>Всего к оплате:</strong></td>
        <td class="text-right"><strong>${invoice.total_amount.toLocaleString('ru-RU')}</strong></td>
      </tr>
    </tfoot>
  </table>

  <div style="margin-top: 20px;">
    <strong>Всего наименований 1, на сумму ${invoice.total_amount.toLocaleString('ru-RU')} руб.</strong><br>
    <em>${numberToWords(invoice.total_amount)}</em>
  </div>

  ${invoice.due_date ? `
  <div style="margin-top: 20px;">
    <strong>Срок оплаты:</strong> ${new Date(invoice.due_date).toLocaleDateString('ru-RU')}
  </div>
  ` : ''}

  <div class="signature">
    <div style="display: flex; justify-content: space-between; margin-top: 40px;">
      <div>
        <div>Руководитель</div>
        <div style="margin-top: 30px; border-top: 1px solid #000; width: 150px;"></div>
      </div>
      <div>
        <div>Бухгалтер</div>
        <div style="margin-top: 30px; border-top: 1px solid #000; width: 150px;"></div>
      </div>
    </div>
  </div>

  <div style="margin-top: 40px; text-align: center; font-size: 9pt; color: #666;">
    Оплатить по QR-коду: business.tbank.ru
  </div>
</body>
</html>
  `;
}

// Экспорт счета в DOCX
export async function exportInvoiceToDOCX(invoice: Invoice, settings: PDFSettings): Promise<void> {
  const customer = invoice.contract?.customer;
  
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 850, bottom: 1134, left: 1701 },
        },
      },
      children: [
        // Заголовок с названием компании
        new Paragraph({
          text: settings.companyName,
          alignment: AlignmentType.RIGHT,
          spacing: { after: 200 },
        }),

        // Банковские реквизиты
        new Table({
          width: { size: 100, type: 'pct' },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 30, type: 'pct' },
                  children: [new Paragraph({ text: 'Банк получателя:', bold: true })],
                }),
                new TableCell({
                  width: { size: 70, type: 'pct' },
                  children: [new Paragraph(customer?.bank_name || 'АО "ТБАНК"')],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'БИК:', bold: true })],
                }),
                new TableCell({
                  children: [new Paragraph(customer?.bank_bik || '044525974')],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Р/с:', bold: true })],
                }),
                new TableCell({
                  children: [new Paragraph(customer?.bank_account || '40802810200005568272')],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'К/с:', bold: true })],
                }),
                new TableCell({
                  children: [new Paragraph(customer?.bank_corr_account || '30101810145250000974')],
                }),
              ],
            }),
          ],
        }),

        // Заголовок счета
        new Paragraph({
          text: `Счет на оплату № ${invoice.number} от ${new Date(invoice.date).toLocaleDateString('ru-RU')}`,
          heading: 1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 200 },
          bold: true,
        }),

        // Плательщик
        new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({ text: 'Плательщик: ', bold: true }),
            new TextRun(`${customer?.name || '-'}, ИНН ${customer?.inn || '-'}, КПП ${customer?.kpp || '-'}, ${customer?.legal_address || '-'}`),
          ],
        }),

        // Грузополучатель
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'Грузополучатель: ', bold: true }),
            new TextRun(customer?.name || '-'),
          ],
        }),

        // Таблица с позициями
        new Table({
          width: { size: 100, type: 'pct' },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
          rows: [
            // Заголовок таблицы
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: '№', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: 'Наименование', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: 'Ед.', bold: true })] }),
                new TableCell({ children: [new Paragraph({ text: 'Кол-во', bold: true, alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ text: 'Цена', bold: true, alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ text: 'Сумма', bold: true, alignment: AlignmentType.RIGHT })] }),
              ],
            }),
            // Позиция
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('1')] }),
                new TableCell({ children: [new Paragraph(invoice.description || `Оплата по договору № ${invoice.contract?.number}`)] }),
                new TableCell({ children: [new Paragraph('шт')] }),
                new TableCell({ children: [new Paragraph({ text: '1', alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ text: invoice.amount.toLocaleString('ru-RU'), alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ text: invoice.amount.toLocaleString('ru-RU'), alignment: AlignmentType.RIGHT })] }),
              ],
            }),
            // Итого
            new TableRow({
              children: [
                new TableCell({ columnSpan: 5, children: [new Paragraph({ text: 'Итого:', bold: true, alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ text: invoice.amount.toLocaleString('ru-RU'), bold: true, alignment: AlignmentType.RIGHT })] }),
              ],
            }),
            // НДС
            invoice.vat_rate > 0
              ? new TableRow({
                  children: [
                    new TableCell({ columnSpan: 5, children: [new Paragraph({ text: `В том числе НДС (${invoice.vat_rate}%):`, bold: true, alignment: AlignmentType.RIGHT })] }),
                    new TableCell({ children: [new Paragraph({ text: invoice.vat_amount.toLocaleString('ru-RU'), bold: true, alignment: AlignmentType.RIGHT })] }),
                  ],
                })
              : new TableRow({
                  children: [
                    new TableCell({ columnSpan: 5, children: [new Paragraph({ text: 'НДС не облагается:', bold: true, alignment: AlignmentType.RIGHT })] }),
                    new TableCell({ children: [new Paragraph({ text: '—', bold: true, alignment: AlignmentType.RIGHT })] }),
                  ],
                }),
            // Всего
            new TableRow({
              children: [
                new TableCell({ columnSpan: 5, children: [new Paragraph({ text: 'Всего к оплате:', bold: true, alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ text: invoice.total_amount.toLocaleString('ru-RU'), bold: true, alignment: AlignmentType.RIGHT })] }),
              ],
            }),
          ],
        }),

        // Сумма прописью
        new Paragraph({
          spacing: { before: 200 },
          children: [
            new TextRun({ text: `Всего наименований 1, на сумму ${invoice.total_amount.toLocaleString('ru-RU')} руб.`, bold: true }),
          ],
        }),
        new Paragraph({
          spacing: { after: 200 },
          italics: true,
          text: numberToWords(invoice.total_amount),
        }),

        // Срок оплаты
        ...(invoice.due_date
          ? [
              new Paragraph({
                spacing: { before: 100, after: 200 },
                children: [
                  new TextRun({ text: 'Срок оплаты: ', bold: true }),
                  new TextRun(new Date(invoice.due_date).toLocaleDateString('ru-RU')),
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
                    new Paragraph('Руководитель'),
                    new Paragraph({ text: '_'.repeat(30), spacing: { before: 400 } }),
                  ],
                }),
                new TableCell({
                  width: { size: 50, type: 'pct' },
                  children: [
                    new Paragraph('Бухгалтер'),
                    new Paragraph({ text: '_'.repeat(30), spacing: { before: 400 } }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Счет_${invoice.number}_${new Date(invoice.date).toISOString().split('T')[0]}.docx`);
}
