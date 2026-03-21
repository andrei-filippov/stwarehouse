import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Printer, Download } from 'lucide-react';

interface QRCodeDisplayProps {
  value: string;
  title?: string;
  size?: number;
  showText?: boolean;
}

export function QRCodeDisplay({ value, title, size = 200, showText = true }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(value, { 
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then(url => setDataUrl(url))
      .catch(err => console.error('QR generation error:', err));
  }, [value, size]);

  if (!dataUrl) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <img 
        src={dataUrl} 
        alt={`QR Code: ${value}`}
        className="rounded-lg"
        style={{ width: size, height: size }}
      />
      {showText && (
        <div className="text-center">
          {title && <p className="font-medium text-sm">{title}</p>}
          <p className="text-xs text-gray-500 font-mono">{value}</p>
        </div>
      )}
    </div>
  );
}

interface QRCodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  title?: string;
  equipmentName?: string;
}

export function QRCodeDialog({ isOpen, onClose, value, title, equipmentName }: QRCodeDialogProps) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrElement = document.getElementById('qr-print-area');
    if (!qrElement) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Печать QR-кода</title>
          <style>
            body { 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh; 
              margin: 0;
              font-family: Arial, sans-serif;
            }
            .qr-container {
              text-align: center;
              padding: 20px;
              border: 1px dashed #ccc;
            }
            .qr-code { width: 200px; height: 200px; }
            .title { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
            .code { font-size: 12px; color: #666; font-family: monospace; }
            @media print {
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            ${equipmentName ? `<div class="title">${equipmentName}</div>` : ''}
            <img class="qr-code" src="${qrElement.querySelector('img')?.src}" />
            <div class="code">${value}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleDownload = () => {
    const qrElement = document.getElementById('qr-print-area');
    const img = qrElement?.querySelector('img');
    if (!img) return;

    const link = document.createElement('a');
    link.href = img.src;
    link.download = `qr-${value}.png`;
    link.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm w-[95%] rounded-xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>QR-код оборудования</DialogTitle>
        </DialogHeader>
        
        <div id="qr-print-area" className="flex flex-col items-center gap-4 py-4">
          <QRCodeDisplay value={value} title={equipmentName} size={200} />
        </div>

        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Скачать
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Печать
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Компонент для печати нескольких QR-кодов на листе
interface QRCodeBatchPrintProps {
  items: { qr_code: string; name?: string; category?: string }[];
}

export function QRCodeBatchPrint({ items }: QRCodeBatchPrintProps) {
  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Генерируем все QR-коды
    const qrDataUrls = await Promise.all(
      items.map(async (item) => {
        const url = await QRCode.toDataURL(item.qr_code!, { width: 150, margin: 1 });
        return { ...item, dataUrl: url };
      })
    );

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Печать QR-кодов</title>
          <style>
            body { margin: 0; padding: 10px; }
            .grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
            }
            .qr-item {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: center;
              page-break-inside: avoid;
            }
            .qr-img { width: 100px; height: 100px; }
            .name { font-size: 10px; font-weight: bold; margin-top: 5px; }
            .code { font-size: 9px; color: #666; font-family: monospace; }
            @media print {
              body { -webkit-print-color-adjust: exact; }
              .no-print { display: none; }
            }
            @media (max-width: 600px) {
              .grid { grid-template-columns: repeat(2, 1fr); }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px;">
              🖨️ Печать
            </button>
          </div>
          <div class="grid">
            ${qrDataUrls.map(item => `
              <div class="qr-item">
                <img class="qr-img" src="${item.dataUrl}" />
                ${item.name ? `<div class="name">${item.name}</div>` : ''}
                <div class="code">${item.qr_code}</div>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Button variant="outline" onClick={handlePrint}>
      <Printer className="w-4 h-4 mr-2" />
      Печать {items.length} QR-кодов
    </Button>
  );
}
