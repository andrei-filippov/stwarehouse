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

// Очистка HTML после редактирования (contentEditable)
// Удаляет только браузерные "грязные" стили, сохраняя базовые стили таблиц
export function cleanEditedHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  
  // Создаем временный div для работы с DOM
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Удаляем только "грязные" браузерные стили (начинающиеся с rgb, color с конкретными значениями и т.д.)
  const elementsWithStyle = tempDiv.querySelectorAll('[style]');
  elementsWithStyle.forEach(el => {
    const style = el.getAttribute('style') || '';
    // Удаляем стили только если они содержат браузерные "грязные" значения
    const dirtyPatterns = [
      /rgb\(\d+,\s*\d+,\s*\d+\)/,  // rgb(0, 0, 0)
      /rgba\(/,                      // rgba(...)
      /font-family:\s*[^;]*;?/i,    // font-family: Arial
      /font-size:\s*[^;]*;?/i,      // font-size: 12px
      /background-color:\s*#?\w+;?/i, // background-color
      /color:\s*#?\w+;?/i,          // color: black
    ];
    
    let cleanedStyle = style;
    dirtyPatterns.forEach(pattern => {
      cleanedStyle = cleanedStyle.replace(pattern, '');
    });
    
    // Удаляем пустые style атрибуты
    if (!cleanedStyle.trim() || cleanedStyle === style && style.match(/font|color|background/)) {
      el.removeAttribute('style');
    } else if (cleanedStyle !== style) {
      el.setAttribute('style', cleanedStyle);
    }
  });
  
  // Удаляем пустые span (которые добавляет браузер)
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
  
  // Удаляем атрибуты type="_moz" и подобные браузерные атрибуты
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
