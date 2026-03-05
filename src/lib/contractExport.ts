import { Document, Paragraph, TextRun, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel, Packer, ImageRun } from 'docx';
import type { Contract, ContractTemplateData, PDFSettings } from '../types';

// Конвертация base64 в Uint8Array для изображений
function base64ToUint8Array(base64: string): Uint8Array {
  const base64Data = base64.split(',')[1] || base64;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Генерация HTML для предпросмотра и печати
export function generateContractHTML(contract: Contract, pdfSettings: PDFSettings): string {
  const template = contract.template;
  if (!template) {
    return '<p>Шаблон не найден</p>';
  }

  const data = prepareTemplateData(contract, pdfSettings);
  
  // Замена плейсхолдеров
  let html = template.content;
  html = html.replace(/{{(\w+)}}/g, (match, key) => {
    return (data as Record<string, string>)[key] || '';
  });

  // Добавляем шапку с настройками PDF
  const headerHTML = generateHeaderHTML(pdfSettings);
  
  // Вставляем шапку перед содержимым договора
  html = html.replace('<body>', `<body>${headerHTML}`);

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
function prepareTemplateData(contract: Contract, pdfSettings: PDFSettings): ContractTemplateData {
  const customer = contract.customer;
  const estimates = contract.estimates || [];
  
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
    estimates.forEach(ce => {
      const estimate = ce.estimate;
      if (!estimate || !estimate.items) return;

      // Группируем по категориям
      const grouped = estimate.items.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      }, {} as Record<string, typeof estimate.items>);

      Object.entries(grouped).forEach(([category, items]) => {
        tableHTML += `<tr style="background:#e3f2fd;"><td colspan="6"><strong>${category}</strong></td></tr>`;
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

    tableHTML += '</tbody></table>';
    return tableHTML;
  };

  // Сумма прописью (упрощённая версия)
  const numberToWords = (num: number): string => {
    const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать'];
    const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
    
    const rubles = Math.floor(num);
    const cents = Math.round((num - rubles) * 100);
    
    let result = '';
    
    if (rubles === 0) return 'ноль рублей';
    
    const th = Math.floor(rubles / 1000);
    const rest = rubles % 1000;
    
    if (th > 0) {
      result += th < 5 ? ['', 'одна тысяча', 'две тысячи', 'три тысячи', 'четыре тысячи'][th] + ' ' : th + ' тысяч ';
    }
    
    const h = Math.floor(rest / 100);
    const t = Math.floor((rest % 100) / 10);
    const o = rest % 10;
    
    if (h > 0) result += hundreds[h] + ' ';
    
    if (t === 1) {
      result += teens[o] + ' ';
    } else {
      if (t > 1) result += tens[t] + ' ';
      if (o > 0) result += ones[o] + ' ';
    }
    
    result += o === 1 && t !== 1 ? 'рубль' : [2, 3, 4].includes(o) && t !== 1 ? 'рубля' : 'рублей';
    result += ' ' + cents.toString().padStart(2, '0') + ' копеек';
    
    return result.trim();
  };

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
    
    executor_name: contract.executor_name || pdfSettings.companyName || '',
    executor_representative: contract.executor_representative || pdfSettings.personName || '',
    executor_basis: contract.executor_basis || 'Устава',
    
    event_name: contract.event_name || estimates[0]?.estimate?.event_name || '',
    event_date: formatDate(contract.event_start_date) || formatDate(estimates[0]?.estimate?.event_date) || '',
    event_venue: contract.venue || estimates[0]?.estimate?.venue || '',
    
    total_amount: contract.total_amount.toLocaleString('ru-RU'),
    total_amount_text: numberToWords(contract.total_amount),
    payment_terms: contract.payment_terms || 'Оплата в течение 15 банковских дней с даты подписания Акта сдачи-приемки услуг.',
    
    specification_table: generateSpecTable(),
  };
}

// Экспорт в DOCX
export async function exportContractToDOCX(contract: Contract, pdfSettings: PDFSettings): Promise<void> {
  const data = prepareTemplateData(contract, pdfSettings);
  const estimates = contract.estimates || [];

  // Создаём параграфы
  const children: Paragraph[] = [];

  // Шапка с логотипом и реквизитами компании
  if (pdfSettings.logo || pdfSettings.companyName || pdfSettings.companyDetails) {
    const headerChildren: Paragraph[] = [];
    
    if (pdfSettings.companyName) {
      headerChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: pdfSettings.companyName,
              bold: true,
              size: 24, // 12pt
              color: "000000",
            }),
          ],
          spacing: { after: 100 },
        })
      );
    }
    
    if (pdfSettings.companyDetails) {
      pdfSettings.companyDetails.split('\n').forEach(line => {
        headerChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                size: 20, // 10pt
                color: "000000",
              }),
            ],
            spacing: { after: 50 },
          })
        );
      });
    }
    
    // Добавляем разделительную линию
    headerChildren.push(
      new Paragraph({
        text: '',
        spacing: { after: 200 },
        border: {
          bottom: {
            color: '999999',
            space: 1,
            value: 'single',
            size: 6,
          },
        },
      })
    );
    
    children.push(...headerChildren);
  }

  // Заголовок
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ',
          bold: true,
          size: 28,
          color: "000000",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `№ ${data.contract_number} от ${data.contract_date}`,
          color: "000000",
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
        new TextRun({ text: data.executor_name, bold: true, color: "000000" }),
        new TextRun({ text: ', именуемое в дальнейшем «Исполнитель», в лице ', color: "000000" }),
        new TextRun({ text: data.executor_representative, bold: true, color: "000000" }),
        new TextRun({ text: ', действующего на основании ', color: "000000" }),
        new TextRun({ text: data.executor_basis, bold: true, color: "000000" }),
        new TextRun({ text: ', с одной стороны, и ', color: "000000" }),
        new TextRun({ text: data.customer_name, bold: true, color: "000000" }),
        new TextRun({ text: ', именуемое в дальнейшем «Заказчик», в лице ', color: "000000" }),
        new TextRun({ text: data.customer_representative, bold: true, color: "000000" }),
        new TextRun({ text: ', действующего на основании ', color: "000000" }),
        new TextRun({ text: data.customer_basis, bold: true, color: "000000" }),
        new TextRun({ text: ', с другой стороны, вместе именуемые «Стороны», заключили настоящий договор о нижеследующем:', color: "000000" }),
      ],
      spacing: { after: 300 },
    })
  );

  // Раздел 1: Предмет договора
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '1. Предмет договора', bold: true, color: "000000" }),
      ],
      spacing: { before: 300, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '1.1. По настоящему Договору Исполнитель обязуется по заданию Заказчика оказать услуги по техническому оснащению мероприятия «', color: "000000" }),
        new TextRun({ text: data.event_name, bold: true, color: "000000" }),
        new TextRun({ text: '», ', color: "000000" }),
        new TextRun({ text: data.event_date, bold: true, color: "000000" }),
        new TextRun({ text: '.', color: "000000" }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '1.2. Заказчик обязуется принять и оплатить услуги согласно спецификации (Приложение № 1), являющейся неотъемлемой частью настоящего Договора.', color: "000000" }),
      ],
      spacing: { after: 200 },
    })
  );

  // Раздел 2: Цена и порядок расчетов
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '2. Цена договора и порядок расчетов', bold: true, color: "000000" }),
      ],
      spacing: { before: 300, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '2.1. Стоимость услуг составляет ', color: "000000" }),
        new TextRun({ text: data.total_amount, bold: true, color: "000000" }),
        new TextRun({ text: ' (', color: "000000" }),
        new TextRun({ text: data.total_amount_text, italics: true, color: "000000" }),
        new TextRun({ text: '), НДС не облагается.', color: "000000" }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `2.2. ${data.payment_terms}`, color: "000000" }),
      ],
      spacing: { after: 200 },
    })
  );

  // Раздел 3: Сроки
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '3. Сроки оказания услуг', bold: true, color: "000000" }),
      ],
      spacing: { before: 300, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '3.1. Услуги оказываются: ', color: "000000" }),
        new TextRun({ text: data.event_date, bold: true, color: "000000" }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '3.2. Место оказания услуг: ', color: "000000" }),
        new TextRun({ text: data.event_venue, bold: true, color: "000000" }),
      ],
      spacing: { after: 200 },
    })
  );

  // Раздел 4: Ответственность
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '4. Ответственность сторон', bold: true, color: "000000" }),
      ],
      spacing: { before: 300, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '4.1. Стороны несут ответственность за нарушение условий настоящего Договора в соответствии с законодательством РФ.', color: "000000" }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '4.2. Сторона, не исполнившая или ненадлежащим образом исполнившая обязательства, обязана возместить другой стороне причиненные убытки.', color: "000000" }),
      ],
      spacing: { after: 200 },
    })
  );

  // Раздел 5: Заключительные положения
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '5. Заключительные положения', bold: true, color: "000000" }),
      ],
      spacing: { before: 300, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '5.1. Настоящий Договор вступает в силу с момента подписания и действует до полного исполнения сторонами своих обязательств.', color: "000000" }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '5.2. Договор составлен в двух экземплярах, имеющих одинаковую юридическую силу.', color: "000000" }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '5.3. Изменения и дополнения к Договору действительны при условии их письменного оформления и подписания обеими Сторонами.', color: "000000" }),
      ],
      spacing: { after: 300 },
    })
  );

  // Подписи с настройками PDF
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '6. Адреса и реквизиты сторон', bold: true, color: "000000" }),
      ],
      spacing: { before: 300, after: 400 },
    })
  );

  // Данные для подписей
  const executorPosition = pdfSettings.position || '';
  const executorName = pdfSettings.personName || data.executor_representative;

  // Таблица подписей
  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: 'Исполнитель:', bold: true, color: "000000" })] }),
              new Paragraph({ children: [new TextRun({ text: data.executor_name, color: "000000" })] }),
              new Paragraph({ children: [new TextRun({ text: executorPosition, color: "000000" })] }),
              new Paragraph({ children: [new TextRun({ text: executorName, color: "000000" })] }),
              new Paragraph({ children: [new TextRun({ text: '', color: "000000" })] }),
              new Paragraph({ children: [new TextRun({ text: '_______________ / _______________', color: "000000" })] }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: 'Заказчик:', bold: true, color: "000000" })] }),
              new Paragraph({ children: [new TextRun({ text: data.customer_name, color: "000000" })] }),
              new Paragraph({ children: [new TextRun({ text: data.customer_representative, color: "000000" })] }),
              new Paragraph({ children: [new TextRun({ text: '', color: "000000" })] }),
              new Paragraph({ children: [new TextRun({ text: '', color: "000000" })] }),
              new Paragraph({ children: [new TextRun({ text: '_______________ / _______________', color: "000000" })] }),
            ],
          }),
        ],
      }),
    ],
  });

  // Приложение - Спецификация
  if (estimates.length > 0) {
    children.push(
      new Paragraph({
        text: '',
        pageBreakBefore: true,
      }),
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
    
    // Заголовок таблицы
    specRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '№', bold: true, color: "000000" })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Наименование', bold: true, color: "000000" })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Кол-во', bold: true, color: "000000" })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ед.', bold: true, color: "000000" })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Цена', bold: true, color: "000000" })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Сумма', bold: true, color: "000000" })] })] }),
        ],
      })
    );

    let globalIndex = 1;
    estimates.forEach(ce => {
      const estimate = ce.estimate;
      if (!estimate?.items) return;

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
                children: [new Paragraph({ children: [new TextRun({ text: category, bold: true, color: "000000" })] })],
              }),
            ],
          })
        );

        items?.forEach(item => {
          const sum = item.price * item.quantity * (item.coefficient || 1);
          specRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(globalIndex++), color: "000000" })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.name, color: "000000" })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(item.quantity), color: "000000" })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.unit, color: "000000" })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.price.toLocaleString('ru-RU'), color: "000000" })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: sum.toLocaleString('ru-RU'), color: "000000" })] })] }),
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
          new TableCell({ columnSpan: 5, children: [new Paragraph({ text: 'Итого:', bold: true, alignment: AlignmentType.RIGHT })] }),
          new TableCell({ children: [new Paragraph({ text: data.total_amount, bold: true })] }),
        ],
      })
    );

    const specTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: specRows,
    });

    children.push(specTable);
  }

  // Создаём документ
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1134, // 2 cm
            right: 850, // 1.5 cm
            bottom: 1134,
            left: 1701, // 3 cm (для подшивки)
          },
        },
      },
      children: [
        ...children,
        new Paragraph({ text: '', spacing: { before: 400 } }),
        signatureTable,
      ],
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
export function printContract(contract: Contract, pdfSettings: PDFSettings): void {
  const html = generateContractHTML(contract, pdfSettings);
  
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
