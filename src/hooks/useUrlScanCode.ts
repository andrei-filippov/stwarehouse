import { useState, useEffect } from 'react';

/**
 * Хук для чтения QR кода из URL параметра ?scan=XXX
 * Использует sessionStorage как fallback если URL уже очищен
 */
export function useUrlScanCode(): string | null {
  const [scanCode, setScanCode] = useState<string | null>(null);

  useEffect(() => {
    // Пытаемся прочитать из URL
    if (typeof window !== 'undefined') {
      const fullUrl = window.location.href;
      const searchIndex = fullUrl.indexOf('?');
      
      if (searchIndex !== -1) {
        const searchString = fullUrl.substring(searchIndex + 1);
        const params = new URLSearchParams(searchString);
        
        for (const [key, value] of params) {
          if (key.toLowerCase() === 'scan') {
            console.log('[useUrlScanCode] Found in URL:', value);
            // Сохраняем в sessionStorage на случай если URL очистится
            try {
              sessionStorage.setItem('pending_scan_code', value);
            } catch (e) {
              // Игнорируем ошибки
            }
            setScanCode(value);
            return;
          }
        }
      }
      
      // Резервное чтение из sessionStorage
      try {
        const pendingScan = sessionStorage.getItem('pending_scan_code');
        if (pendingScan) {
          console.log('[useUrlScanCode] Found in sessionStorage:', pendingScan);
          setScanCode(pendingScan);
        }
      } catch (e) {
        // Игнорируем ошибки
      }
    }
  }, []);

  return scanCode;
}

/**
 * Очищает сохраненный scan код из sessionStorage
 */
export function clearUrlScanCode(): void {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem('pending_scan_code');
      console.log('[useUrlScanCode] Cleared sessionStorage');
    } catch (e) {
      // Игнорируем ошибки
    }
  }
}

/**
 * Сохраняет scan код в sessionStorage
 */
export function saveUrlScanCode(code: string): void {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('pending_scan_code', code);
      console.log('[useUrlScanCode] Saved to sessionStorage:', code);
    } catch (e) {
      // Игнорируем ошибки
    }
  }
}
