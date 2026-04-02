// ============================================
// Типы для счетов и актов
// ============================================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';
export type ActStatus = 'draft' | 'signed' | 'approved';

// Счет на оплату
export type Invoice = {
  id: string;
  user_id?: string;
  contract_id: string;
  
  // Номер и дата
  number: string;
  date: string;
  
  // Суммы
  amount: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  
  // Статус
  status: InvoiceStatus;
  paid_date?: string;
  
  // Описание
  description?: string;
  due_date?: string;
  
  // Связанные данные
  contract?: {
    id: string;
    number: string;
    date?: string;
    bank_account_id?: string;
    customer?: {
      id: string;
      name: string;
      inn?: string;
      kpp?: string;
      legal_address?: string;
      bank_name?: string;
      bank_bik?: string;
      bank_account?: string;
      bank_corr_account?: string;
    };
  };
  
  created_at?: string;
  updated_at?: string;
};

// Позиция акта
export type ActItem = {
  id?: string;
  act_id?: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
  order_index?: number;
  created_at?: string;
};

// Акт выполненных работ
export type Act = {
  id: string;
  user_id?: string;
  contract_id: string;
  invoice_id?: string;
  
  // Номер и дата
  number: string;
  date: string;
  
  // Период
  period_start: string;
  period_end: string;
  
  // Суммы
  amount: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  
  // Статус
  status: ActStatus;
  
  // Примечания
  notes?: string;
  
  // Позиции
  items?: ActItem[];
  
  // Связанные данные
  contract?: {
    id: string;
    number: string;
    date: string;
    bank_account_id?: string;
    subject?: string;
    customer?: {
      id: string;
      name: string;
      inn?: string;
      kpp?: string;
      legal_address?: string;
    };
  };
  
  invoice?: {
    id: string;
    number: string;
    date: string;
  };
  
  created_at?: string;
  updated_at?: string;
};

// Метки для статусов счетов
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Черновик',
  sent: 'Отправлен',
  paid: 'Оплачен',
  cancelled: 'Отменён',
};

// Метки для статусов актов
export const ACT_STATUS_LABELS: Record<ActStatus, string> = {
  draft: 'Черновик',
  signed: 'Подписан',
  approved: 'Утверждён',
};

// Цвета для статусов
export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700' },
  paid: { bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700' },
};

export const ACT_STATUS_COLORS: Record<ActStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
  signed: { bg: 'bg-blue-100', text: 'text-blue-700' },
  approved: { bg: 'bg-green-100', text: 'text-green-700' },
};

export function getInvoiceStatusLabel(status: InvoiceStatus): string {
  return INVOICE_STATUS_LABELS[status] || status;
}

export function getActStatusLabel(status: ActStatus): string {
  return ACT_STATUS_LABELS[status] || status;
}

// Генерация номера счета
export function generateInvoiceNumber(sequence: number, year: number): string {
  const seqStr = sequence.toString().padStart(3, '0');
  return `${seqStr}-${year}`;
}

// Генерация номера акта
export function generateActNumber(sequence: number, year: number): string {
  const seqStr = sequence.toString().padStart(3, '0');
  return `${seqStr}-${year}А`;
}
