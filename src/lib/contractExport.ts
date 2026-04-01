import { Document, Paragraph, TextRun, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel, Packer } from 'docx';
import type { Contract, ContractTemplateData, PDFSettings, CompanyBankAccount, Company } from '../types';
import { numberToWords } from '../types/contracts';

// Генерация HTML для предпросмотра и печати
export function generateContractHTML(contract: Contract, pdfSettings: PDFSettings, bankAccounts: CompanyBankAccount[] = [], company?: Company | null, includeHeader: boolean = false): string {
  const template = contract.template;
  if (!template) {
    return '<p>Шаблон не найден</p>';
  }

  const data = prepareTemplateData(contract, pdfSettings, bankAccounts, company);
  
  // Замена плейсхолдеров
  let html = template.content;
  html = html.replace(/{{(\w+)}}/g, (match, key) => {
    return (data as Record<string, string>)[key] || '';
  });

  // Добавляем шапку с настройками PDF только если явно запрошено
  if (includeHeader) {
    const headerHTML = generateHeaderHTML(pdfSettings);
    html = html.replace('<body>', `<body>${headerHTML}`);
  }

  // Возвращаем HTML без глобальных стилей - стили будут применены через inline style в компоненте
  return html;
}

// Генерация шапки с настройками PDF
function generateHeaderHTML(pdfSettings: PDFSettings): string {
  const logoHTML = pdfSettings.logo ? `<img src="${pdfSettings.logo}" alt="Логотип" style="max-height: 80px; max-width: 200px;" />` : '';
  const companyHTML = pdfSettings.companyName ? `<h2 style="margin: 0; font-size: 14px;">${pdfSettings.companyName}</h2>` : '';
  const detailsHTML = pdfSettings.companyDetails ? pdfSettings.companyDetails.split('\n').map(line => `<p style="margin: 3px 0; font-size: 11px;">${line}</p>`).join('') : '';
  
  return `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px;">
      <div style="width: 45%;">
        ${logoHTML}
      </div>
      <div style="width: 50%; text-align: right; font-size: 11px;">
        ${companyHTML}
        ${detailsHTML}
      </div>
    </div>
  `;
}

// Подготовка данных для шаблона
function prepareTemplateData(contract: Contract, pdfSettings: PDFSettings, bankAccounts: CompanyBankAccount[] = [], company?: Company | null): ContractTemplateData {
  const customer = contract.customer;
  const estimates = contract.estimates || [];
  
  // Получаем банковский счёт исполнителя
  const executorAccount = contract.bank_account_id 
    ? bankAccounts.find(a => a.id === contract.bank_account_id)
    : bankAccounts.find(a => a.is_default) || bankAccounts[0];
  
  // Форматируем дату
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Генерируем таблицу спецификации
  const generateSpecTable = (): string => {
    if (estimates.length === 0) {
      return '<p>Сметы не привязаны</p>';
    }

    let tableHTML = '<table class="spec"><thead><tr>' +
      '<th>№</th><th>Наименование</th><th>Кол-во</th><th>Ед.</th><th>Цена</th><th>Сумма</th>' +
      '</tr></thead><tbody>';

    let globalIndex = 1;
    let hasItems = false;
    
    estimates.forEach(ce => {
      const estimate = ce.estimate;
      if (!estimate || !estimate.items || estimate.items.length === 0) return;

      hasItems = true;
      
      // Группируем по категориям
      const grouped = estimate.items.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      }, {} as Record<string, typeof estimate.items>);

      Object.entries(grouped).forEach(([category, items]) => {
        tableHTML += `<tr style="background:#f5f5f5;"><td colspan="6"><strong>${category}</strong></td></tr>`;
        items?.forEach(item => {
          const sum = item.price * item.quantity * (item.coefficient || 1);
          tableHTML += `<tr>` +
            `<td>${globalIndex++}</td>` +
            `<td>${item.name}</td>` +
            `<td>${item.quantity}</td>` +
            `<td>${item.unit}</td>` +
            `<td>${item.price.toLocaleString('ru-RU')}</td>` +
            `<td>${sum.toLocaleString('ru-RU')}</td>` +
            `</tr>`;
        });
      });
    });

    if (!hasItems) {
      return '<p>Позиции сметы не найдены</p>';
    }

    tableHTML += '</tbody></table>';
    return tableHTML;
  };

  // Используем numberToWords из types/contracts.ts

  const customerTypeLabels: Record<string, string> = {
    company: 'Общество с ограниченной ответственностью',
    ip: 'Индивидуальный предприниматель',
    individual: 'Физическое лицо',
  };

  return {
    contract_number: contract.number,
    contract_date: formatDate(contract.date),
    
    customer_name: customer?.name || '',
    customer_type: customer ? (customerTypeLabels[customer.type] || customer.type) : '',
    customer_type_short: customer?.type === 'ip' ? 'ИП' : customer?.type === 'company' ? 'ООО' : '',
    customer_representative_short: getShortName(customer?.contact_person || ''),
    customer_inn: customer?.inn || '',
    customer_kpp: customer?.kpp || '',
    customer_ogrn: customer?.ogrn || '',
    customer_address: customer?.legal_address || '',
    customer_representative: customer?.contact_person || '',
    customer_basis: 'Устава', // TODO: добавить поле в customer
    customer_bank_name: customer?.bank_name || '',
    customer_bank_bik: customer?.bank_bik || '',
    customer_bank_account: customer?.bank_account || '',
    customer_bank_corr_account: customer?.bank_corr_account || '',
    
    executor_type: company?.type === 'ip' ? 'Индивидуальный предприниматель' : 'Общество с ограниченной ответственностью',
    executor_type_short: company?.type === 'ip' ? 'ИП' : 'ООО',
    executor_name: contract.executor_name || company?.name || pdfSettings.companyName || '',
    executor_representative: contract.executor_representative || pdfSettings.personName || '',
    executor_representative_short: getShortName(contract.executor_representative || pdfSettings.personName || ''),
    executor_basis: contract.executor_basis || 'Устава',
    executor_inn: company?.inn || '',
    executor_kpp: company?.kpp || '',
    executor_ogrn: company?.ogrn || '',
    executor_address: company?.legal_address || '',
    executor_phone: company?.phone || '',
    executor_email: company?.email || '',
    executor_bank_name: executorAccount?.bank_name || '',
    executor_bank_bik: executorAccount?.bik || '',
    executor_bank_account: executorAccount?.account || '',
    executor_bank_corr_account: executorAccount?.corr_account || '',
    
    event_name: contract.event_name || estimates[0]?.estimate?.event_name || '',
    event_date: formatDate(contract.event_start_date) || formatDate(estimates[0]?.estimate?.event_date) || '',
    event_venue: contract.venue || estimates[0]?.estimate?.venue || '',
    event_city: (contract.venue || estimates[0]?.estimate?.venue || '').split(',')[0] || 'Красноярск',
    
    total_amount: contract.total_amount.toLocaleString('ru-RU'),
    total_amount_text: numberToWords(contract.total_amount),
    payment_terms: contract.payment_terms || 'Оплата в течение 15 банковских дней с даты подписания Акта сдачи-приемки услуг.',
    
    specification_table: generateSpecTable(),
  };
}

// Функция для получения сокращённого ФИО (Иванов И.И.)
function getShortName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const lastName = parts[0];
  const initials = parts.slice(1).map(n => n[0]?.toUpperCase() + '.').join('');
  return `${lastName} ${initials}`;
}

// Функция для очистки текста от HTML и спецсимволов
function cleanText(text: string | undefined | null): string {
  if (!text) return '';
  // Удаляем HTML теги
  return text.replace(/<[^>]*>/g, '').trim();
}

// Экспорт в DOCX
export async function exportContractToDOCX(contract: Contract, pdfSettings: PDFSettings, bankAccounts: CompanyBankAccount[] = [], company?: Company | null): Promise<void> {
  const data = prepareTemplateData(contract, pdfSettings, bankAccounts, company);
  const estimates = contract.estimates || [];

  // Создаём параграфы
  const children: Paragraph[] = [];

  // Заголовок
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ',
          bold: true,
          size: 28,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `№ ${data.contract_number} от ${data.contract_date}`,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Стороны
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: data.executor_name, bold: true }),
        new TextRun({ text: ', именуемое в дальнейшем "Исполнитель", в лице ' }),
        new TextRun({ text: data.executor_representative, bold: true }),
        new TextRun({ text: ', действующего на основании ' }),
        new TextRun({ text: data.executor_basis, bold: true }),
        new TextRun({ text: ', с одной стороны, и ' }),
        new TextRun({ text: data.customer_name, bold: true }),
        new TextRun({ text: ', именуемое в дальнейшем "Заказчик", в лице ' }),
        new TextRun({ text: data.customer_representative, bold: true }),
        new TextRun({ text: ', действующего на основании ' }),
        new TextRun({ text: data.customer_basis, bold: true }),
        new TextRun({ text: ', с другой стороны, вместе именуемые "Стороны", заключили настоящий договор о нижеследующем:' }),
      ],
      spacing: { after: 300 },
    })
  );

  // Раздел 1: Предмет договора
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '1. Предмет договора', bold: true })],
      spacing: { before: 300, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '1.1. По настоящему Договору Исполнитель обязуется по заданию Заказчика оказать услуги по техническому оснащению мероприятия ' }),
        new TextRun({ text: data.event_name, bold: true }),
        new TextRun({ text: ', ' }),
        new TextRun({ text: data.event_date, bold: true }),
        new TextRun({ text: '.' }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '1.2. Заказчик обязуется принять и оплатить услуги согласно спецификации (Приложение № 1), являющейся неотъемлемой частью настоящего Договора.' })],
      spacing: { after: 200 },
    })
  );

  // Раздел 2: Цена и порядок расчетов
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '2. Цена договора и порядок расчетов', bold: true })],
      spacing: { before: 300, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '2.1. Стоимость услуг составляет ' }),
        new TextRun({ text: data.total_amount, bold: true }),
        new TextRun({ text: ' (' }),
        new TextRun({ text: data.total_amount_text, italics: true }),
        new TextRun({ text: '), НДС не облагается.' }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `2.2. ${cleanText(data.payment_terms)}` })],
      spacing: { after: 200 },
    })
  );

  // Раздел 3: Сроки
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '3. Сроки оказания услуг', bold: true })],
      spacing: { before: 300, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '3.1. Услуги оказываются: ' }),
        new TextRun({ text: data.event_date, bold: true }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '3.2. Место оказания услуг: ' }),
        new TextRun({ text: data.event_venue, bold: true }),
      ],
      spacing: { after: 200 },
    })
  );

  // Раздел 4: Ответственность
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '4. Ответственность сторон', bold: true })],
      spacing: { before: 300, after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '4.1. Стороны несут ответственность за нарушение условий настоящего Договора в соответствии с законодательством РФ.' })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '4.2. Сторона, не исполнившая или ненадлежащим образом исполнившая обязательства, обязана возместить другой стороне причиненные убытки.' })],
      spacing: { after: 200 },
    })
  );

  // Раздел 5: Заключительные положения
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '5. Заключительные положения', bold: true })],
      spacing: { before: 300, after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '5.1. Настоящий Договор вступает в силу с момента подписания и действует до полного исполнения сторонами своих обязательств.' })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '5.2. Договор составлен в двух экземплярах, имеющих одинаковую юридическую силу.' })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '5.3. Изменения и дополнения к Договору действительны при условии их письменного оформления и подписания обеими Сторонами.' })],
      spacing: { after: 300 },
    })
  );

  // Реквизиты
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '6. Реквизиты сторон', bold: true })],
      spacing: { before: 300, after: 200 },
    })
  );

  // Таблица реквизитов
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({ children: [new TextRun({ text: 'ИСПОЛНИТЕЛЬ:', bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: data.executor_name })] }),
                new Paragraph({ children: [new TextRun({ text: `ИНН: ${data.executor_inn}` })] }),
                new Paragraph({ children: [new TextRun({ text: `КПП: ${data.executor_kpp}` })] }),
                new Paragraph({ children: [new TextRun({ text: `ОГРН: ${data.executor_ogrn}` })] }),
                new Paragraph({ children: [new TextRun({ text: `Адрес: ${data.executor_address}` })] }),
                new Paragraph({ children: [new TextRun({ text: '' })] }),
                new Paragraph({ children: [new TextRun({ text: 'Банковские реквизиты:', bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: `Банк: ${data.executor_bank_name}` })] }),
                new Paragraph({ children: [new TextRun({ text: `БИК: ${data.executor_bank_bik}` })] }),
                new Paragraph({ children: [new TextRun({ text: `Р/с: ${data.executor_bank_account}` })] }),
                new Paragraph({ children: [new TextRun({ text: `К/с: ${data.executor_bank_corr_account}` })] }),
                new Paragraph({ children: [new TextRun({ text: '' })] }),
                new Paragraph({ children: [new TextRun({ text: `Тел.: ${data.executor_phone}` })] }),
                new Paragraph({ children: [new TextRun({ text: `E-mail: ${data.executor_email}` })] }),
                new Paragraph({ children: [new TextRun({ text: '' })] }),
                new Paragraph({ children: [new TextRun({ text: `Представитель: ${data.executor_representative}` })] }),
                new Paragraph({ children: [new TextRun({ text: '_________________ / _________________' })] }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({ children: [new TextRun({ text: 'ЗАКАЗЧИК:', bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: data.customer_name })] }),
                new Paragraph({ children: [new TextRun({ text: `ИНН: ${data.customer_inn}` })] }),
                new Paragraph({ children: [new TextRun({ text: `КПП: ${data.customer_kpp}` })] }),
                new Paragraph({ children: [new TextRun({ text: `ОГРН: ${data.customer_ogrn}` })] }),
                new Paragraph({ children: [new TextRun({ text: `Адрес: ${data.customer_address}` })] }),
                new Paragraph({ children: [new TextRun({ text: '' })] }),
                new Paragraph({ children: [new TextRun({ text: 'Банковские реквизиты:', bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: `Банк: ${data.customer_bank_name}` })] }),
                new Paragraph({ children: [new TextRun({ text: `БИК: ${data.customer_bank_bik}` })] }),
                new Paragraph({ children: [new TextRun({ text: `Р/с: ${data.customer_bank_account}` })] }),
                new Paragraph({ children: [new TextRun({ text: `К/с: ${data.customer_bank_corr_account}` })] }),
                new Paragraph({ children: [new TextRun({ text: '' })] }),
                new Paragraph({ children: [new TextRun({ text: `Представитель: ${data.customer_representative}` })] }),
                new Paragraph({ children: [new TextRun({ text: '_________________ / _________________' })] }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // Приложение - Спецификация
  if (estimates.length > 0) {
    children.push(
      new Paragraph({ text: '', pageBreakBefore: true }),
      new Paragraph({
        text: 'Приложение № 1',
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: `к Договору возмездного оказания услуг № ${data.contract_number} от ${data.contract_date}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      }),
      new Paragraph({
        text: 'СПЕЦИФИКАЦИЯ',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      })
    );

    // Таблица спецификации
    const specRows: TableRow[] = [];
    
    // Заголовок
    specRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '№', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Наименование', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Кол-во', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ед.', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Цена', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Сумма', bold: true })] })] }),
        ],
      })
    );

    let globalIndex = 1;
    estimates.forEach(ce => {
      const estimate = ce.estimate;
      if (!estimate?.items || estimate.items.length === 0) return;

      // Группируем по категориям
      const grouped = estimate.items.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      }, {} as Record<string, typeof estimate.items>);

      Object.entries(grouped).forEach(([category, items]) => {
        // Заголовок категории
        specRows.push(
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 6,
                children: [new Paragraph({ children: [new TextRun({ text: category, bold: true })] })],
              }),
            ],
          })
        );

        items?.forEach(item => {
          const sum = item.price * item.quantity * (item.coefficient || 1);
          specRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(globalIndex++) })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.name })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(item.quantity) })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.unit })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.price.toLocaleString('ru-RU') })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: sum.toLocaleString('ru-RU') })] })] }),
              ],
            })
          );
        });
      });
    });

    // Итого
    specRows.push(
      new TableRow({
        children: [
          new TableCell({ columnSpan: 5, children: [new Paragraph({ children: [new TextRun({ text: 'Итого:', bold: true })], alignment: AlignmentType.RIGHT })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: data.total_amount, bold: true })] })] }),
        ],
      })
    );

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: specRows,
      })
    );
  }

  // Создаём документ
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1134,
            right: 850,
            bottom: 1134,
            left: 1134,
          },
        },
      },
      children,
    }],
  });

  // Генерируем и скачиваем файл
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Договор_${contract.number}_${contract.customer?.name || 'без_заказчика'}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Печать договора (открытие окна печати)
export function printContract(contract: Contract, pdfSettings: PDFSettings, bankAccounts: CompanyBankAccount[] = [], company?: Company | null): void {
  const html = generateContractHTML(contract, pdfSettings, bankAccounts, company);
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Не удалось открыть окно печати. Проверьте настройки блокировки всплывающих окон.');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 500);
}
