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
  Minimize2
} from 'lucide-react';
import type { Contract, PDFSettings } from '../types';
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS, CONTRACT_TYPE_LABELS } from '../types';
import { generateContractHTML, exportContractToDOCX, printContract } from '../lib/contractExport';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { sanitizeHtml } from '../lib/utils';

interface ContractPreviewProps {
  contract: Contract;
  pdfSettings: PDFSettings;
  onClose: () => void;
  onSaveContent?: (content: string) => void;
}

export function ContractPreview({ contract, pdfSettings, onClose, onSaveContent }: ContractPreviewProps) {
  const [isExportingDOCX, setIsExportingDOCX] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editedHtml, setEditedHtml] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);

  // Генерируем HTML для предпросмотра
  const htmlContent = useMemo(() => {
    return generateContractHTML(contract, pdfSettings);
  }, [contract, pdfSettings]);

  // Текущий контент (отредактированный или оригинальный) - санитизирован
  const currentContent = useMemo(() => {
    const content = editedHtml || htmlContent;
    return sanitizeHtml(content);
  }, [editedHtml, htmlContent]);

  // Обработчик экспорта в DOCX
  const handleExportDOCX = async () => {
    setIsExportingDOCX(true);
    try {
      await exportContractToDOCX(contract, pdfSettings);
    } catch (error) {
      console.error('DOCX export error:', error);
      alert('Ошибка при экспорте в DOCX');
    } finally {
      setIsExportingDOCX(false);
    }
  };

  // Обработчик печати
  const handlePrint = () => {
    setIsPrinting(true);
    try {
      printContract(contract, pdfSettings);
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
      const newContent = sanitizeHtml(editRef.current.innerHTML);
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
      <div className="p-4 border-b bg-white">
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Договор № {contract.number}</h3>
                <p className="text-sm text-gray-500">
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
                <span className="text-gray-500">Заказчик:</span>
                <div className="font-medium">{contract.customer?.name || 'Не указан'}</div>
              </div>
              <div>
                <span className="text-gray-500">Сумма:</span>
                <div className="font-medium text-lg">
                  {contract.total_amount.toLocaleString('ru-RU')} ₽
                </div>
              </div>
              <div>
                <span className="text-gray-500">Мероприятие:</span>
                <div className="font-medium">
                  {contract.event_name || contract.estimates?.[0]?.estimate?.event_name || 'Не указано'}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Место:</span>
                <div className="font-medium">
                  {contract.venue || contract.estimates?.[0]?.estimate?.venue || 'Не указано'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Действия */}
      <div className="flex flex-wrap gap-2 p-4 border-b bg-gray-50">
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

        <TabsContent value="preview" className="flex-1 mt-2 px-4 pb-4 min-h-0">
          {isEditing ? (
            // Режим редактирования - показываем HTML с таблицами
            <div className="h-full flex flex-col">
              <div className="text-sm text-gray-500 mb-2">
                Режим редактирования. Вы можете изменить текст договора перед печатью или экспортом.
              </div>
              <div
                ref={editRef}
                className="flex-1 border rounded-lg p-4 bg-white overflow-auto font-serif text-sm leading-relaxed"
                style={{ minHeight: '400px' }}
                contentEditable
                dangerouslySetInnerHTML={{ __html: currentContent }}
              />
            </div>
          ) : (
            // Режим предпросмотра - используем iframe для изоляции стилей
            <div className="border rounded-lg bg-white overflow-hidden shadow-inner">
              <iframe
                ref={previewRef as any}
                srcDoc={currentContent}
                style={{
                  width: '100%',
                  height: '500px',
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
                <div className="text-gray-500">Номер:</div>
                <div>{contract.number}</div>
                
                <div className="text-gray-500">Дата:</div>
                <div>{new Date(contract.date).toLocaleDateString('ru-RU')}</div>
                
                <div className="text-gray-500">Тип:</div>
                <div>{CONTRACT_TYPE_LABELS[contract.type]}</div>
                
                <div className="text-gray-500">Статус:</div>
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
                <div className="text-gray-500">Заказчик не выбран</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <h4 className="font-medium">Исполнитель</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500">Наименование:</div>
                <div>{contract.executor_name || pdfSettings.companyName || 'Не указано'}</div>
                
                <div className="text-gray-500">Представитель:</div>
                <div>{contract.executor_representative || pdfSettings.personName || 'Не указано'}</div>
                
                <div className="text-gray-500">Основание:</div>
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
                    <div key={ce.id} className="text-sm p-2 bg-gray-50 rounded">
                      <div className="font-medium">{index + 1}. {ce.estimate?.event_name}</div>
                      <div className="text-gray-500">
                        {ce.estimate?.event_date && new Date(ce.estimate.event_date).toLocaleDateString('ru-RU')}
                        {' · '}
                        {ce.estimate?.total?.toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500">Сметы не привязаны</div>
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
