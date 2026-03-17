// Валидация форм и данных

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Валидация email
export function validateEmail(email: string): string | null {
  if (!email) return null;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    return 'Некорректный email адрес';
  }
  return null;
}

// Валидация телефона
export function validatePhone(phone: string): string | null {
  if (!phone) return null;
  if (phone.length < 5) {
    return 'Номер телефона слишком короткий';
  }
  if (phone.length > 50) {
    return 'Номер телефона слишком длинный (макс. 50 символов)';
  }
  // Разрешаем только цифры, пробелы, скобки, плюс и дефис
  const regex = /^[\d\s\+\-\(\)]*$/;
  if (!regex.test(phone)) {
    return 'Номер телефона содержит недопустимые символы';
  }
  return null;
}

// Валидация имени/названия
export function validateName(name: string, minLength = 2, maxLength = 200): string | null {
  if (!name || name.trim().length < minLength) {
    return `Поле должно содержать минимум ${minLength} символа`;
  }
  if (name.length > maxLength) {
    return `Поле слишком длинное (макс. ${maxLength} символов)`;
  }
  return null;
}

// Валидация суммы/числа
export function validateAmount(amount: number | string, min = 0, max = 999999999): string | null {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return 'Некорректное число';
  }
  if (num < min) {
    return `Значение не может быть меньше ${min}`;
  }
  if (num > max) {
    return `Значение слишком большое (макс. ${max})`;
  }
  return null;
}

// Валидация даты
export function validateDate(date: string | Date, allowPast = true, allowFuture = true): string | null {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    return 'Некорректная дата';
  }
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  if (!allowPast && d < now) {
    return 'Дата не может быть в прошлом';
  }
  if (!allowFuture && d > now) {
    return 'Дата не может быть в будущем';
  }
  return null;
}

// Санитизация строки (удаление опасных символов)
export function sanitizeString(str: string): string {
  return str
    .trim()
    .replace(/[<>]/g, '') // Удаляем < и > для предотвращения XSS
    .replace(/\s+/g, ' '); // Нормализуем пробелы
}

// Валидация ИНН (Россия)
export function validateINN(inn: string): string | null {
  if (!inn) return null;
  
  // ИНН может быть 10 (юрлицо) или 12 (физлицо) цифр
  const regex = /^\d{10}$|^\d{12}$/;
  if (!regex.test(inn)) {
    return 'ИНН должен содержать 10 или 12 цифр';
  }
  return null;
}

// Валидация КПП
export function validateKPP(kpp: string): string | null {
  if (!kpp) return null;
  
  const regex = /^\d{9}$/;
  if (!regex.test(kpp)) {
    return 'КПП должен содержать 9 цифр';
  }
  return null;
}

// Комплексная валидация объекта
export function validateObject<T extends Record<string, any>>(
  obj: T,
  rules: Record<keyof T, (value: any) => string | null>
): ValidationResult {
  const errors: ValidationError[] = [];
  
  for (const [field, validator] of Object.entries(rules)) {
    const error = validator(obj[field]);
    if (error) {
      errors.push({ field, message: error });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
