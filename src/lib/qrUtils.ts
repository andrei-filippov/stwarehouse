// Утилиты для работы с QR-кодами

/**
 * Генерирует URL для сканирования QR-кода
 * При сканировании этого QR-кода пользователь попадет в приложение 
 * сразу на страницу с информацией об оборудовании
 */
export function generateQRScanUrl(qrCode: string): string {
  // Получаем текущий домен (для production и development)
  const baseUrl = window.location.origin;
  return `${baseUrl}/?scan=${encodeURIComponent(qrCode)}`;
}

/**
 * Генерирует QR-код как просто код оборудования (для внутреннего сканера)
 */
export function generateSimpleQRCode(prefix: string = 'EQ', length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Без 0, O, I, 1 для удобства
  let result = prefix + '-';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Проверяет валидность QR-кода
 */
export function isValidQRCode(code: string): boolean {
  return /^[A-Z]{2}-[A-Z0-9]{8}$/.test(code);
}
