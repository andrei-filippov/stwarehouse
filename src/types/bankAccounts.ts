// ============================================
// Типы для банковских счетов компании
// ============================================

export type Currency = 'RUB' | 'USD' | 'EUR' | 'CNY';

export interface CompanyBankAccount {
  id: string;
  company_id: string;
  name: string;
  bank_name: string;
  bik: string;
  account: string;
  corr_account?: string;
  currency: Currency;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const CURRENCY_LABELS: Record<Currency, string> = {
  RUB: '₽ Российский рубль',
  USD: '$ Доллар США',
  EUR: '€ Евро',
  CNY: '¥ Китайский юань',
};

export function getCurrencyLabel(currency: Currency): string {
  return CURRENCY_LABELS[currency] || currency;
}
