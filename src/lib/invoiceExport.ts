import { Document, Paragraph, Table, TableCell, TableRow, TextRun, AlignmentType, 
         Header, Footer, PageNumber, BorderStyle } from 'docx';
import { downloadBlob } from './fileDownload';
import { Packer } from 'docx';
import type { Invoice, PDFSettings, CompanyBankAccount, Company } from '../types';
import { numberToWords } from '../types';

// Генерация HTML для предпросмотра счета (классический банковский формат)
export function generateInvoiceHTML(invoice: Invoice, settings: PDFSettings, bankAccounts: CompanyBankAccount[] = [], company?: Company | null): string {
  const customer = invoice.contract?.customer;
  const contract = invoice.contract;
  
  // Получаем банковский счёт исполнителя:
  // 1. Если в договоре указан bank_account_id — ищем этот счёт
  // 2. Иначе берём is_default или первый доступный
  const executorAccount = contract?.bank_account_id && bankAccounts.length > 0
    ? bankAccounts.find(a => a.id === contract.bank_account_id) || bankAccounts.find(a => a.is_default) || bankAccounts[0]
    : bankAccounts.find(a => a.is_default) || bankAccounts[0] || null;
  
  // Реквизиты исполнителя: приоритет — указанный счёт в договоре, затем из компании
  const bankName = executorAccount?.bank_name || company?.bank_name || 'АО "ТБанк"';
  const bik = executorAccount?.bik || company?.bank_bik || '044525974';
  const corrAccount = executorAccount?.corr_account || company?.bank_corr_account || '30101810145250000974';
  const account = executorAccount?.account || company?.bank_account || '40802810200005568272';
  
  // Формируем полное наименование поставщика
  const rawSupplierName = company?.name || settings.companyName || '-';
  const supplierFullName = company?.type === 'ip' 
    ? (rawSupplierName.match(/^ИП\s+/i) ? rawSupplierName : `ИП ${rawSupplierName}`)
    : (rawSupplierName.match(/^(ООО|ОАО|ЗАО|ПАО|АО)\s*["']?/i) ? rawSupplierName : `ООО "${rawSupplierName}"`);
  
  const supplierInn = company?.inn || settings.companyDetails?.match(/ИНН\s*(\d+)/)?.[1] || '-';
  const supplierKpp = company?.kpp || '-';
  const supplierAddress = company?.legal_address || settings.companyDetails || '-';
  
  // Формируем наименование покупателя
  const rawBuyerName = customer?.name || '-';
  const buyerFullName = customer?.type === 'ip'
    ? (rawBuyerName.match(/^ИП\s+/i) ? rawBuyerName : `ИП ${rawBuyerName}`)
    : customer?.type === 'company'
      ? (rawBuyerName.match(/^(ООО|ОАО|ЗАО|ПАО|АО)\s*["']?/i) ? rawBuyerName : `ООО "${rawBuyerName}"`)
      : rawBuyerName;
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 
                   'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} г.`;
  };
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 15mm; }
    body { 
      font-family: Arial, sans-serif; 
      font-size: 10pt; 
      line-height: 1.3;
      color: #000;
      max-width: 800px;
      margin: 0 auto;
      padding: 10px;
    }
    
    /* Таблица реквизитов банка */
    .bank-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 9pt;
    }
    .bank-table td, .bank-table th {
      border: 1px solid #000;
      padding: 4px 6px;
      vertical-align: middle;
    }
    .bank-table .label {
      background-color: #f5f5f5;
      font-weight: bold;
      width: 15%;
    }
    .bank-table .value {
      width: 35%;
    }
    
    /* Заголовок счета */
    .invoice-title {
      font-size: 14pt;
      font-weight: bold;
      margin: 20px 0 15px 0;
    }
    
    /* Блоки поставщик/покупатель */
    .party-block {
      margin-bottom: 12px;
      line-height: 1.4;
    }
    .party-label {
      font-weight: bold;
      display: inline;
    }
    .party-value {
      display: inline;
    }
    
    /* Таблица товаров */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 9pt;
    }
    .items-table th {
      background-color: #f0f0f0;
      border: 1px solid #000;
      padding: 6px 4px;
      font-weight: bold;
      text-align: center;
    }
    .items-table td {
      border: 1px solid #000;
      padding: 6px 4px;
      vertical-align: top;
    }
    .items-table .num { width: 5%; text-align: center; }
    .items-table .name { width: 45%; text-align: left; }
    .items-table .qty { width: 10%; text-align: center; }
    .items-table .unit { width: 8%; text-align: center; }
    .items-table .vat { width: 10%; text-align: center; }
    .items-table .price { width: 11%; text-align: right; }
    .items-table .sum { width: 11%; text-align: right; }
    
    /* Итоги */
    .totals-block {
      margin-top: 10px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    .totals-label {
      font-weight: bold;
    }
    
    /* Подписи */
    .signatures {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
    }
    .signature-block {
      width: 45%;
    }
    .signature-line {
      border-bottom: 1px solid #000;
      display: inline-block;
      width: 150px;
      margin-left: 10px;
    }
  </style>
</head>
<body>
  <!-- Таблица реквизитов банка -->
  <table class="bank-table">
    <tr>
      <td colspan="2" rowspan="2" style="width: 50%;">
        <strong>${bankName}</strong><br>
        <span style="font-size: 8pt;">Банк получателя</span>
      </td>
      <td class="label">БИК</td>
      <td class="value">${bik}</td>
    </tr>
    <tr>
      <td class="label">Сч. №</td>
      <td class="value">${corrAccount}</td>
    </tr>
    <tr>
      <td class="label">ИНН</td>
      <td class="value">${supplierInn}</td>
      <td class="label" rowspan="2">Сч. №</td>
      <td class="value" rowspan="2">${account}</td>
    </tr>
    <tr>
      <td class="label">Получатель</td>
      <td class="value">${supplierFullName}</td>
    </tr>
  </table>

  <!-- Заголовок -->
  <div class="invoice-title">
    Счет на оплату № ${invoice.number} от ${formatDate(invoice.date)}
  </div>

  <!-- Поставщик -->
  <div class="party-block">
    <span class="party-label">Поставщик:</span>
    <span class="party-value">${supplierFullName}, ИНН ${supplierInn}${supplierKpp !== '-' ? ', КПП ' + supplierKpp : ''}, ${supplierAddress}</span>
  </div>

  <!-- Покупатель -->
  <div class="party-block">
    <span class="party-label">Покупатель:</span>
    <span class="party-value">${buyerFullName}, ИНН ${customer?.inn || '-'}${customer?.kpp ? ', КПП ' + customer.kpp : ''}${customer?.legal_address ? ', ' + customer.legal_address : ''}</span>
  </div>

  <!-- Таблица товаров/услуг -->
  <table class="items-table">
    <thead>
      <tr>
        <th class="num">№</th>
        <th class="name">Товары (работы, услуги)</th>
        <th class="qty">Кол-во</th>
        <th class="unit">Ед.</th>
        <th class="vat">НДС</th>
        <th class="price">Цена</th>
        <th class="sum">Сумма</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="num">1</td>
        <td class="name">${invoice.description || `Оплата по договору № ${invoice.contract?.number} от ${invoice.contract?.date ? formatDate(invoice.contract.date) : ''}`}</td>
        <td class="qty">1</td>
        <td class="unit">шт</td>
        <td class="vat">${invoice.vat_rate > 0 ? invoice.vat_rate + '%' : 'Без НДС'}</td>
        <td class="price">${invoice.amount.toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
        <td class="sum">${invoice.amount.toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
      </tr>
    </tbody>
  </table>

  <!-- Итоги -->
  <div class="totals-block">
    <div class="totals-row">
      <span>Всего наименований 1, на сумму ${invoice.total_amount.toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2})} руб.</span>
      <span><strong>Итого к оплате:</strong> ${invoice.total_amount.toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
    </div>
    <div style="margin-top: 10px; font-style: italic;">
      ${numberToWords(invoice.total_amount)}
    </div>
  </div>

  ${invoice.due_date ? `
  <div style="margin-top: 15px;">
    <strong>Срок оплаты:</strong> ${formatDate(invoice.due_date)}
  </div>
  ` : ''}

  <!-- Подписи -->
  <div class="signatures">
    <div class="signature-block">
      <span class="party-label">Руководитель</span>
      <span class="signature-line"></span>
    </div>
    <div class="signature-block">
      <span class="party-label">Бухгалтер</span>
      <span class="signature-line"></span>
    </div>
  </div>
</body>
</html>
  `;
}

// Экспорт счета в DOCX
export async function exportInvoiceToDOCX(invoice: Invoice, settings: PDFSettings, bankAccounts: CompanyBankAccount[] = [], company?: Company | null): Promise<void> {
  const customer = invoice.contract?.customer;
  const contract = invoice.contract;
  
  // Получаем банковский счёт исполнителя:
  // 1. Если в договоре указан bank_account_id — ищем этот счёт
  // 2. Иначе берём is_default или первый доступный
  const executorAccount = contract?.bank_account_id && bankAccounts.length > 0
    ? bankAccounts.find(a => a.id === contract.bank_account_id) || bankAccounts.find(a => a.is_default) || bankAccounts[0]
    : bankAccounts.find(a => a.is_default) || bankAccounts[0] || null;
  
  // Реквизиты исполнителя: приоритет — указанный счёт в договоре, затем из компании
  const bankName = executorAccount?.bank_name || company?.bank_name || '-';
  const bik = executorAccount?.bik || company?.bank_bik || '-';
  const corrAccount = executorAccount?.corr_account || company?.bank_corr_account || '-';
  const account = executorAccount?.account || company?.bank_account || '-';
  
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
                  children: [new Paragraph(bankName)],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'БИК:', bold: true })],
                }),
                new TableCell({
                  children: [new Paragraph(bik)],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Р/с:', bold: true })],
                }),
                new TableCell({
                  children: [new Paragraph(account)],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'К/с:', bold: true })],
                }),
                new TableCell({
                  children: [new Paragraph(corrAccount)],
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
  downloadBlob(blob, `Счет_${invoice.number}_${new Date(invoice.date).toISOString().split('T')[0]}.docx`);
}
