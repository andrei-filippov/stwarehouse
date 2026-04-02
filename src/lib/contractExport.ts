import { Document, Paragraph, TextRun, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel, Packer, BorderStyle } from 'docx';
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
    contract_subject: contract.subject || '',
    
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


// Экспорт в DOCX - используем библиотеку docx для создания настоящего DOCX файла
export async function exportContractToDOCX(contract: Contract, pdfSettings: PDFSettings, bankAccounts: CompanyBankAccount[] = [], company?: Company | null): Promise<void> {
  const template = contract.template;
  if (!template) {
    console.error('Шаблон не найден');
    return;
  }

  const data = prepareTemplateData(contract, pdfSettings, bankAccounts, company);
  const estimates = contract.estimates || [];

  // Заменяем плейсхолдеры в шаблоне
  let html = template.content;
  html = html.replace(/{{(\w+)}}/g, (match, key) => {
    return (data as Record<string, string>)[key] || '';
  });

  // Парсим HTML и создаём элементы DOCX
  const children = await convertHtmlToDocxElements(html, estimates, data.total_amount);

  // Создаём документ
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1134,   // 2cm
            right: 850,  // 1.5cm  
            bottom: 1134,// 2cm
            left: 1701,  // 3cm
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

// Конвертация HTML в элементы DOCX
async function convertHtmlToDocxElements(html: string, estimates: any[], totalAmount: string): Promise<(Paragraph | Table)[]> {
  const elements: (Paragraph | Table)[] = [];
  
  // Создаём временный div для парсинга
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Удаляем скрипты и стили
  const scripts = tempDiv.querySelectorAll('script, style');
  scripts.forEach(el => el.remove());
  
  // Обрабатываем дочерние элементы
  for (const node of Array.from(tempDiv.childNodes)) {
    const element = await processNode(node, estimates, totalAmount);
    if (element) {
      if (Array.isArray(element)) {
        elements.push(...element);
      } else {
        elements.push(element);
      }
    }
  }
  
  return elements;
}

// Обработка одного узла
async function processNode(node: Node, estimates: any[], totalAmount: string): Promise<(Paragraph | Table)[] | Paragraph | Table | null> {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (text) {
      return new Paragraph({
        children: [new TextRun({ text, font: 'Times New Roman', size: 24 })], // 12pt = 24 half-points
        spacing: { after: 120, line: 360 },
      });
    }
    return null;
  }
  
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    
    // Заголовки
    if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
      const text = el.textContent?.trim() || '';
      return new Paragraph({
        children: [new TextRun({ text, bold: true, font: 'Times New Roman', size: tagName === 'h1' ? 28 : 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 120 },
      });
    }
    
    // Параграфы
    if (tagName === 'p') {
      return convertParagraph(el);
    }
    
    // Дивы с текстом
    if (tagName === 'div') {
      // Если div содержит только текст
      if (el.children.length === 0) {
        const text = el.textContent?.trim();
        if (text) {
          return new Paragraph({
            children: [new TextRun({ text, font: 'Times New Roman', size: 24 })],
            spacing: { after: 120, line: 360 },
          });
        }
      }
      // Иначе обрабатываем рекурсивно
      const results: (Paragraph | Table)[] = [];
      for (const child of Array.from(el.childNodes)) {
        const result = await processNode(child, estimates, totalAmount);
        if (result) {
          if (Array.isArray(result)) results.push(...result);
          else results.push(result);
        }
      }
      return results;
    }
    
    // Таблицы
    if (tagName === 'table') {
      return convertTable(el, estimates, totalAmount);
    }
    
    // Списки
    if (tagName === 'ul' || tagName === 'ol') {
      const items: Paragraph[] = [];
      el.querySelectorAll('li').forEach(li => {
        const text = li.textContent?.trim();
        if (text) {
          items.push(new Paragraph({
            children: [new TextRun({ text: '• ' + text, font: 'Times New Roman', size: 24 })],
            indent: { left: 360 },
            spacing: { after: 60 },
          }));
        }
      });
      return items;
    }
    
    // Блочные элементы - обрабатываем рекурсивно
    if (['section', 'article', 'main', 'header', 'footer'].includes(tagName)) {
      const results: (Paragraph | Table)[] = [];
      for (const child of Array.from(el.childNodes)) {
        const result = await processNode(child, estimates, totalAmount);
        if (result) {
          if (Array.isArray(result)) results.push(...result);
          else results.push(result);
        }
      }
      return results;
    }
  }
  
  return null;
}

// Конвертация параграфа с inline-элементами
function convertParagraph(el: HTMLElement): Paragraph {
  const children: TextRun[] = [];
  
  function processInline(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        children.push(new TextRun({ 
          text, 
          font: 'Times New Roman', 
          size: 24 
        }));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const childEl = node as HTMLElement;
      const tag = childEl.tagName.toLowerCase();
      const text = childEl.textContent || '';
      
      if (tag === 'b' || tag === 'strong') {
        children.push(new TextRun({ text, bold: true, font: 'Times New Roman', size: 24 }));
      } else if (tag === 'i' || tag === 'em') {
        children.push(new TextRun({ text, italics: true, font: 'Times New Roman', size: 24 }));
      } else if (tag === 'u') {
        children.push(new TextRun({ text, underline: { type: 'single' }, font: 'Times New Roman', size: 24 }));
      } else if (tag === 'br') {
        // Перенос строки - добавляем разрыв в последний TextRun или создаём новый
        if (children.length > 0) {
          const last = children[children.length - 1];
          // Word понимает \n как разрыв строки
          last.properties = { ...last.properties, text: last.properties?.text + '\n' };
        }
      } else if (tag === 'span') {
        // Для span проверяем стили
        const style = childEl.getAttribute('style') || '';
        const isBold = style.includes('font-weight: bold') || style.includes('font-weight:bold');
        children.push(new TextRun({ 
          text, 
          bold: isBold, 
          font: 'Times New Roman', 
          size: 24 
        }));
      } else {
        // Рекурсивно обрабатываем другие элементы
        Array.from(childEl.childNodes).forEach(processInline);
      }
    }
  }
  
  Array.from(el.childNodes).forEach(processInline);
  
  return new Paragraph({
    children: children.length > 0 ? children : [new TextRun({ text: '', font: 'Times New Roman', size: 24 })],
    spacing: { after: 120, line: 360 },
    alignment: getAlignment(el),
  });
}

// Получение выравнивания из стилей
function getAlignment(el: HTMLElement): AlignmentType | undefined {
  const style = el.getAttribute('style') || '';
  if (style.includes('text-align: center')) return AlignmentType.CENTER;
  if (style.includes('text-align: right')) return AlignmentType.RIGHT;
  if (style.includes('text-align: left')) return AlignmentType.LEFT;
  if (style.includes('text-align: justify')) return AlignmentType.JUSTIFIED;
  return undefined;
}

// Конвертация таблицы
function convertTable(tableEl: HTMLElement, estimates: any[], totalAmount: string): Table {
  const rows: TableRow[] = [];
  const text = tableEl.textContent || '';
  
  // Определяем, является ли это таблица спецификации
  const isSpecTable = text.includes('Наименование') && text.includes('Кол-во');
  
  // Обрабатываем существующие строки HTML таблицы
  tableEl.querySelectorAll('tr').forEach(tr => {
    const cells: TableCell[] = [];
    
    tr.querySelectorAll('td, th').forEach(cell => {
      const cellText = cell.textContent?.trim() || '';
      const colspan = parseInt(cell.getAttribute('colspan') || '1');
      
      cells.push(new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ 
            text: cellText, 
            bold: cell.tagName.toLowerCase() === 'th',
            font: 'Times New Roman', 
            size: isSpecTable ? 20 : 24 
          })],
          alignment: cell.tagName.toLowerCase() === 'th' ? AlignmentType.CENTER : undefined,
        })],
        columnSpan: colspan > 1 ? colspan : undefined,
      }));
    });
    
    if (cells.length > 0) {
      rows.push(new TableRow({ children: cells }));
    }
  });
  
  // Если это таблица реквизитов, ограничиваем ширину
  const isRequisites = text.includes('Исполнитель') && text.includes('Заказчик');
  
  return new Table({
    width: { 
      size: isRequisites ? 90 : 100, 
      type: WidthType.PERCENTAGE 
    },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    },
  });
}

// Экспорт в DOC формат (Word 97-2003)
// На самом деле создаем HTML с Word-специфичными тегами, который Word откроет как DOC
export function exportContractToDOC(contract: Contract, pdfSettings: PDFSettings, bankAccounts: CompanyBankAccount[] = [], company?: Company | null): void {
  const html = generateContractHTML(contract, pdfSettings, bankAccounts, company, false);
  
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
  <script>
    // Автоматически ограничиваем ширину таблицы реквизитов
    document.querySelectorAll('table').forEach(function(table) {
      var text = table.textContent || '';
      if (text.indexOf('Исполнитель') !== -1 && text.indexOf('Заказчик') !== -1) {
        table.style.maxWidth = '100%';
        table.style.width = 'auto';
        table.style.margin = '20pt 0';
        var cells = table.querySelectorAll('td');
        cells.forEach(function(cell) {
          cell.style.width = '50%';
          cell.style.minWidth = '200pt';
        });
      }
    });
  </script>
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
