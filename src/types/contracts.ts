// ============================================
// Типы для работы с договорами
// ============================================

export type ContractType = 'service' | 'rent' | 'supply' | 'mixed';
export type ContractStatus = 'draft' | 'signed' | 'in_progress' | 'completed' | 'cancelled';

// Шаблон договора
export type ContractTemplate = {
  id: string;
  user_id?: string;
  name: string;
  type: ContractType;
  content: string; // HTML-шаблон с плейсхолдерами
  description?: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
};

// Договор
export type Contract = {
  id: string;
  user_id?: string;
  customer_id?: string;
  template_id?: string;
  
  // Основные поля
  number: string;
  date: string;
  type: ContractType;
  subject?: string;
  
  // Финансы
  total_amount: number;
  payment_terms?: string;
  
  // Мероприятие
  event_name?: string;
  event_start_date?: string;
  event_end_date?: string;
  venue?: string;
  
  // Исполнитель
  executor_name?: string;
  executor_representative?: string;
  executor_basis?: string;
  
  // Статус
  status: ContractStatus;
  
  // Дополнительно
  additional_terms?: string;
  
  // Связанные данные (при join)
  customer?: {
    id: string;
    name: string;
    type: 'company' | 'ip' | 'individual';
    inn?: string;
    kpp?: string;
    ogrn?: string;
    legal_address?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    bank_name?: string;
    bank_bik?: string;
    bank_account?: string;
    bank_corr_account?: string;
  };
  
  template?: ContractTemplate;
  estimates?: ContractEstimateItem[];
  
  created_at?: string;
  updated_at?: string;
};

// Связь договор ↔ смета
export type ContractEstimateItem = {
  id?: string;
  contract_id?: string;
  estimate_id: string;
  order_index: number;
  created_at?: string;
  
  // Данные сметы (при join)
  estimate?: {
    id: string;
    event_name: string;
    venue?: string;
    event_date?: string;
    event_start_date?: string;
    event_end_date?: string;
    total: number;
    items?: Array<{
      name: string;
      description?: string;
      category: string;
      quantity: number;
      price: number;
      unit: string;
      coefficient: number;
    }>;
  };
};

// Данные для генерации договора (плейсхолдеры)
export type ContractTemplateData = {
  // Договор
  contract_number: string;
  contract_date: string;
  
  // Заказчик
  customer_name: string;
  customer_type: string;
  customer_inn?: string;
  customer_kpp?: string;
  customer_ogrn?: string;
  customer_address?: string;
  customer_representative?: string;
  customer_basis?: string;
  customer_bank_name?: string;
  customer_bank_bik?: string;
  customer_bank_account?: string;
  customer_bank_corr_account?: string;
  
  // Исполнитель
  executor_name: string;
  executor_representative: string;
  executor_basis: string;
  
  // Мероприятие
  event_name: string;
  event_date: string;
  event_venue: string;
  
  // Финансы
  total_amount: string;
  total_amount_text: string;
  payment_terms: string;
  
  // Спецификация
  specification_table: string;
};

// Метки для типов договоров
export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  service: 'Оказание услуг',
  rent: 'Аренда оборудования',
  supply: 'Поставка',
  mixed: 'Смешанный',
};

export function getContractTypeLabel(type: ContractType): string {
  return CONTRACT_TYPE_LABELS[type] || type;
}

// Метки для статусов
export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: 'Черновик',
  signed: 'Подписан',
  in_progress: 'В работе',
  completed: 'Выполнен',
  cancelled: 'Отменён',
};

export function getContractStatusLabel(status: ContractStatus): string {
  return CONTRACT_STATUS_LABELS[status] || status;
}

// Цвета для статусов (для UI)
export const CONTRACT_STATUS_COLORS: Record<ContractStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
  signed: { bg: 'bg-blue-100', text: 'text-blue-700' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700' },
};

// Форматирование суммы прописью (упрощённая версия)
export function numberToWords(num: number): string {
  const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 
                 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 
                'семьдесят', 'восемьдесят', 'девяносто'];
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 
                    'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  const thousands = ['', 'одна тысяча', 'две тысячи', 'три тысячи', 'четыре тысячи'];
  
  const rubles = Math.floor(num);
  const cents = Math.round((num - rubles) * 100);
  
  let result = '';
  
  if (rubles === 0) return 'ноль рублей';
  
  // Упрощённая реализация для чисел до 999999
  const th = Math.floor(rubles / 1000);
  const rest = rubles % 1000;
  
  if (th > 0) {
    if (th < 5) {
      result += thousands[th] + ' ';
    } else {
      result += th + ' тысяч ';
    }
  }
  
  const h = Math.floor(rest / 100);
  const t = Math.floor((rest % 100) / 10);
  const o = rest % 10;
  
  if (h > 0) result += hundreds[h] + ' ';
  
  if (t === 1) {
    result += teens[o] + ' ';
  } else {
    if (t > 1) result += tens[t] + ' ';
    if (o > 0) result += ones[o] + ' ';
  }
  
  // Склонение "рублей"
  if (o === 1 && t !== 1) {
    result += 'рубль';
  } else if ([2, 3, 4].includes(o) && t !== 1) {
    result += 'рубля';
  } else {
    result += 'рублей';
  }
  
  if (cents > 0) {
    result += ' ' + cents.toString().padStart(2, '0') + ' копеек';
  } else {
    result += ' 00 копеек';
  }
  
  return result.trim();
}

// Генерация номера договора
export function generateContractNumber(
  year: number, 
  type: ContractType, 
  sequence: number
): string {
  const typeCodes: Record<ContractType, string> = {
    service: 'У',
    rent: 'А',
    supply: 'П',
    mixed: 'С',
  };
  
  const typeCode = typeCodes[type] || 'У';
  const seqStr = sequence.toString().padStart(2, '0');
  const yearShort = year.toString().slice(-2);
  
  return `${seqStr}-${yearShort}${typeCode}`;
}
