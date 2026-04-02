import { Document, Paragraph, TextRun, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel, Packer } from 'docx';
import type { Contract, ContractTemplateData, PDFSettings, CompanyBankAccount, Company } from '../types';
import { numberToWords } from '../types/contracts';

// Генерация HTML для предпросмотра и печати
export function generateContractHTML(contract: Contract, pdfSettings: PDFSettings, bankAccounts: CompanyBankAccount[] = [], company?: Company | null, includeHeader: boolean = false): string {
  const template = contract.template;
  if (!template) {
    return '<p>Шаблон не найден</p>';
  }

  // Используем отредактированный контент если есть, иначе генерируем из шаблона
  let html: string;
  if (contract.content) {
    // Используем сохранённый отредактированный контент
    html = contract.content;
  } else {
    // Генерируем из шаблона с заменой плейсхолдеров
    const data = prepareTemplateData(contract, pdfSettings, bankAccounts, company);
    html = template.content;
    html = html.replace(/{{(\w+)}}/g, (match, key) => {
      return (data as Record<string, string>)[key] || '';
    });
  }

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

      // Определяем порядок категорий: сначала category_order из сметы, затем порядок появления
      const categoryOrder = estimate.category_order || [];
      const allCategories = Object.keys(grouped);
      
      // Сортируем категории: сначала те, что в category_order, затем остальные в порядке появления
      const sortedCategories = [...allCategories].sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        
        // Если обе категории в category_order - сортируем по индексу
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        // Если только a в category_order - она первее
        if (indexA !== -1) return -1;
        // Если только b в category_order - она первее
        if (indexB !== -1) return 1;
        // Если ни одна не в category_order - сохраняем порядок появления (исходный порядок в allCategories)
        return allCategories.indexOf(a) - allCategories.indexOf(b);
      });

      sortedCategories.forEach(category => {
        const items = grouped[category];
        tableHTML += `<tr style="background:#f5f5f5;"><td colspan="6"><strong>${category}</strong></td></tr>`;
        items?.forEach(item => {
          const sum = item.price * item.quantity * (item.coefficient || 1);
          // Объединяем наименование и описание
          let nameWithDescription = item.name;
          if (item.description && item.description.trim()) {
            nameWithDescription += `<br/>${item.description}`;
          }
          tableHTML += `<tr>` +
            `<td>${globalIndex++}</td>` +
            `<td>${nameWithDescription}</td>` +
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

// Конвертация HTML в DOCX параграфы (простая версия)
function htmlToDocxParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  
  // Создаем временный div для парсинга HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Удаляем скрипты и стили
  const scripts = tempDiv.querySelectorAll('script, style');
  scripts.forEach(el => el.remove());
  
  // Обрабатываем элементы
  const processNode = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text })],
        }));
      }
      return;
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      
      // Пропускаем таблицы - их обрабатываем отдельно
      if (tagName === 'table') {
        // Таблицы будут обработаны отдельно
        return;
      }
      
      // Заголовки
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        const text = element.textContent?.trim();
        if (text) {
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text, bold: true, size: 28 })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }));
        }
        return;
      }
      
      // Параграфы и div
      if (tagName === 'p' || tagName === 'div') {
        // Рекурсивно обрабатываем дочерние элементы
        const children: (TextRun | any)[] = [];
        element.childNodes.forEach(child => {
          if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent?.trim();
            if (text) children.push(new TextRun({ text }));
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const childEl = child as HTMLElement;
            const childTag = childEl.tagName.toLowerCase();
            const text = childEl.textContent?.trim();
            if (!text) return;
            
            if (childTag === 'b' || childTag === 'strong') {
              children.push(new TextRun({ text, bold: true }));
            } else if (childTag === 'i' || childTag === 'em') {
              children.push(new TextRun({ text, italics: true }));
            } else if (childTag === 'u') {
              children.push(new TextRun({ text, underline: { type: 'single' } }));
            } else if (childTag === 'br') {
              // Игнорируем br внутри параграфа
            } else {
              children.push(new TextRun({ text }));
            }
          }
        });
        
        if (children.length > 0) {
          paragraphs.push(new Paragraph({ children }));
        }
        return;
      }
      
      // Списки
      if (tagName === 'ul' || tagName === 'ol') {
        element.querySelectorAll('li').forEach(li => {
          const text = li.textContent?.trim();
          if (text) {
            paragraphs.push(new Paragraph({
              children: [new TextRun({ text: '• ' + text })],
              indent: { left: 360 },
            }));
          }
        });
        return;
      }
      
      // Рекурсивно обрабатываем другие элементы
      element.childNodes.forEach(processNode);
    }
  };
  
  tempDiv.childNodes.forEach(processNode);
  
  return paragraphs;
}

// Экспорт в DOCX
export async function exportContractToDOCX(contract: Contract, pdfSettings: PDFSettings, bankAccounts: CompanyBankAccount[] = [], company?: Company | null): Promise<void> {
  // Если есть отредактированный контент, используем его
  if (contract.content) {
    try {
      const paragraphs = htmlToDocxParagraphs(contract.content);
      
      // Добавляем спецификацию если есть сметы
      const estimates = contract.estimates || [];
      if (estimates.length > 0) {
        const data = prepareTemplateData(contract, pdfSettings, bankAccounts, company);
        
        // Добавляем разрыв страницы и спецификацию
        paragraphs.push(new Paragraph({ text: '', pageBreakBefore: true }));
        paragraphs.push(new Paragraph({
          text: 'Приложение № 1',
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }));
        paragraphs.push(new Paragraph({
          text: `к Договору возмездного оказания услуг № ${data.contract_number} от ${data.contract_date}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }));
        paragraphs.push(new Paragraph({
          text: 'СПЕЦИФИКАЦИЯ',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }));
        
        // Добавляем таблицу спецификации
        const specRows: TableRow[] = [];
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
        
        // ... добавляем строки спецификации
        let globalIndex = 1;
        estimates.forEach(ce => {
          const estimate = ce.estimate;
          if (!estimate?.items || estimate.items.length === 0) return;
          
          const grouped = estimate.items.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
          }, {} as Record<string, typeof estimate.items>);
          
          const categoryOrder = estimate.category_order || [];
          const allCategories = Object.keys(grouped);
          const sortedCategories = [...allCategories].sort((a, b) => {
            const indexA = categoryOrder.indexOf(a);
            const indexB = categoryOrder.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return allCategories.indexOf(a) - allCategories.indexOf(b);
          });
          
          sortedCategories.forEach(category => {
            const items = grouped[category];
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
              const nameCellChildren: Paragraph[] = [
                new Paragraph({ children: [new TextRun({ text: item.name })] })
              ];
              if (item.description?.trim()) {
                nameCellChildren.push(
                  new Paragraph({ children: [new TextRun({ text: item.description })] })
                );
              }
              
              specRows.push(
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(globalIndex++) })] })] }),
                    new TableCell({ children: nameCellChildren }),
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
        
        specRows.push(
          new TableRow({
            children: [
              new TableCell({ columnSpan: 5, children: [new Paragraph({ children: [new TextRun({ text: 'Итого:', bold: true })], alignment: AlignmentType.RIGHT })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: data.total_amount, bold: true })] })] }),
            ],
          })
        );
        
        paragraphs.push(
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
          children: paragraphs,
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
      return;
    } catch (error) {
      console.error('Error converting HTML to DOCX:', error);
      // Fallback to default generation
    }
  }
  
  // Стандартная генерация из шаблона (если нет отредактированного контента или при ошибке)
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

      // Определяем порядок категорий: сначала category_order из сметы, затем порядок появления
      const categoryOrder = estimate.category_order || [];
      const allCategories = Object.keys(grouped);
      
      // Сортируем категории: сначала те, что в category_order, затем остальные в порядке появления
      const sortedCategories = [...allCategories].sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        
        // Если обе категории в category_order - сортируем по индексу
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        // Если только a в category_order - она первее
        if (indexA !== -1) return -1;
        // Если только b в category_order - она первее
        if (indexB !== -1) return 1;
        // Если ни одна не в category_order - сохраняем порядок появления
        return allCategories.indexOf(a) - allCategories.indexOf(b);
      });

      sortedCategories.forEach(category => {
        const items = grouped[category];
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
          
          // Создаем ячейку с наименованием и описанием
          const nameCellChildren: Paragraph[] = [
            new Paragraph({ children: [new TextRun({ text: item.name })] })
          ];
          
          // Добавляем описание если есть
          if (item.description && item.description.trim()) {
            nameCellChildren.push(
              new Paragraph({ 
                children: [new TextRun({ text: item.description })] 
              })
            );
          }
          
          specRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(globalIndex++) })] })] }),
                new TableCell({ children: nameCellChildren }),
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

// Экспорт в DOC формат (Word 97-2003)
// На самом деле создаем HTML с Word-специфичными тегами, который Word откроет как DOC
export function exportContractToDOC(contract: Contract, pdfSettings: PDFSettings, bankAccounts: CompanyBankAccount[] = [], company?: Company | null): void {
  const html = generateContractHTML(contract, pdfSettings, bankAccounts, company, true);
  
  // Добавляем Word-специфичные метатеги для корректного открытия в Word
  const docHtml = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:w="urn:schemas-microsoft-com:office:word" 
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <meta name=ProgId content=Word.Document>
  <meta name=Generator content="Microsoft Word 15">
  <meta name=Originator content="Microsoft Word 15">
  <link rel=File-List href="filelist.xml">
  <title>Договор № ${contract.number}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    /* Word-специфичные стили */
    @page {
      size: 21cm 29.7cm;
      margin: 2cm 1.5cm 2cm 3cm;
    }
    @page Section1 {
      mso-page-orientation: portrait;
      mso-page-margin: 2cm 1.5cm 2cm 3cm;
    }
    div.Section1 { page: Section1; }
    
    /* Основные стили для Word */
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
      background: #fff;
    }
    
    p {
      margin: 0;
      padding: 0;
      text-align: justify;
      text-indent: 0;
    }
    
    p.MsoNormal {
      mso-style-name: "Обычный";
      mso-style-parent: "";
      margin: 0;
      margin-bottom: 6pt;
      text-align: justify;
      line-height: 150%;
    }
    
    h1 {
      mso-style-name: "Заголовок 1";
      mso-style-next: "Обычный";
      margin-top: 12pt;
      margin-bottom: 6pt;
      text-align: center;
      page-break-after: avoid;
      font-size: 14pt;
      font-weight: bold;
    }
    
    h2 {
      mso-style-name: "Заголовок 2";
      mso-style-next: "Обычный";
      margin-top: 12pt;
      margin-bottom: 6pt;
      text-align: center;
      page-break-after: avoid;
      font-size: 12pt;
      font-weight: bold;
    }
    
    table {
      mso-table-layout-alt: auto;
      border-collapse: collapse;
      width: 100%;
    }
    
    table td, table th {
      border: 1pt solid windowtext;
      padding: 5pt;
      mso-border-alt: solid windowtext .5pt;
    }
    
    table.spec {
      mso-table-layout-alt: auto;
      border-collapse: collapse;
      width: 100%;
      font-size: 10pt;
    }
    
    table.spec th {
      background: #f0f0f0;
      font-weight: bold;
      text-align: center;
      border: 1pt solid windowtext;
      mso-border-alt: solid windowtext .5pt;
      padding: 5pt;
    }
    
    table.spec td {
      border: 1pt solid windowtext;
      mso-border-alt: solid windowtext .5pt;
      padding: 5pt;
    }
    
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .section { margin: 15pt 0; }
    .section-title { 
      font-weight: bold; 
      text-align: center; 
      margin: 20pt 0 10pt 0;
    }
    .page-break { page-break-before: always; }
    
    /* Реквизиты */
    .requisites-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20pt 0;
    }
    .requisites-table td {
      width: 50%;
      vertical-align: top;
      padding: 15pt;
      border: 1pt solid windowtext;
      mso-border-alt: solid windowtext .5pt;
    }
  </style>
</head>
<body lang=RU>
  <div class=Section1>
    ${html.replace(/<body[^>]*>/, '').replace(/<\/body>/, '')}
  </div>
</body>
</html>`;

  // Создаем Blob с MIME-типом для Word
  const blob = new Blob([docHtml], { 
    type: 'application/msword' 
  });
  
  // Скачиваем файл
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Договор_${contract.number}_${contract.customer?.name || 'без_заказчика'}.doc`;
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
