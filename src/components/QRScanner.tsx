import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, Camera, Keyboard } from 'lucide-react';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (qrCode: string) => void;
  title?: string;
  subtitle?: string;
  keepOpen?: boolean; // Не закрывать после сканирования (для batch режима)
}

export function QRScanner({ isOpen, onClose, onScan, title = 'Сканировать QR-код', subtitle, keepOpen }: QRScannerProps) {
  console.log('[QRScanner] Render, isOpen:', isOpen, 'keepOpen:', keepOpen);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualCode, setManualCode] = useState('');
  const [useCamera, setUseCamera] = useState(true);
  const [error, setError] = useState<string>('');
  const [scanKey, setScanKey] = useState(0); // Для перезапуска сканера в batch режиме
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const controlsRef = useRef<any>(null);
  const isProcessingRef = useRef(false); // Защита от двойного срабатывания
  const hasScannedRef = useRef(false); // Отслеживание успешного скана
  const onScanRef = useRef(onScan); // Храним актуальную версию onScan
  const onCloseRef = useRef(onClose); // Храним актуальную версию onClose

  // Обновляем ref при изменении onScan
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);
  
  // Обновляем ref при изменении onClose
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Остановка камеры
  const stopScanning = () => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (e) {
        // Игнорируем ошибки при остановке
      }
      controlsRef.current = null;
    }
    // Останавливаем все video tracks для полного освобождения камеры
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    codeReaderRef.current = null;
    isProcessingRef.current = false;
  };

  useEffect(() => {
    if (!isOpen || !useCamera) return;
    
    // Сбрасываем флаг сканирования при открытии
    hasScannedRef.current = false;

    const startScanning = async () => {
      // Защита от повторного запуска
      if (isProcessingRef.current) return;
      
      // Проверяем что video элемент готов
      if (!videoRef.current) {
        console.log('Video element not ready');
        return;
      }

      try {
        setError('');
        isProcessingRef.current = true;
        codeReaderRef.current = new BrowserQRCodeReader();
        
        const result = await codeReaderRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, error) => {
            if (result && isProcessingRef.current) {
              const text = result.getText();
              // Извлекаем QR код из URL если нужно
              const extractedCode = extractQRCode(text);
              
              console.log('[QRScanner] Scanned:', text, 'extracted:', extractedCode, 'keepOpen:', keepOpen);
              // ОТМЕЧАЕМ УСПЕШНЫЙ СКАН СРАЗУ - до любых операций!
              hasScannedRef.current = true;
              console.log('[QRScanner] hasScannedRef set to TRUE');
              
              if (keepOpen) {
                // Не закрываем сканер после сканирования (для batch режима чек-листов)
                console.log('[QRScanner] keepOpen mode - calling onScan, restarting camera');
                stopScanning();
                onScanRef.current(extractedCode);
                // Перезапускаем сканер для следующего сканирования
                setTimeout(() => {
                  setScanKey(prev => prev + 1);
                }, 500);
              } else {
                // Обычный режим - закрываем после сканирования
                console.log('[QRScanner] Normal mode - calling onScan and onClose');
                stopScanning();
                onScanRef.current(extractedCode);
                onClose();
              }
            }
          }
        );
        
        controlsRef.current = result;
      } catch (err) {
        console.error('Camera error:', err);
        setError('Не удалось получить доступ к камере. Проверьте разрешения.');
        setUseCamera(false);
        isProcessingRef.current = false;
      }
    };

    // Небольшая задержка для инициализации video элемента
    const timeoutId = setTimeout(() => {
      startScanning();
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      stopScanning();
    };
  }, [isOpen, useCamera, scanKey]); // scanKey для перезапуска в batch режиме

  // Извлекает QR код из URL (поддержка ?scan=XXX)
  const extractQRCode = (input: string): string => {
    const lowerInput = input.toLowerCase();
    
    // Если это URL с параметром scan
    try {
      const url = new URL(input);
      for (const [key, value] of url.searchParams) {
        if (key.toLowerCase() === 'scan') {
          return value.toUpperCase();
        }
      }
    } catch {
      // Не URL, пробуем найти ?scan= вручную
      const scanMatch = lowerInput.match(/[?&]scan=([^&]+)/);
      if (scanMatch) {
        return scanMatch[1].toUpperCase();
      }
    }
    // Если это не URL с scan параметром, возвращаем как есть
    return input.toUpperCase();
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      const code = manualCode.trim();
      // Извлекаем код из URL если нужно
      const extractedCode = extractQRCode(code);
      onScanRef.current(extractedCode);
      setManualCode('');
      onClose();
    }
  };

  // Закрытие по кнопке или крестику - всегда вызываем onClose
  const handleManualClose = () => {
    console.log('[QRScanner] handleManualClose called');
    stopScanning();
    setManualCode('');
    setError('');
    onCloseRef.current();
    hasScannedRef.current = false;
  };

  // Закрытие через Dialog onOpenChange (при размонтировании)
  const handleDialogClose = () => {
    console.log('[QRScanner] handleDialogClose called, keepOpen:', keepOpen, 'hasScanned:', hasScannedRef.current);
    stopScanning();
    setManualCode('');
    setError('');
    // Не вызываем onClose если был успешный скан (это автоматическое закрытие при размонтировании)
    if (!hasScannedRef.current) {
      onCloseRef.current();
    }
    hasScannedRef.current = false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-md w-[95%] rounded-xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {useCamera ? <Camera className="w-5 h-5" /> : <Keyboard className="w-5 h-5" />}
            {title}
          </DialogTitle>
          {subtitle && (
            <p className="text-sm text-blue-600 font-medium">{subtitle}</p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Переключатель режима */}
          <div className="flex gap-2">
            <Button
              variant={useCamera ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUseCamera(true)}
              className="flex-1"
            >
              <Camera className="w-4 h-4 mr-2" />
              Камера
            </Button>
            <Button
              variant={!useCamera ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUseCamera(false)}
              className="flex-1"
            >
              <Keyboard className="w-4 h-4 mr-2" />
              Вручную
            </Button>
          </div>

          {useCamera ? (
            <div className="space-y-2">
              {error ? (
                <div className="text-center py-8 text-red-500">
                  <p>{error}</p>
                  <Button 
                    variant="outline" 
                    onClick={() => setUseCamera(false)}
                    className="mt-4"
                  >
                    Ввести код вручную
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                    <video 
                      ref={videoRef} 
                      className="w-full h-full object-cover"
                      muted
                    />
                    {/* Оверлей с уголками */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-2 border-white/50 relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-500" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-500" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-500" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-500" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-center text-gray-500">
                    Наведите камеру на QR-код
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Введите QR-код вручную
                </label>
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="Например: EQ-A7B3C9D2"
                  className="font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                />
              </div>
              <Button 
                onClick={handleManualSubmit}
                disabled={!manualCode.trim()}
                className="w-full"
              >
                Подтвердить
              </Button>
            </div>
          )}
          
          {/* Кнопка завершения для режима batch */}
          {subtitle && (
            <div className="pt-2 border-t">
              <Button 
                variant="outline" 
                onClick={handleManualClose}
                className="w-full"
              >
                ✓ Завершить сканирование
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
