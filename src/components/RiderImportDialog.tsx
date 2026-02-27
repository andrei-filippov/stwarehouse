import { useState, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Textarea } from './ui/textarea';
import { useRiderParser } from '../hooks/useRiderParser';
import { Spinner } from './ui/spinner';
import type { MatchedRiderItem, RiderItem } from '../types/rider';
import type { Equipment, EstimateItem } from '../types';
import { 
  Upload, 
  FileText, 
  Brain, 
  CheckCircle2, 
  AlertCircle, 
  X,
  ArrowRight,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  Search
} from 'lucide-react';
import { ACCEPTED_RIDER_FORMATS } from '../types/rider';

interface RiderImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (estimateData: {
    event_name: string;
    venue: string;
    event_date: string;
  }, items: EstimateItem[]) => void;
  equipment: Equipment[];
  gigachatClientId: string;
  gigachatClientSecret: string;
}

type Step = 'upload' | 'parsing' | 'review' | 'matching';

export function RiderImportDialog({
  isOpen,
  onClose,
  onImport,
  equipment,
  gigachatClientId,
  gigachatClientSecret,
}: RiderImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [riderText, setRiderText] = useState('');
  const [eventName, setEventName] = useState('');
  const [venue, setVenue] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isParsing,
    isMatching,
    progress,
    parsedRider,
    matchedItems,
    unmatchedItems,
    parseRiderText,
    matchWithInventory,
    reset,
    extractTextFromFile,
  } = useRiderParser({
    clientId: gigachatClientId,
    clientSecret: gigachatClientSecret,
  });

  // Обработка загрузки файла
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await extractTextFromFile(file);
      setRiderText(text);
    } catch (err) {
      // Ошибка уже показана в хуке
    }
  }, [extractTextFromFile]);

  // Запуск парсинга
  const handleParse = useCallback(async () => {
    const parsed = await parseRiderText(riderText);
    if (parsed) {
      setEventName(parsed.event_name || '');
      setVenue(parsed.venue || '');
      setEventDate(parsed.event_date || '');
      setStep('parsing');
      
      // Автоматически выбираем все позиции
      const allIndices = new Set(parsed.items.map((_, i) => i));
      setSelectedItems(allIndices);
      
      // Устанавливаем количества
      const qtys: Record<number, number> = {};
      parsed.items.forEach((item, i) => {
        qtys[i] = item.quantity;
      });
      setQuantities(qtys);
    }
  }, [riderText, parseRiderText]);

  // Запуск сопоставления с базой
  const handleMatch = useCallback(async () => {
    await matchWithInventory(equipment);
    setStep('matching');
  }, [matchWithInventory, equipment]);

  // Переключение выбора позиции
  const toggleItem = useCallback((index: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Изменение количества
  const updateQuantity = useCallback((index: number, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [index]: Math.max(1, (prev[index] || 1) + delta),
    }));
  }, []);

  // Финальный импорт
  const handleImport = useCallback(() => {
    const allItems = [...matchedItems, ...unmatchedItems];
    const items: EstimateItem[] = [];

    selectedItems.forEach(index => {
      const item = allItems[index];
      if (!item) return;

      // Если есть сопоставленное оборудование - используем его данные
      if ('inventoryItem' in item && item.inventoryItem) {
        items.push({
          name: item.inventoryItem.name,
          description: item.description || '',
          category: item.inventoryItem.category,
          quantity: quantities[index] || item.quantity,
          price: item.inventoryItem.price,
          unit: item.inventoryItem.unit,
          coefficient: 1,
        });
      } else {
        // Иначе используем данные из райдера
        items.push({
          name: item.name,
          description: item.description || '',
          category: item.category || 'Другое',
          quantity: quantities[index] || item.quantity,
          price: 0, // Пользователь задаст цену
          unit: 'шт',
          coefficient: 1,
        });
      }
    });

    onImport(
      {
        event_name: eventName || 'Мероприятие из райдера',
        venue: venue || '',
        event_date: eventDate || new Date().toISOString().split('T')[0],
      },
      items
    );

    handleClose();
  }, [matchedItems, unmatchedItems, selectedItems, quantities, eventName, venue, eventDate, onImport]);

  // Закрытие и сброс
  const handleClose = useCallback(() => {
    reset();
    setStep('upload');
    setRiderText('');
    setEventName('');
    setVenue('');
    setEventDate('');
    setSelectedItems(new Set());
    setQuantities({});
    onClose();
  }, [reset, onClose]);

  // Получение цвета для уверенности сопоставления
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const allItems = [...matchedItems, ...unmatchedItems];
  const selectedCount = selectedItems.size;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="rider-dialog-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            Импорт из райдера (AI)
          </DialogTitle>
          <DialogDescription id="rider-dialog-desc">
            GigaChat проанализирует технический райдер и извлечёт оборудование
          </DialogDescription>
        </DialogHeader>

        {/* Шаг 1: Загрузка */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Загрузка файла */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_RIDER_FORMATS.join(',')}
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-sm text-gray-600 mb-2">
                Перетащите файл или{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 hover:underline"
                >
                  выберите
                </button>
              </p>
              <p className="text-xs text-gray-400">
                Поддерживаемые форматы: PDF, DOC, DOCX, TXT
              </p>
            </div>

            {/* Или вставка текста */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">или вставьте текст</span>
              </div>
            </div>

            <Textarea
              value={riderText}
              onChange={(e) => setRiderText(e.target.value)}
              placeholder="Вставьте текст технического райдера сюда..."
              rows={8}
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Отмена
              </Button>
              <Button 
                onClick={handleParse}
                disabled={!riderText.trim() || isParsing}
              >
                {isParsing ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    {progress}
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Анализировать
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Шаг 2: Просмотр извлечённого */}
        {step === 'parsing' && parsedRider && (
          <div className="space-y-4">
            {/* Информация о мероприятии */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Информация о мероприятии</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">Название</label>
                  <Input
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Название мероприятия"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-500">Площадка</label>
                    <Input
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      placeholder="Площадка"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Дата</label>
                    <Input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Список оборудования */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">
                    Извлечённое оборудование
                    <Badge variant="secondary" className="ml-2">
                      {parsedRider.items.length}
                    </Badge>
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      const all = new Set(parsedRider.items.map((_, i) => i));
                      setSelectedItems(all);
                    }}
                  >
                    Выбрать все
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {parsedRider.items.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-2 rounded border ${
                        selectedItems.has(index) ? 'bg-blue-50 border-blue-200' : 'bg-white'
                      }`}
                    >
                      <Checkbox
                        checked={selectedItems.has(index)}
                        onCheckedChange={() => toggleItem(index)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-gray-500 truncate">{item.description}</p>
                        )}
                        {item.category && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {item.category}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => updateQuantity(index, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">
                          {quantities[index] || item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => updateQuantity(index, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep('upload')}>
                ← Назад
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Отмена
                </Button>
                <Button 
                  onClick={handleMatch}
                  disabled={selectedCount === 0}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Сопоставить с базой ({selectedCount})
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Шаг 3: Результаты сопоставления */}
        {step === 'matching' && (
          <div className="space-y-4">
            {/* Статистика */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="bg-green-50">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{matchedItems.length}</p>
                  <p className="text-xs text-green-700">Сопоставлено</p>
                </CardContent>
              </Card>
              <Card className="bg-yellow-50">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{unmatchedItems.length}</p>
                  <p className="text-xs text-yellow-700">Не найдено</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{selectedCount}</p>
                  <p className="text-xs text-blue-700">Выбрано</p>
                </CardContent>
              </Card>
            </div>

            {/* Таблица результатов */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Результаты сопоставления</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {/* Сопоставленные */}
                  {matchedItems.map((item, idx) => (
                    <div
                      key={`matched-${idx}`}
                      className={`flex items-center gap-3 p-3 rounded border ${
                        selectedItems.has(idx) ? 'bg-green-50 border-green-200' : 'bg-gray-50'
                      }`}
                    >
                      <Checkbox
                        checked={selectedItems.has(idx)}
                        onCheckedChange={() => toggleItem(idx)}
                      />
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{item.name}</p>
                          <Badge className={getConfidenceColor(item.confidence)}>
                            {Math.round(item.confidence * 100)}%
                          </Badge>
                        </div>
                        {item.inventoryItem && (
                          <p className="text-xs text-gray-600">
                            → {item.inventoryItem.name} ({item.inventoryItem.price} ₽/{item.inventoryItem.unit})
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-medium">
                        ×{quantities[idx] || item.quantity}
                      </span>
                    </div>
                  ))}

                  {/* Несопоставленные */}
                  {unmatchedItems.map((item, idx) => {
                    const globalIdx = matchedItems.length + idx;
                    return (
                      <div
                        key={`unmatched-${idx}`}
                        className={`flex items-center gap-3 p-3 rounded border ${
                          selectedItems.has(globalIdx) ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50'
                        }`}
                      >
                        <Checkbox
                          checked={selectedItems.has(globalIdx)}
                          onCheckedChange={() => toggleItem(globalIdx)}
                        />
                        <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-yellow-600">
                            Не найдено в базе - цену нужно будет указать вручную
                          </p>
                        </div>
                        <span className="text-sm font-medium">
                          ×{quantities[globalIdx] || item.quantity}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep('parsing')}>
                ← Назад
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Отмена
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={selectedCount === 0}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Создать смету ({selectedCount})
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
