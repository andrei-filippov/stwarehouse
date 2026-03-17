import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Download, FileText, Edit, Save, X, Printer } from 'lucide-react';
import type { Invoice, PDFSettings } from '../types';
import { generateInvoiceHTML, exportInvoiceToDOCX } from '../lib/invoiceExport';
import { sanitizeHtml } from '../lib/utils';

interface InvoicePreviewProps {
  invoice: Invoice;
  pdfSettings: PDFSettings;
  onClose: () => void;
  onSaveContent?: (content: string) => void;
}

export function InvoicePreview({ 
  invoice, 
  pdfSettings, 
  onClose,
  onSaveContent 
}: InvoicePreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedHtml, setEditedHtml] = useState<string>('');
  const editRef = useRef<HTMLDivElement>(null);
  
  const htmlContent = generateInvoiceHTML(invoice, pdfSettings);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.innerHTML = sanitizeHtml(htmlContent);
    }
  }, [isEditing, htmlContent]);

  const handleExportDOCX = async () => {
    try {
      await exportInvoiceToDOCX(invoice, pdfSettings);
    } catch (error) {
      console.error('Error exporting invoice:', error);
      alert('Ошибка при экспорте счета');
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Счет № ${invoice.number}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          ${isEditing && editRef.current ? editRef.current.innerHTML : htmlContent}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleToggleEdit = () => {
    if (isEditing) {
      // Отмена редактирования
      setIsEditing(false);
    } else {
      // Начало редактирования
      setEditedHtml(htmlContent);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (editRef.current && onSaveContent) {
      onSaveContent(sanitizeHtml(editRef.current.innerHTML));
    }
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          <span className="font-medium">
            Счет № {invoice.number} от {new Date(invoice.date).toLocaleDateString('ru-RU')}
          </span>
          {isEditing && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
              Режим редактирования
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onSaveContent && (
            isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={handleToggleEdit}>
                  <X className="w-4 h-4 mr-1" />
                  Отмена
                </Button>
                <Button variant="default" size="sm" onClick={handleSaveEdit}>
                  <Save className="w-4 h-4 mr-1" />
                  Сохранить
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleToggleEdit}>
                <Edit className="w-4 h-4 mr-1" />
                Редактировать
              </Button>
            )
          )}
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" />
            Печать
          </Button>
          <Button variant="default" size="sm" onClick={handleExportDOCX}>
            <Download className="w-4 h-4 mr-1" />
            DOCX
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-auto p-8 bg-gray-100">
        <div className="max-w-[210mm] mx-auto bg-white shadow-lg">
          {isEditing ? (
            <div
              ref={editRef}
              contentEditable
              className="border rounded-lg p-4 bg-white overflow-y-auto"
              style={{ minHeight: '400px' }}
              suppressContentEditableWarning
            />
          ) : (
            <iframe
              srcDoc={htmlContent}
              className="w-full min-h-[297mm] border-0"
              title="Invoice Preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}
