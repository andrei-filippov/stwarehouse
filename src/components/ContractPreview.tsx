import { useState, useMemo } from 'react';
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
  Eye
} from 'lucide-react';
import type { Contract, PDFSettings } from '../types';
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS, CONTRACT_TYPE_LABELS } from '../types';
import { generateContractHTML, exportContractToDOCX, printContract } from '../lib/contractExport';

interface ContractPreviewProps {
  contract: Contract;
  pdfSettings: PDFSettings;
  onClose: () => void;
}

export function ContractPreview({ contract, pdfSettings, onClose }: ContractPreviewProps) {
  const [isExportingDOCX, setIsExportingDOCX] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Генерируем HTML для предпросмотра
  const htmlContent = useMemo(() => {
    return generateContractHTML(contract, pdfSettings);
  }, [contract, pdfSettings]);

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

  const statusColors = CONTRACT_STATUS_COLORS[contract.status];

  return (
    <div className="space-y-4">
      {/* Информация о договоре */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Договор № {contract.number}</h3>
              <p className="text-sm text-gray-500">
                от {new Date(contract.date).toLocaleDateString('ru-RU')}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Badge variant="outline">{CONTRACT_TYPE_LABELS[contract.type]}</Badge>
              <Badge className={`${statusColors.bg} ${statusColors.text} border-0`}>
                {CONTRACT_STATUS_LABELS[contract.status]}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
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

      {/* Действия */}
      <div className="flex flex-wrap gap-2">
        <Button 
          onClick={handlePrint} 
          disabled={isPrinting}
          variant="outline"
          className="flex-1"
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
          disabled={isExportingDOCX}
          variant="outline"
          className="flex-1"
        >
          {isExportingDOCX ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-2" />
          )}
          Скачать DOCX
        </Button>
      </div>

      {/* Предпросмотр */}
      <Tabs defaultValue="preview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preview">
            <Eye className="w-4 h-4 mr-2" />
            Предпросмотр
          </TabsTrigger>
          <TabsTrigger value="details">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Детали
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-4">
          <div 
            className="border rounded-lg p-8 bg-white min-h-[500px] overflow-auto"
            style={{ maxHeight: '60vh' }}
          >
            <div 
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              className="contract-preview"
            />
          </div>
        </TabsContent>

        <TabsContent value="details" className="mt-4 space-y-4">
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

      <div className="flex justify-end pt-4 border-t">
        <Button onClick={onClose}>Закрыть</Button>
      </div>

      <style>{`
        .contract-preview {
          font-family: "Times New Roman", Times, serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #000;
        }
        .contract-preview .center {
          text-align: center;
        }
        .contract-preview .bold {
          font-weight: bold;
        }
        .contract-preview table.spec {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          font-size: 10pt;
        }
        .contract-preview table.spec th,
        .contract-preview table.spec td {
          border: 1px solid #000;
          padding: 5px;
          text-align: left;
        }
        .contract-preview table.spec th {
          background-color: #f0f0f0;
        }
        .contract-preview .signatures {
          margin-top: 50px;
          display: flex;
          justify-content: space-between;
        }
        .contract-preview .signature-block {
          width: 45%;
        }
      `}</style>
    </div>
  );
}
