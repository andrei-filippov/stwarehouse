import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { parseRiderText, matchWithInventory } from '../services/riderParser';
import type { ParsedRider, MatchedRiderItem, RiderItem } from '../types/rider';
import type { Equipment } from '../types';

interface UseRiderParserReturn {
  // Состояния
  isParsing: boolean;
  isMatching: boolean;
  progress: string;
  error: string | null;
  
  // Результаты
  parsedRider: ParsedRider | null;
  matchedItems: MatchedRiderItem[];
  unmatchedItems: RiderItem[];
  
  // Методы
  parseRider: (text: string) => Promise<ParsedRider | null>;
  matchWithInventory: (equipment: Equipment[]) => Promise<void>;
  reset: () => void;
  extractTextFromFile: (file: File) => Promise<string>;
}

export function useRiderParser(): UseRiderParserReturn {
  const [isParsing, setIsParsing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [parsedRider, setParsedRider] = useState<ParsedRider | null>(null);
  const [matchedItems, setMatchedItems] = useState<MatchedRiderItem[]>([]);
  const [unmatchedItems, setUnmatchedItems] = useState<RiderItem[]>([]);

  // Извлечение текста из файла
  const extractTextFromFile = useCallback(async (file: File): Promise<string> => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    
    // Текстовые файлы - читаем напрямую
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }
    
    // PDF/DOC - пока заглушка
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      toast.warning('PDF файлы поддерживаются частично. Скопируйте текст вручную.');
      return `[PDF: ${file.name}]\n\nСкопируйте текст райдера сюда.`;
    }
    
    if (fileType.includes('word') || fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
      toast.warning('Word файлы поддерживаются частично. Скопируйте текст вручную.');
      return `[Word: ${file.name}]\n\nСкопируйте текст райдера сюда.`;
    }
    
    throw new Error('Неподдерживаемый формат. Используйте PDF, DOC, DOCX или TXT.');
  }, []);

  // Парсинг текста райдера
  const parseRider = useCallback(async (text: string): Promise<ParsedRider | null> => {
    if (!text.trim()) {
      setError('Введите текст райдера');
      return null;
    }
    
    setIsParsing(true);
    setError(null);
    setProgress('Анализ через GigaChat...');
    
    try {
      // Вызываем Edge Function через Supabase
      const parsed = await parseRiderText(text);
      
      setParsedRider(parsed);
      
      if (parsed.items.length === 0) {
        toast.warning('Не удалось извлечь оборудование');
      } else {
        toast.success(`Извлечено ${parsed.items.length} позиций`);
      }
      
      return parsed;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при обработке';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsParsing(false);
      setProgress('');
    }
  }, []);

  // Сопоставление с инвентарём
  const doMatchWithInventory = useCallback(async (equipment: Equipment[]): Promise<void> => {
    if (!parsedRider || parsedRider.items.length === 0) return;
    
    setIsMatching(true);
    setProgress('Сопоставление с базой...');
    
    try {
      // Локальное сопоставление (быстро, без ИИ)
      const result = matchWithInventory(parsedRider.items, equipment);
      
      setMatchedItems(result.matched);
      setUnmatchedItems(result.unmatched);
      
      const matchCount = result.matched.length;
      const totalCount = parsedRider.items.length;
      
      if (matchCount === totalCount) {
        toast.success(`Все ${totalCount} позиций сопоставлены`);
      } else {
        toast.info(`Сопоставлено ${matchCount} из ${totalCount}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при сопоставлении';
      setError(message);
      toast.error(message);
      
      setMatchedItems([]);
      setUnmatchedItems(parsedRider.items.map(item => ({ ...item, confidence: 0 })));
    } finally {
      setIsMatching(false);
      setProgress('');
    }
  }, [parsedRider]);

  // Сброс состояния
  const reset = useCallback(() => {
    setParsedRider(null);
    setMatchedItems([]);
    setUnmatchedItems([]);
    setError(null);
    setProgress('');
  }, []);

  return {
    isParsing,
    isMatching,
    progress,
    error,
    parsedRider,
    matchedItems,
    unmatchedItems,
    parseRider,
    matchWithInventory: doMatchWithInventory,
    reset,
    extractTextFromFile,
  };
}
