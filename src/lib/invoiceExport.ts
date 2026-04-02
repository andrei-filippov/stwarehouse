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
  
  // Получаем банковский счёт исполнителя
  const executorAccount = contract?.bank_account_id && bankAccounts.length > 0
    ? bankAccounts.find(a => a.id === contract.bank_account_id) || bankAccounts.find(a => a.is_default) || bankAccounts[0]
    : bankAccounts.find(a => a.is_default) || bankAccounts[0] || null;
  
  // Реквизиты исполнителя
  const bankName = executorAccount?.bank_name || company?.bank_name || '-';
  const bik = executorAccount?.bik || company?.bank_bik || '-';
  const corrAccount = executorAccount?.corr_account || company?.bank_corr_account || '-';
  const account = executorAccount?.account || company?.bank_account || '-';
  
  // Форматирование названия компании
  const formatCompanyNameDocx = (name: string, type?: string): string => {
    if (!name) return '-';
    if (type === 'ip') {
      return name.match(/^ИП\s+/i) ? name : `ИП ${name}`;
    }
    if (type === 'company' || !type) {
      return name.match(/^(ООО|ОАО|ЗАО|ПАО|АО)\s*["']?/i) ? name : `ООО "${name}"`;
    }
    return name;
  };
  
  // Формирование реквизитов
  const formatRequisitesDocx = (
    name: string,
    type: string | undefined,
    inn?: string,
    kpp?: string,
    ogrn?: string,
    address?: string
  ): string => {
    const parts: string[] = [];
    parts.push(formatCompanyNameDocx(name, type));
    if (inn) parts.push(`ИНН ${inn}`);
    if (kpp && type !== 'ip') parts.push(`КПП ${kpp}`);
    if (ogrn) parts.push(type === 'ip' ? `ОГРНИП ${ogrn}` : `ОГРН ${ogrn}`);
    if (address) parts.push(address);
    return parts.join(', ');
  };
  
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 850, bottom: 720, left: 1134 },
        },
      },
      children: [
        // Шапка с названием компании
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 50 },
          children: [
            new TextRun({ text: formatCompanyNameDocx(settings.companyName, company?.type), bold: true, size: 24 }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 50 },
          children: [
            new TextRun({ 
              text: `ИНН: ${company?.inn || ''}${(company?.kpp && company?.type !== 'ip') ? ' / КПП: ' + company.kpp : ''}${company?.ogrn ? ' / ОГРН: ' + company.ogrn : ''}`, 
              size: 18 
            }),
          ],
        }),
        ...(company?.legal_address ? [new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 150 },
          children: [new TextRun({ text: company.legal_address, size: 18 })],
        })] : []),

        // Разделительная линия
        new Paragraph({
          border: {
            bottom: {
              color: "000000",
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
          spacing: { after: 150 },
        }),

        // Банковская таблица (как в PDF)
        new Table({
          width: { size: 100, type: 'pct' },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 8 },
            bottom: { style: BorderStyle.SINGLE, size: 8 },
            left: { style: BorderStyle.SINGLE, size: 8 },
            right: { style: BorderStyle.SINGLE, size: 8 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 8 },
            insideVertical: { style: BorderStyle.SINGLE, size: 8 },
          },
          rows: [
            // Первая строка: Банк получателя (2 ячейки объединены) + БИК
            new TableRow({
              children: [
                new TableCell({
                  columnSpan: 2,
                  rowSpan: 2,
                  children: [
                    new Paragraph({ text: bankName, bold: true, size: 18 }),
                    new Paragraph({ text: 'Банк получателя', size: 16, color: '666666' }),
                  ],
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'БИК', bold: true, size: 18 })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: bik, size: 18 })],
                }),
              ],
            }),
            // Вторая строка: Сч. № (к/с)
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Сч. №', bold: true, size: 18 })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: corrAccount, size: 18 })],
                }),
              ],
            }),
            // Третья строка: ИНН + Сч. № (р/с)
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'ИНН', bold: true, size: 18 })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: company?.inn || '-', size: 18 })],
                }),
                new TableCell({
                  rowSpan: 2,
                  children: [new Paragraph({ text: 'Сч. №', bold: true, size: 18 })],
                }),
                new TableCell({
                  rowSpan: 2,
                  children: [new Paragraph({ text: account, size: 18 })],
                }),
              ],
            }),
            // Четвертая строка: Получатель
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Получатель', bold: true, size: 18 })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: formatCompanyNameDocx(settings.companyName, company?.type), size: 18 })],
                }),
              ],
            }),
          ],
        }),

        // Заголовок счета
        new Paragraph({
          text: `Счет на оплату № ${invoice.number} от ${new Date(invoice.date).toLocaleDateString('ru-RU')} г.`,
          alignment: AlignmentType.LEFT,
          spacing: { before: 300, after: 200 },
          bold: true,
          size: 22,
        }),

        // Поставщик
        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({ text: 'Поставщик: ', bold: true, size: 18 }),
            new TextRun({ 
              text: formatRequisitesDocx(
                settings.companyName, 
                company?.type, 
                company?.inn, 
                company?.kpp, 
                company?.ogrn, 
                company?.legal_address || settings.companyDetails
              ),
              size: 18 
            }),
          ],
        }),

        // Покупатель
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'Покупатель: ', bold: true, size: 18 }),
            new TextRun({ 
              text: customer ? formatRequisitesDocx(
                customer.name,
                customer.type,
                customer.inn,
                customer.kpp,
                customer.ogrn,
                customer.legal_address
              ) : '-',
              size: 18 
            }),
          ],
        }),

        // Таблица с позициями (как в PDF)
        new Table({
          width: { size: 100, type: 'pct' },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 8 },
            bottom: { style: BorderStyle.SINGLE, size: 8 },
            left: { style: BorderStyle.SINGLE, size: 8 },
            right: { style: BorderStyle.SINGLE, size: 8 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 8 },
            insideVertical: { style: BorderStyle.SINGLE, size: 8 },
          },
          rows: [
            // Заголовок таблицы
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: '№', bold: true, alignment: AlignmentType.CENTER, size: 18 })] }),
                new TableCell({ children: [new Paragraph({ text: 'Товары (работы, услуги)', bold: true, size: 18 })] }),
                new TableCell({ children: [new Paragraph({ text: 'Кол-во', bold: true, alignment: AlignmentType.CENTER, size: 18 })] }),
                new TableCell({ children: [new Paragraph({ text: 'Ед.', bold: true, alignment: AlignmentType.CENTER, size: 18 })] }),
                new TableCell({ children: [new Paragraph({ text: 'НДС', bold: true, alignment: AlignmentType.CENTER, size: 18 })] }),
                new TableCell({ children: [new Paragraph({ text: 'Цена', bold: true, alignment: AlignmentType.RIGHT, size: 18 })] }),
                new TableCell({ children: [new Paragraph({ text: 'Сумма', bold: true, alignment: AlignmentType.RIGHT, size: 18 })] }),
              ],
            }),
            // Позиция
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: '1', alignment: AlignmentType.CENTER, size: 18 })] }),
                new TableCell({ children: [new Paragraph({ text: invoice.description || `Оплата по договору № ${invoice.contract?.number}`, size: 18 })] }),
                new TableCell({ children: [new Paragraph({ text: '1', alignment: AlignmentType.CENTER, size: 18 })] }),
                new TableCell({ children: [new Paragraph({ text: 'шт', alignment: AlignmentType.CENTER, size: 18 })] }),
                new TableCell({ children: [new Paragraph({ text: invoice.vat_rate > 0 ? `${invoice.vat_rate}%` : 'Без НДС', alignment: AlignmentType.CENTER, size: 18 })] }),
                new TableCell({ children: [new Paragraph({ text: invoice.amount.toLocaleString('ru-RU'), alignment: AlignmentType.RIGHT, size: 18 })] }),
                new TableCell({ children: [new Paragraph({ text: invoice.amount.toLocaleString('ru-RU'), alignment: AlignmentType.RIGHT, size: 18 })] }),
              ],
            }),
          ],
        }),

        // Итоговый блок
        new Paragraph({
          spacing: { before: 100 },
          children: [
            new TextRun({ text: `Всего наименований 1, на сумму ${invoice.total_amount.toLocaleString('ru-RU')} руб.`, size: 18 }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 100 },
          children: [
            new TextRun({ text: `Итого к оплате: ${invoice.total_amount.toLocaleString('ru-RU')} руб.`, bold: true, size: 18 }),
          ],
        }),

        // Сумма прописью
        new Paragraph({
          spacing: { after: 300 },
          children: [
            new TextRun({ text: numberToWords(invoice.total_amount), italics: true, size: 18 }),
          ],
        }),

        // Подписи (как в PDF)
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
                    new Paragraph({ text: 'Руководитель', size: 18 }),
                    new Paragraph({ text: '', spacing: { before: 300 } }),
                    new Paragraph({ 
                      border: {
                        bottom: {
                          color: "000000",
                          space: 1,
                          style: BorderStyle.SINGLE,
                          size: 6,
                        },
                      },
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 50, type: 'pct' },
                  children: [
                    new Paragraph({ text: 'Бухгалтер', size: 18 }),
                    new Paragraph({ text: '', spacing: { before: 300 } }),
                    new Paragraph({ 
                      border: {
                        bottom: {
                          color: "000000",
                          space: 1,
                          style: BorderStyle.SINGLE,
                          size: 6,
                        },
                      },
                    }),
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
