// PDF экспорт для смет через html2canvas + jsPDF
// Решает проблему iOS Safari (возврат в приложение) и кириллических шрифтов

import { jsPDF } from 'jspdf';
import type { EstimateItem, EstimateSection, PDFSettings, Customer } from '../types';
import { groupItemsBySections } from './estimateExport';
import { toast } from 'sonner';

interface PDFExportData {
  eventName: string;
  venue: string;
  eventStartDate: string;
  eventEndDate: string;
  items: EstimateItem[];
  sections: EstimateSection[];
  categoryOrder: string[];
  total: number;
  pdfSettings: PDFSettings;
  company?: { name?: string; inn?: string; kpp?: string; ogrn?: string; legal_address?: string } | null;
  customerId?: string;
  customers?: Customer[];
}

export async function exportEstimateToPDF(data: PDFExportData): Promise<void> {
  const {
    eventName,
    venue,
    eventStartDate,
    eventEndDate,
    items,
    sections,
    categoryOrder,
    total,
    pdfSettings,
    company,
    customerId,
    customers = [],
  } = data;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const selectedCustomer = customers.find(c => c.id === customerId);

  // Создаём временный контейнер для рендера HTML
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 width at 96 DPI
  container.style.background = 'white';
  container.style.padding = '30px';
  container.style.fontFamily = 'Arial, "Helvetica Neue", sans-serif';
  container.style.fontSize = '10px';
  container.style.lineHeight = '1.4';
  container.style.color = '#333';
  container.style.zIndex = '-1';
  document.body.appendChild(container);

  try {
    // Формируем HTML содержимое
    const htmlContent = generatePDFHTML({
      eventName, venue, eventStartDate, eventEndDate,
      items, sections, categoryOrder, total,
      pdfSettings, company, selectedCustomer
    });

    container.innerHTML = htmlContent;

    // Ждём загрузки изображений
    const images = container.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) resolve();
            else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }
          })
      )
    );

    toast.info('Создание PDF...');
    
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL('image/png');

    // Создаём PDF из canvas
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Если контент не влезает на одну страницу — добавляем страницы
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      doc.addPage();
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const fileName = `Смета_${eventName.replace(/[^a-zA-Z0-9а-яА-Я\s]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);

    if (isIOS) {
      // На iOS используем location.href — Safari откроет PDF в том же окне
      // Пользователь увидит PDF и сможет вернуться через кнопку "Назад" браузера
      window.location.href = url;
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    
    toast.success('PDF создан');
  } catch (err: any) {
    console.error('PDF export error:', err);
    toast.error('Ошибка при создании PDF', { description: err.message || 'Неизвестная ошибка' });
  } finally {
    // Удаляем временный контейнер
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  }
}

function generatePDFHTML(params: {
  eventName: string;
  venue: string;
  eventStartDate: string;
  eventEndDate: string;
  items: EstimateItem[];
  sections: EstimateSection[];
  categoryOrder: string[];
  total: number;
  pdfSettings: PDFSettings;
  company?: { name?: string; inn?: string; kpp?: string; ogrn?: string; legal_address?: string } | null;
  selectedCustomer?: Customer;
}): string {
  const {
    eventName, venue, eventStartDate, eventEndDate,
    items, sections, categoryOrder, total,
    pdfSettings, company, selectedCustomer
  } = params;

  const grouped = groupItemsBySections(items, sections, categoryOrder);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, "Helvetica Neue", sans-serif; font-size: 10px; line-height: 1.4; color: #333; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
        .logo-section { width: 45%; }
        .logo-section img { max-height: 80px; max-width: 100%; }
        .company-section { width: 50%; text-align: right; font-size: 11px; }
        .company-section h2 { margin: 0 0 5px 0; font-size: 14px; }
        .company-section p { margin: 3px 0; }
        h1 { text-align: center; font-size: 18px; margin: 15px 0; }
        .info { margin-bottom: 15px; font-size: 12px; }
        .info p { margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }
        th { background: #2980b9; color: white; padding: 6px 4px; text-align: left; }
        td { padding: 5px 4px; border: 1px solid #ddd; }
        tr:nth-child(even) { background: #f5f5f5; }
        .nowrap { white-space: nowrap; }
        .total { margin-top: 15px; font-size: 14px; font-weight: bold; text-align: right; }
        .section-header { background: #e3f2fd; padding: 10px; margin: 15px 0 5px 0; font-size: 15px; border-radius: 4px; font-weight: bold; }
        .category-header { background: #f5f5f5; }
        .category-header th { background: #f5f5f5; color: #333; font-size: 12px; }
        .cat-total { background: #fafafa; font-weight: bold; }
        .cat-total td { border-top: 2px solid #ddd; }
        .section-total { background: #fff9c4; padding: 8px; margin: 5px 0 15px 0; border-radius: 4px; font-weight: bold; text-align: right; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          ${pdfSettings.logo ? `<img src="${pdfSettings.logo}" alt="Логотип" />` : '<p>&nbsp;</p>'}
        </div>
        <div class="company-section">
          ${company?.name ? `<h2>${company.name}</h2>` : pdfSettings.companyName ? `<h2>${pdfSettings.companyName}</h2>` : ''}
          ${company?.inn || company?.kpp || company?.ogrn ? `<p>ИНН: ${company.inn || '-'} / КПП: ${company.kpp || '-'} / ОГРН: ${company.ogrn || '-'}</p>` : ''}
          ${company?.legal_address ? `<p>${company.legal_address}</p>` : pdfSettings.companyDetails ? pdfSettings.companyDetails.split('\n').map(line => `<p>${line}</p>`).join('') : ''}
        </div>
      </div>

      <h1>Коммерческое предложение</h1>
      
      <div class="info">
        <p><strong>Мероприятие:</strong> ${eventName}</p>
        <p><strong>Площадка:</strong> ${venue || '-'}</p>
        <p><strong>Дата начала:</strong> ${eventStartDate ? new Date(eventStartDate).toLocaleDateString('ru-RU') : '-'}</p>
        <p><strong>Дата окончания:</strong> ${eventEndDate ? new Date(eventEndDate).toLocaleDateString('ru-RU') : '-'}</p>
        ${selectedCustomer?.name ? `<p><strong>Заказчик:</strong> ${selectedCustomer.name}</p>` : ''}
      </div>
      
      ${grouped.map(({ section, categories, total: sectionTotal, isNoSection }) => {
        return `
        ${section ? `<div class="section-header">${section.name}</div>` : ''}
        ${categories.map(({ category, items: catItems }) => {
          const catTotal = catItems.reduce((sum, item) => sum + (item.price * item.quantity * (item.coefficient || 1)), 0);
          return `
          <table>
            <thead>
              <tr class="category-header">
                <th colspan="8" style="text-align:left;padding:6px;font-size:12px;">
                  ${category}
                </th>
              </tr>
              <tr>
                <th style="width:5%">№</th>
                <th style="width:25%">Наименование</th>
                <th style="width:20%">Описание</th>
                <th style="width:8%">Ед.</th>
                <th style="width:8%">Кол-во</th>
                <th style="width:10%">Цена</th>
                <th style="width:8%">Коэф.</th>
                <th style="width:10%">Сумма</th>
              </tr>
            </thead>
            <tbody>
              ${catItems.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${item.name}</td>
                  <td>${item.description || '-'}</td>
                  <td>${item.unit || 'шт'}</td>
                  <td>${item.quantity}</td>
                  <td class="nowrap">${item.price.toLocaleString('ru-RU')} ₽</td>
                  <td>${item.coefficient || 1}</td>
                  <td class="nowrap">${(item.price * item.quantity * (item.coefficient || 1)).toLocaleString('ru-RU')} ₽</td>
                </tr>
              `).join('')}
              <tr class="cat-total">
                <td colspan="5"></td>
                <td colspan="2" style="text-align:right;padding:6px;">Итого:</td>
                <td style="text-align:right;padding:6px;" class="nowrap">${catTotal.toLocaleString('ru-RU')} ₽</td>
              </tr>
            </tbody>
          </table>
          <div style="height:5px;"></div>
          `;
        }).join('')}
        ${section ? `
        <div class="section-total">
          Итого ${section.name}: ${sectionTotal.toLocaleString('ru-RU')} ₽
        </div>
        ` : ''}
        `;
      }).join('')}
      
      <div class="total">
        ИТОГО: ${total.toLocaleString('ru-RU')} ₽
      </div>
    </body>
    </html>
  `;
}
