import { Document, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { supabase } from './supabase';
import type { Contract, ContractTemplateData, PDFSettings, CompanyBankAccount, Company } from '../types';
import { numberToWords } from '../types/contracts';
import { cleanEditedHtml } from '../lib/utils';
import { toast } from 'sonner';

// Генерация HTML для предпросмотра и печати
export function generateContractHTML(contract: Contract, pdfSettings: PDFSettings, bankAccounts: CompanyBankAccount[] = [], company?: Company | null, includeHeader: boolean = false): string {
  const template = contract.template;
  if (!template) {
    return '<p>Шаблон не найден</p>';
  }

  // Используем отредактированный контент если есть, иначе генерируем из шаблона
  let html: string;
  if (contract.content) {
    // Очищаем отредактированный контент от браузерных стилей перед экспортом
    html = cleanEditedHtml(contract.content);
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
      '<th style="width:5%">№</th><th style="width:40%">Наименование</th><th style="width:8%">Кол-во</th><th style="width:7%">Ед.</th><th style="width:12%">Цена</th><th style="width:8%">Коэф.</th><th style="width:12%">Сумма</th>' +
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
        tableHTML += `<tr style="background:#f5f5f5;"><td colspan="7" style="padding:3pt 5pt;"><strong>${category}</strong></td></tr>`;
        items?.forEach(item => {
          const coefficient = item.coefficient || 1;
          const sum = item.price * item.quantity * coefficient;
          // Объединяем наименование и описание
          let nameWithDescription = item.name;
          if (item.description && item.description.trim()) {
            nameWithDescription += `<br/><span style="font-size:9pt;color:#555;">${item.description}</span>`;
          }
          tableHTML += `<tr style="font-size:10pt;">` +
            `<td style="padding:2pt 5pt;text-align:center;">${globalIndex++}</td>` +
            `<td style="padding:2pt 5pt;">${nameWithDescription}</td>` +
            `<td style="padding:2pt 5pt;text-align:center;">${item.quantity}</td>` +
            `<td style="padding:2pt 5pt;text-align:center;">${item.unit}</td>` +
            `<td style="padding:2pt 5pt;text-align:right;">${item.price.toLocaleString('ru-RU')}</td>` +
            `<td style="padding:2pt 5pt;text-align:center;">${coefficient !== 1 ? coefficient.toFixed(2).replace(/\.00$/, '') : '-'}</td>` +
            `<td style="padding:2pt 5pt;text-align:right;">${sum.toLocaleString('ru-RU')}</td>` +
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
  
  // Функция для получения короткого типа компании с проверкой на дублирование
  const getCompanyTypeShort = (type: string, name: string): string => {
    if (type === 'ip') {
      // Проверяем и аббревиатуру, и полное название (в любом регистре)
      if (/^ИП\s/i.test(name)) return '';
      if (/индивидуальный\s+предприниматель/i.test(name)) return '';
      return 'ИП';
    }
    if (type === 'company') {
      // Проверяем аббревиатуры
      if (/^(ООО|ОАО|ЗАО|ПАО|АО)\s*["']?/i.test(name)) return '';
      // Проверяем полные названия
      if (/общество\s+с\s+ограниченной/i.test(name)) return '';
      if (/акционерное\s+общество/i.test(name)) return '';
      if (/закрытое\s+акционерное/i.test(name)) return '';
      if (/публичное\s+акционерное/i.test(name)) return '';
      return 'ООО';
    }
    return '';
  };
  
  // Получаем название компании БЕЗ типа (тип добавляется отдельно через customer_type/executor_type)
  const getCompanyFullName = (type: string, name: string): string => {
    if (type === 'ip') {
      // Убираем "ИП " если есть
      if (/^ИП\s/i.test(name)) return name.substring(3);
      if (/индивидуальный предприниматель/i.test(name)) {
        return name.replace(/индивидуальный предприниматель\s*/i, '');
      }
      return name;
    }
    
    if (type === 'company') {
      let cleanName = name;
      const lowerName = cleanName.toLowerCase();
      
      // Убираем "ООО " и другие префиксы
      cleanName = cleanName.replace(/^(ООО|ОАО|ЗАО|ПАО|АО)\s+/i, '');
      
      // Убираем полные названия типов компаний
      cleanName = cleanName.replace(/общество\s+с\s+ограниченной\s+ответственностью\s*/i, '');
      cleanName = cleanName.replace(/акционерное\s+общество\s*/i, '');
      cleanName = cleanName.replace(/закрытое\s+акционерное\s+общество\s*/i, '');
      cleanName = cleanName.replace(/публичное\s+акционерное\s+общество\s*/i, '');
      
      // Убираем кавычки по краям
      cleanName = cleanName.replace(/^["']+|["']+$/g, '');
      cleanName = cleanName.trim();
      
      return `"${cleanName}"`;
    }
    return name;
  };

  return {
    contract_number: contract.number,
    contract_date: formatDate(contract.date),
    contract_subject: contract.subject || '',
    
    customer_name: customer?.name ? getCompanyFullName(customer.type, customer.name) : '',
    customer_type: customer ? (customerTypeLabels[customer.type] || customer.type) : '',
    customer_type_short: customer?.type ? getCompanyTypeShort(customer.type, customer.name || '') : '',
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
    
    // Данные исполнителя из компании (из настроек реквизитов)
    executor_type: company?.type === 'ip' 
      ? 'Индивидуальный предприниматель' 
      : company?.type === 'individual'
        ? 'Физическое лицо'
        : 'Общество с ограниченной ответственностью',
    executor_type_short: company?.type 
      ? getCompanyTypeShort(company.type, company.name || '') 
      : '',
    executor_name: getCompanyFullName(
      company?.type || 'company',
      company?.name || pdfSettings.companyName || ''
    ),
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

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// Генерация OOXML таблицы спецификации для вставки в DOCX
function generateSpecTableOOXML(estimates: Contract['estimates']): string {
  if (!estimates || estimates.length === 0) {
    return '<w:p><w:r><w:t>Сметы не привязаны</w:t></w:r></w:p>';
  }

  let globalIndex = 1;
  let hasItems = false;
  let rowsXml = '';

  estimates.forEach((ce) => {
    const estimate = ce.estimate;
    if (!estimate || !estimate.items || estimate.items.length === 0) return;

    hasItems = true;

    const grouped = estimate.items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, NonNullable<typeof estimate.items>>);

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

    sortedCategories.forEach((category) => {
      // Строка категории
      rowsXml += `<w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5000" w:type="pct"/>
            <w:gridSpan w:val="7"/>
            <w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="left"/></w:pPr>
            <w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>${escapeXml(category)}</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>`;

      const items = grouped[category];
      items?.forEach((item) => {
        const coefficient = item.coefficient || 1;
        const sum = item.price * item.quantity * coefficient;
        const coefStr = coefficient !== 1 ? coefficient.toFixed(2).replace(/\.00$/, '') : '-';

        let name = escapeXml(item.name);
        if (item.description && item.description.trim()) {
          name += `; ${escapeXml(stripHtml(item.description))}`;
        }

        rowsXml += `<w:tr>
          <w:tc>
            <w:tcPr><w:tcW w:w="5" w:type="pct"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${globalIndex++}</w:t></w:r></w:p>
          </w:tc>
          <w:tc>
            <w:tcPr><w:tcW w:w="40" w:type="pct"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:t>${name}</w:t></w:r></w:p>
          </w:tc>
          <w:tc>
            <w:tcPr><w:tcW w:w="8" w:type="pct"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${item.quantity}</w:t></w:r></w:p>
          </w:tc>
          <w:tc>
            <w:tcPr><w:tcW w:w="7" w:type="pct"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${escapeXml(item.unit || 'шт')}</w:t></w:r></w:p>
          </w:tc>
          <w:tc>
            <w:tcPr><w:tcW w:w="12" w:type="pct"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>${item.price.toLocaleString('ru-RU').replace(/\u00A0/g, ' ')}</w:t></w:r></w:p>
          </w:tc>
          <w:tc>
            <w:tcPr><w:tcW w:w="8" w:type="pct"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${coefStr}</w:t></w:r></w:p>
          </w:tc>
          <w:tc>
            <w:tcPr><w:tcW w:w="12" w:type="pct"/></w:tcPr>
            <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>${sum.toLocaleString('ru-RU').replace(/\u00A0/g, ' ')}</w:t></w:r></w:p>
          </w:tc>
        </w:tr>`;
      });
    });
  });

  if (!hasItems) {
    return '<w:p><w:r><w:t>Позиции сметы не найдены</w:t></w:r></w:p>';
  }

  return `<w:tbl>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      </w:tblBorders>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblLayout w:type="fixed"/>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="500"/>
      <w:gridCol w:w="4000"/>
      <w:gridCol w:w="800"/>
      <w:gridCol w:w="700"/>
      <w:gridCol w:w="1200"/>
      <w:gridCol w:w="800"/>
      <w:gridCol w:w="1200"/>
    </w:tblGrid>
    <w:tr>
      <w:trPr><w:tblHeader/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="5" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="E5E5E5"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>№</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="40" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="E5E5E5"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Наименование</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="8" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="E5E5E5"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Кол-во</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="7" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="E5E5E5"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Ед.</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="12" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="E5E5E5"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Цена</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="8" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="E5E5E5"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Коэф.</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="12" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="E5E5E5"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Сумма</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
    ${rowsXml}
  </w:tbl>`;
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
      mso-table-layout-alt: fixed;
      border-collapse: collapse;
      width: 100%;
      font-size: 9pt;
    }
    
    table.spec th {
      background: #f0f0f0;
      font-weight: bold;
      text-align: center;
      border: 1pt solid windowtext;
      mso-border-alt: solid windowtext .5pt;
      padding: 3pt 4pt;
      font-size: 9pt;
    }
    
    table.spec td {
      border: 1pt solid windowtext;
      mso-border-alt: solid windowtext .5pt;
      padding: 2pt 4pt;
      font-size: 9pt;
      vertical-align: top;
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

// Экспорт договора в DOCX через docxtemplater (для файловых шаблонов)
export async function exportContractToDOCX(
  contract: Contract,
  pdfSettings: PDFSettings,
  bankAccounts: CompanyBankAccount[] = [],
  company?: Company | null
): Promise<void> {
  const template = contract.template;
  if (!template?.is_file_template || !template.file_path) {
    toast.error('DOCX шаблон не найден');
    return;
  }

  const isDocx = template.file_name?.toLowerCase().endsWith('.docx') || template.file_name?.toLowerCase().endsWith('.docm');
  if (!isDocx) {
    toast.error('Автозаполнение поддерживается только для .docx и .docm файлов');
    return;
  }

  const { data: blob, error } = await supabase.storage
    .from('contract-templates')
    .download(template.file_path);

  if (error || !blob) {
    toast.error('Ошибка при загрузке шаблона', { description: error?.message });
    return;
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const zip = new PizZip(arrayBuffer);

    // Заменяем плейсхолдер спецификации на raw-тег для вставки OOXML-таблицы
    let docXml = zip.file('word/document.xml')?.asText() || '';
    docXml = docXml.replace(/\{\{specification_table\}\}/g, '{@specification_table}');
    zip.file('word/document.xml', docXml);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' }
    });

    const templateData = prepareTemplateData(contract, pdfSettings, bankAccounts, company);
    const renderData: Record<string, string> = {};

    for (const [key, value] of Object.entries(templateData)) {
      let str = String(value ?? '');
      if (key === 'specification_table') {
        // Вставляем настоящую таблицу Word (OOXML) вместо plain text
        str = generateSpecTableOOXML(contract.estimates);
      }
      renderData[key] = str;
    }

    doc.render(renderData);

    const output = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    const url = URL.createObjectURL(output);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Договор_${contract.number}_${contract.customer?.name || 'без_заказчика'}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err: any) {
    console.error('DOCX export error:', err);
    toast.error('Ошибка при экспорте в DOCX', { description: err.message });
  }
}
