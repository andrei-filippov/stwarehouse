// Types for AI Rider Processing

export interface RiderItem {
  name: string;
  quantity: number;
  category?: string;
  description?: string;
  confidence?: number; // уверенность ИИ при сопоставлении
}

export interface ParsedRider {
  event_name?: string;
  venue?: string;
  event_date?: string; // YYYY-MM-DD
  items: RiderItem[];
  raw_text?: string; // исходный текст для отладки
}

export interface MatchedRiderItem extends RiderItem {
  inventoryItem?: {
    id?: string;
    name: string;
    category: string;
    price: number;
    unit: string;
  };
  confidence: number;
  isMatched: boolean;
}

export interface RiderProcessingResult {
  parsed: ParsedRider;
  matched: MatchedRiderItem[];
  unmatched: RiderItem[];
}

export interface GigaChatConfig {
  clientId: string;
  clientSecret: string;
  scope?: string;
}

// Supported file types for rider upload
export type RiderFileType = 'application/pdf' | 'application/msword' | 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | 
  'text/plain';

export const ACCEPTED_RIDER_FORMATS = [
  '.pdf',
  '.doc',
  '.docx',
  '.txt'
];

export const ACCEPTED_RIDER_MIME_TYPES: RiderFileType[] = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
