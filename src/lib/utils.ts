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

// Санитизация HTML для предотвращения XSS
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
      // Убран 'style' - браузерные стили портят вёрстку
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'style'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input']
  });
}

// Очистка HTML после редактирования (contentEditable)
// Удаляет браузерные стили и ненужные атрибуты
export function cleanEditedHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  
  // Создаем временный div для работы с DOM
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Удаляем все style атрибуты
  const elementsWithStyle = tempDiv.querySelectorAll('[style]');
  elementsWithStyle.forEach(el => el.removeAttribute('style'));
  
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
    // Удаляем data- атрибуты
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
