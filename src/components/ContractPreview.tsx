import { useState, useMemo, useRef } from 'react';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { 
  Printer, 
  Download, 
  FileText, 
  FileSpreadsheet,
  Loader2,
  Eye,
  Edit3,
  Save,
  X,
  Maximize2,
  Minimize2,
  FileType
} from 'lucide-react';
import type { Contract, PDFSettings, CompanyBankAccount } from '../types';
import { useCompanyContext } from '../contexts/CompanyContext';
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS, CONTRACT_TYPE_LABELS } from '../types';
import { generateContractHTML, exportContractToDOCX, exportContractToDOC, printContract } from '../lib/contractExport';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { sanitizeHtml, cleanEditedHtml } from '../lib/utils';

interface ContractPreviewProps {
  contract: Contract;
  pdfSettings: PDFSettings;
  bankAccounts?: CompanyBankAccount[];
  onClose: () => void;
  onSaveContent?: (content: string) => void;
}

export function ContractPreview({ contract, pdfSettings, bankAccounts = [], onClose, onSaveContent }: ContractPreviewProps) {
  const { company } = useCompanyContext();
  const [isExportingDOCX, setIsExportingDOCX] = useState(false);
  const [isExportingDOC, setIsExportingDOC] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editedHtml, setEditedHtml] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);

  // Генерируем HTML для предпросмотра
  const htmlContent = useMemo(() => {
    return generateContractHTML(contract, pdfSettings, bankAccounts, company);
  }, [contract, pdfSettings, bankAccounts, company]);

  // Текущий контент (отредактированный или оригинальный) - санитизирован
  // Всегда используем светлый фон для документов (независимо от темы приложения)
  const currentContent = useMemo(() => {
    const content = editedHtml || htmlContent;
    const sanitized = sanitizeHtml(content);
    
    // Стили для печатного документа - всегда светлые
    const printStyles = `
      <style>
        body {
          font-family: 'Times New Roman', Times, serif;
          line-height: 1.6;
          padding: 20px;
          background-color: #ffffff !important;
          color: #000000 !important;
        }
        * {
          color: #000000 !important;
        }
        table, td, th {
          border-color: #000000 !important;
        }
        .signature-block, .parties, .section {
          color: #000000 !important;
        }
      </style>
    `;
    
    // Вставляем стили перед содержимым
    if (sanitized.includes('<style')) {
      return sanitized;
    }
    return printStyles + sanitized;
  }, [editedHtml, htmlContent]);

  // Обработчик экспорта в DOCX
  const handleExportDOCX = async () => {
    setIsExportingDOCX(true);
    try {
      await exportContractToDOCX(contract, pdfSettings, bankAccounts, company);
    } catch (error) {
      console.error('DOCX export error:', error);
      alert('Ошибка при экспорте в DOCX');
    } finally {
      setIsExportingDOCX(false);
    }
  };

  // Обработчик экспорта в DOC
  const handleExportDOC = async () => {
    setIsExportingDOC(true);
    try {
      exportContractToDOC(contract, pdfSettings, bankAccounts, company);
    } catch (error) {
      console.error('DOC export error:', error);
      alert('Ошибка при экспорте в DOC');
    } finally {
      setIsExportingDOC(false);
    }
  };

  // Обработчик печати
  const handlePrint = () => {
    setIsPrinting(true);
    try {
      printContract(contract, pdfSettings, bankAccounts, company);
    } catch (error) {
      console.error('Print error:', error);
      alert('Ошибка при печати');
    } finally {
      setIsPrinting(false);
    }
  };

  // Обработчик сохранения отредактированного текста
  const handleSaveEdit = () => {
    if (editRef.current) {
      // Сначала очищаем от браузерных стилей, затем санитизируем
      const cleanedContent = cleanEditedHtml(editRef.current.innerHTML);
      const newContent = sanitizeHtml(cleanedContent);
      setEditedHtml(newContent);
      // Вызываем callback если передан
      if (onSaveContent) {
        onSaveContent(newContent);
      }
    }
    setIsEditing(false);
  };

  // Обработчик отмены редактирования
  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const statusColors = CONTRACT_STATUS_COLORS[contract.status];

  // Компонент предпросмотра (используется и в диалоге, и в полноэкранном режиме)
  const PreviewContent = () => (
    <div className="flex flex-col h-full">
      {/* Header с информацией о договоре */}
      <div className="p-4 border-b bg-card">
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Договор № {contract.number}</h3>
                <p className="text-sm text-muted-foreground">
                  от {new Date(contract.date).toLocaleDateString('ru-RU')}
                </p>
              </div>
              
              <div className="flex gap-2 items-center">
                <Badge variant="outline">{CONTRACT_TYPE_LABELS[contract.type]}</Badge>
                <Badge className={`${statusColors.bg} ${statusColors.text} border-0`}>
                  {CONTRACT_STATUS_LABELS[contract.status]}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
              <div>
                <span className="text-muted-foreground">Заказчик:</span>
                <div className="font-medium">{contract.customer?.name || 'Не указан'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Сумма:</span>
                <div className="font-medium text-lg">
                  {contract.total_amount.toLocaleString('ru-RU')} ₽
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Мероприятие:</span>
                <div className="font-medium">
                  {contract.event_name || contract.estimates?.[0]?.estimate?.event_name || 'Не указано'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Место:</span>
                <div className="font-medium">
                  {contract.venue || contract.estimates?.[0]?.estimate?.venue || 'Не указано'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Действия */}
      <div className="flex flex-wrap gap-2 p-4 border-b bg-muted">
        <Button 
          onClick={handlePrint} 
          disabled={isPrinting || isEditing}
          variant="outline"
        >
          {isPrinting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Printer className="w-4 h-4 mr-2" />
          )}
          Печать / PDF
        </Button>
        
        <Button 
          onClick={handleExportDOCX} 
          disabled={isExportingDOCX || isEditing}
          variant="outline"
        >
          {isExportingDOCX ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-2" />
          )}
          Скачать DOCX
        </Button>

        <Button 
          onClick={handleExportDOC} 
          disabled={isExportingDOC || isEditing}
          variant="outline"
        >
          {isExportingDOC ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileType className="w-4 h-4 mr-2" />
          )}
          Скачать DOC
        </Button>

        <div className="flex-1"></div>

        {/* Переключатель редактирования */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button 
                onClick={handleSaveEdit}
                variant="default"
                className="bg-green-600 hover:bg-green-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Сохранить
              </Button>
              <Button 
                onClick={handleCancelEdit}
                variant="outline"
              >
                <X className="w-4 h-4 mr-2" />
                Отмена
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => setIsEditing(true)}
              variant="outline"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Редактировать
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? 'Свернуть' : 'На весь экран'}
        >
          {isFullscreen ? (
            <><Minimize2 className="w-4 h-4 mr-2" /> Свернуть</>
          ) : (
            <><Maximize2 className="w-4 h-4 mr-2" /> На весь экран</>
          )}
        </Button>
      </div>

      {/* Основной контент */}
      <Tabs defaultValue="preview" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-2 mx-4 mt-2 max-w-md">
          <TabsTrigger value="preview">
            <Eye className="w-4 h-4 mr-2" />
            {isEditing ? 'Редактирование' : 'Предпросмотр'}
          </TabsTrigger>
          <TabsTrigger value="details">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Детали
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="flex-1 mt-2 px-4 pb-4 min-h-0 overflow-hidden flex flex-col">
          {isEditing ? (
            // Режим редактирования - показываем HTML с таблицами
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="text-sm text-muted-foreground mb-2 flex-shrink-0">
                Режим редактирования. Вы можете изменить текст договора перед печатью или экспортом.
              </div>
              <div
                ref={editRef}
                className="flex-1 border rounded-lg p-4 bg-white text-black overflow-auto font-serif text-sm leading-relaxed"
                contentEditable
                dangerouslySetInnerHTML={{ __html: currentContent }}
              />
            </div>
          ) : (
            // Режим предпросмотра - используем iframe для изоляции стилей
            <div className="flex-1 border rounded-lg bg-white overflow-hidden shadow-inner min-h-0">
              <iframe
                ref={previewRef as any}
                srcDoc={currentContent}
                className="w-full h-full"
                style={{
                  border: 'none',
                }}
                title="Предпросмотр договора"
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="details" className="mt-2 px-4 pb-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 350px)' }}>
          <Card>
            <CardContent className="pt-4 space-y-3">
              <h4 className="font-medium">Основная информация</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Номер:</div>
                <div>{contract.number}</div>
                
                <div className="text-muted-foreground">Дата:</div>
                <div>{new Date(contract.date).toLocaleDateString('ru-RU')}</div>
                
                <div className="text-muted-foreground">Тип:</div>
                <div>{CONTRACT_TYPE_LABELS[contract.type]}</div>
                
                <div className="text-muted-foreground">Статус:</div>
                <div>{CONTRACT_STATUS_LABELS[contract.status]}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <h4 className="font-medium">Заказчик</h4>
              {contract.customer ? (
                <div className="space-y-2 text-sm">
                  <div className="font-medium">{contract.customer.name}</div>
                  {contract.customer.inn && <div>ИНН: {contract.customer.inn}</div>}
                  {contract.customer.kpp && <div>КПП: {contract.customer.kpp}</div>}
                  {contract.customer.legal_address && (
                    <div>Адрес: {contract.customer.legal_address}</div>
                  )}
                  {contract.customer.contact_person && (
                    <div>Контакт: {contract.customer.contact_person}</div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground">Заказчик не выбран</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <h4 className="font-medium">Исполнитель</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Наименование:</div>
                <div>{contract.executor_name || pdfSettings.companyName || 'Не указано'}</div>
                
                <div className="text-muted-foreground">Представитель:</div>
                <div>{contract.executor_representative || pdfSettings.personName || 'Не указано'}</div>
                
                <div className="text-muted-foreground">Основание:</div>
                <div>{contract.executor_basis || 'Устава'}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <h4 className="font-medium">Привязанные сметы ({contract.estimates?.length || 0})</h4>
              {contract.estimates && contract.estimates.length > 0 ? (
                <div className="space-y-2">
                  {contract.estimates.map((ce, index) => (
                    <div key={ce.id} className="text-sm p-2 bg-muted rounded">
                      <div className="font-medium">{index + 1}. {ce.estimate?.event_name}</div>
                      <div className="text-muted-foreground">
                        {ce.estimate?.event_date && new Date(ce.estimate.event_date).toLocaleDateString('ru-RU')}
                        {' · '}
                        {ce.estimate?.total?.toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground">Сметы не привязаны</div>
              )}
            </CardContent>
          </Card>

          {contract.payment_terms && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <h4 className="font-medium">Условия оплаты</h4>
                <p className="text-sm">{contract.payment_terms}</p>
              </CardContent>
            </Card>
          )}

          {contract.additional_terms && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <h4 className="font-medium">Дополнительные условия</h4>
                <p className="text-sm">{contract.additional_terms}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>


    </div>
  );

  // Если полноэкранный режим - используем Dialog
  if (isFullscreen) {
    return (
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-5xl w-[95%] h-[95vh] p-0 overflow-hidden flex flex-col rounded-xl">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle>Просмотр договора</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <PreviewContent />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Обычный режим
  return <PreviewContent />;
}
