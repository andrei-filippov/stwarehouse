import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import GigaChatService from '../services/gigachat';
import type { ParsedRider, MatchedRiderItem, RiderProcessingResult } from '../types/rider';
import type { Equipment } from '../types';

interface UseRiderParserOptions {
  clientId: string;
  clientSecret: string;
}

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
  parseRiderText: (text: string) => Promise<ParsedRider | null>;
  matchWithInventory: (equipment: Equipment[]) => Promise<void>;
  reset: () => void;
  extractTextFromFile: (file: File) => Promise<string>;
}

export function useRiderParser({ clientId, clientSecret }: UseRiderParserOptions): UseRiderParserReturn {
  const [isParsing, setIsParsing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [parsedRider, setParsedRider] = useState<ParsedRider | null>(null);
  const [matchedItems, setMatchedItems] = useState<MatchedRiderItem[]>([]);
  const [unmatchedItems, setUnmatchedItems] = useState<RiderItem[]>([]);
  
  const serviceRef = useRef<GigaChatService | null>(null);
  
  // Ленивая инициализация сервиса
  const getService = useCallback(() => {
    if (!serviceRef.current) {
      serviceRef.current = new GigaChatService(clientId, clientSecret);
    }
    return serviceRef.current;
  }, [clientId, clientSecret]);

  // Извлечение текста из файла
  const extractTextFromFile = useCallback(async (file: File): Promise<string> => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    
    setProgress('Чтение файла...');
    
    // Текстовые файлы - читаем напрямую
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }
    
    // PDF файлы - используем pdf-parse или отправляем как base64 для обработки
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      // Для PDF пока просто читаем как текст (в production нужен pdf-parser)
      // Или можно отправить в GigaChat с пометкой что это base64 PDF
      toast.warning('PDF файлы поддерживаются частично. Для лучшего результата скопируйте текст вручную.');
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          // В реальном приложении здесь должен быть PDF парсер
          resolve(`[PDF файл: ${file.name}]\n\nПожалуйста, скопируйте текст райдера в поле ниже.`);
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }
    
    // Word документы
    if (fileType.includes('word') || fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
      toast.warning('Word файлы поддерживаются частично. Для лучшего результата скопируйте текст вручную.');
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve(`[Word файл: ${file.name}]\n\nПожалуйста, скопируйте текст райдера в поле ниже.`);
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }
    
    throw new Error('Неподдерживаемый формат файла. Используйте PDF, DOC, DOCX или TXT.');
  }, []);

  // Парсинг текста райдера через GigaChat
  const parseRiderText = useCallback(async (text: string): Promise<ParsedRider | null> => {
    if (!text.trim()) {
      setError('Введите текст райдера');
      return null;
    }
    
    setIsParsing(true);
    setError(null);
    setProgress('Анализ текста через GigaChat...');
    
    try {
      const service = getService();
      const parsed = await service.parseRider(text);
      
      setParsedRider(parsed);
      
      if (parsed.items.length === 0) {
        toast.warning('Не удалось извлечь оборудование из райдера');
      } else {
        toast.success(`Извлечено ${parsed.items.length} позиций`);
      }
      
      return parsed;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при обработке райдера';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsParsing(false);
      setProgress('');
    }
  }, [getService]);

  // Сопоставление с инвентарём
  const matchWithInventory = useCallback(async (equipment: Equipment[]): Promise<void> => {
    if (!parsedRider || parsedRider.items.length === 0) return;
    
    setIsMatching(true);
    setProgress('Сопоставление с базой оборудования...');
    
    try {
      const service = getService();
      
      const inventory = equipment.map(eq => ({
        id: eq.id,
        name: eq.name,
        category: eq.category,
        price: eq.price,
        unit: eq.unit,
      }));
      
      const result = await service.matchWithInventory(parsedRider.items, inventory);
      
      // Формируем массив сопоставленных элементов
      const matched: MatchedRiderItem[] = result.matched.map(m => ({
        ...m.riderItem,
        inventoryItem: m.inventoryItem,
        confidence: m.confidence,
        isMatched: true,
      }));
      
      // Формируем несопоставленные
      const unmatched: RiderItem[] = result.unmatched.map(u => ({
        ...u,
        confidence: 0,
      }));
      
      setMatchedItems(matched);
      setUnmatchedItems(unmatched);
      
      const matchCount = matched.length;
      const totalCount = parsedRider.items.length;
      
      if (matchCount === totalCount) {
        toast.success(`Все ${totalCount} позиций сопоставлены с базой`);
      } else {
        toast.info(`Сопоставлено ${matchCount} из ${totalCount}. ${unmatched.length} позиций нужно добавить вручную.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при сопоставлении';
      setError(message);
      toast.error(message);
      
      // Если сопоставление не удалось - все в unmatched
      setMatchedItems([]);
      setUnmatchedItems(parsedRider.items.map(item => ({ ...item, confidence: 0 })));
    } finally {
      setIsMatching(false);
      setProgress('');
    }
  }, [parsedRider, getService]);

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
    parseRiderText,
    matchWithInventory,
    reset,
    extractTextFromFile,
  };
}
