// Сервис для парсинга райдеров через Supabase Edge Function
// Безопасно: ключи GigaChat хранятся на сервере, не в браузере

import { supabase } from '../lib/supabase';
import type { ParsedRider, MatchedRiderItem, RiderItem } from '../types/rider';
import type { Equipment } from '../types';

export interface ParseRiderResult {
  parsed: ParsedRider;
  matched: MatchedRiderItem[];
  unmatched: RiderItem[];
}

/**
 * Парсит текст райдера через Supabase Edge Function
 * Ключи GigaChat безопасно хранятся на сервере
 */
export async function parseRiderText(riderText: string): Promise<ParsedRider> {
  const { data, error } = await supabase.functions.invoke('parse-rider', {
    body: { riderText },
  });

  if (error) {
    console.error('Edge Function error:', error);
    throw new Error(error.message || 'Ошибка при обработке райдера');
  }

  if (!data || data.error) {
    throw new Error(data?.error || 'Неверный ответ от сервера');
  }

  return {
    event_name: data.event_name || '',
    venue: data.venue || '',
    event_date: data.event_date || '',
    items: Array.isArray(data.items) ? data.items : [],
    raw_text: riderText,
  };
}

/**
 * Сопоставляет извлечённое оборудование с инвентарём
 * Использует простой fuzzy matching (без ИИ - быстрее и дешевле)
 */
export function matchWithInventory(
  riderItems: RiderItem[],
  inventory: Equipment[]
): { matched: MatchedRiderItem[]; unmatched: RiderItem[] } {
  const matched: MatchedRiderItem[] = [];
  const unmatched: RiderItem[] = [];

  for (const riderItem of riderItems) {
    let bestMatch: Equipment | null = null;
    let bestScore = 0;

    for (const invItem of inventory) {
      const score = calculateSimilarity(riderItem.name, invItem.name);
      
      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = invItem;
      }
    }

    if (bestMatch) {
      matched.push({
        ...riderItem,
        inventoryItem: {
          id: bestMatch.id,
          name: bestMatch.name,
          category: bestMatch.category,
          price: bestMatch.price,
          unit: bestMatch.unit,
        },
        confidence: bestScore,
        isMatched: true,
      });
    } else {
      unmatched.push({
        ...riderItem,
        confidence: 0,
      });
    }
  }

  return { matched, unmatched };
}

/**
 * Простое сравнение строк (Levenshtein-based similarity)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Точное совпадение
  if (s1 === s2) return 1;

  // Один содержит другой
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Словарь синонимов
  const synonyms: Record<string, string[]> = {
    'микрофон': ['mic', 'microphone', 'shure', 'sennheiser', 'akg'],
    'динамик': ['speaker', 'колонка', 'сабвуфер', 'sub'],
    'усилитель': ['amp', 'amplifier', 'усилок'],
    'микшер': ['mixer', 'console', 'пульт'],
    'прожектор': ['spotlight', 'moving head', 'led', 'пар'],
    'стойка': ['stand', 'tripod', 'распорка'],
  };

  // Проверяем синонимы
  for (const [base, alts] of Object.entries(synonyms)) {
    const hasBase1 = s1.includes(base) || alts.some(a => s1.includes(a));
    const hasBase2 = s2.includes(base) || alts.some(a => s2.includes(a));
    
    if (hasBase1 && hasBase2) {
      // Оба относятся к одной категории - высокий скор
      return 0.8;
    }
  }

  // Расстояние Левенштейна (упрощённое)
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  return 1 - distance / maxLength;
}

/**
 * Расстояние Левенштейна
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
