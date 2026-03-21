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
}

export function QRScanner({ isOpen, onClose, onScan, title = 'Сканировать QR-код' }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualCode, setManualCode] = useState('');
  const [useCamera, setUseCamera] = useState(true);
  const [error, setError] = useState<string>('');
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const controlsRef = useRef<any>(null);

  // Остановка камеры
  const stopScanning = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    // Останавливаем все video tracks для полного освобождения камеры
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    codeReaderRef.current = null;
  };

  useEffect(() => {
    if (!isOpen || !useCamera) return;

    const startScanning = async () => {
      try {
        setError('');
        codeReaderRef.current = new BrowserQRCodeReader();
        
        const result = await codeReaderRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result, error) => {
            if (result) {
              const text = result.getText();
              onScan(text);
              stopScanning();
              onClose();
            }
          }
        );
        
        controlsRef.current = result;
      } catch (err) {
        console.error('Camera error:', err);
        setError('Не удалось получить доступ к камере. Проверьте разрешения.');
        setUseCamera(false);
      }
    };

    startScanning();

    return () => {
      stopScanning();
    };
  }, [isOpen, useCamera]);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim().toUpperCase());
      setManualCode('');
      onClose();
    }
  };

  const handleClose = () => {
    stopScanning();
    setManualCode('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[95%] rounded-xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {useCamera ? <Camera className="w-5 h-5" /> : <Keyboard className="w-5 h-5" />}
            {title}
          </DialogTitle>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
