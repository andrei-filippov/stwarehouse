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
      'class', 'id', 'style'
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input']
  });
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
