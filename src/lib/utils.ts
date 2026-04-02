import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import DOMPurify from 'dompurify';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Безопасное логирование (только в development)
export const DEBUG = import.meta.env.DEV;

export function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log(...args);
  }
}

export function debugError(...args: any[]) {
  if (DEBUG) {
    console.error(...args);
  }
}

// Санитизация HTML для предотвращения XSS (для общего использования, без стилей)
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'div', 'span', 'img'
    ],
    ALLOWED_ATTR: [
      'src', 'alt', 'title', 'width', 'height',
      'class', 'id'
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'style'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input']
  });
}

// Санитизация HTML для договоров (с сохранением стилей таблиц)
export function sanitizeContractHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'div', 'span', 'img'
    ],
    ALLOWED_ATTR: [
      'src', 'alt', 'title', 'width', 'height',
      'class', 'id', 'style'  // Разрешаем style для договоров
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input']
  });
}

// Стили таблиц, которые нужно сохранять
const TABLE_STYLES_TO_KEEP = [
  'border', 'border-top', 'border-bottom', 'border-left', 'border-right',
  'border-collapse', 'border-spacing', 'width', 'height',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'text-align', 'vertical-align'
];

// "Грязные" стили, которые добавляет браузер и нужно удалить
const DIRTY_STYLE_PATTERNS = [
  /rgb\(\d+,\s*\d+,\s*\d+\)/,      // rgb(0, 0, 0)
  /rgba\(/,                          // rgba(...)
  /font-family:\s*[^;]*;?/i,        // font-family: Arial
  /font-size:\s*\d+(\.\d+)?pt;?/i,  // font-size: 12pt
  /font-size:\s*[^;]*;?/i,          // любой font-size
  /background-color:\s*(?!transparent)[^;]*;?/i, // background-color (кроме transparent)
  /color:\s*[^;]*;?/i,              // color
  /mso-[^:]+:[^;]*;?/gi,            // MS Office стили
  /margin[^:]*:[^;]*;?/gi,          // margin
  /line-height[^:]*:[^;]*;?/gi,     // line-height
];

// Очистка HTML после редактирования (contentEditable)
// Сохраняет стили таблиц, удаляет браузерные "грязные" стили
export function cleanEditedHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Обрабатываем стили у всех элементов
  const elementsWithStyle = tempDiv.querySelectorAll('[style]');
  elementsWithStyle.forEach(el => {
    const originalStyle = el.getAttribute('style') || '';
    
    // Проверяем, есть ли "грязные" стили
    let hasDirtyStyles = false;
    DIRTY_STYLE_PATTERNS.forEach(pattern => {
      if (pattern.test(originalStyle)) {
        hasDirtyStyles = true;
      }
    });
    
    if (hasDirtyStyles) {
      // Удаляем грязные стили
      let cleanedStyle = originalStyle;
      DIRTY_STYLE_PATTERNS.forEach(pattern => {
        cleanedStyle = cleanedStyle.replace(pattern, '');
      });
      
      // Оставляем только нужные стили таблиц
      const styleParts = cleanedStyle.split(';');
      const keptStyles: string[] = [];
      
      styleParts.forEach(part => {
        const trimmed = part.trim();
        if (!trimmed) return;
        
        const propName = trimmed.split(':')[0].trim().toLowerCase();
        
        // Сохраняем стили таблиц
        if (TABLE_STYLES_TO_KEEP.includes(propName)) {
          keptStyles.push(trimmed);
        }
      });
      
      if (keptStyles.length > 0) {
        el.setAttribute('style', keptStyles.join('; '));
      } else {
        el.removeAttribute('style');
      }
    }
    // Если нет грязных стилей - оставляем как есть (для border и т.д.)
  });
  
  // Удаляем пустые span
  const emptySpans = tempDiv.querySelectorAll('span:empty');
  emptySpans.forEach(el => {
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    }
  });
  
  // Удаляем браузерные атрибуты
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach(el => {
    const attrs = Array.from(el.attributes);
    attrs.forEach(attr => {
      if (attr.name.startsWith('data-') || 
          attr.name.startsWith('_moz') ||
          attr.name === 'type' && attr.value.startsWith('_') ||
          attr.name === 'id' && attr.value.startsWith('docs-internal')) {
        el.removeAttribute(attr.name);
      }
    });
  });
  
  return tempDiv.innerHTML;
}

// Форматирование даты в строку YYYY-MM-DD без проблем с часовым поясом
export function dateToString(date: Date | undefined | null): string | undefined {
  if (!date) return undefined;
  // Используем локальную дату, а не UTC
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Валидация email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Валидация телефона (базовая)
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\+\-\(\)]{10,20}$/;
  return phoneRegex.test(phone);
}

// Экранирование HTML entities
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
