import { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  FileText,
  Receipt,
  ClipboardCheck,
  ArrowLeft,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Send
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Contract, Invoice, Act, PDFSettings } from '../types';
import { 
  INVOICE_STATUS_LABELS, 
  INVOICE_STATUS_COLORS,
  ACT_STATUS_LABELS,
  ACT_STATUS_COLORS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  CONTRACT_TYPE_LABELS
} from '../types';
import { InvoiceForm } from './InvoiceForm';
import { ActForm } from './ActForm';
import { InvoicePreview } from './InvoicePreview';
import { ActPreview } from './ActPreview';
import { useInvoices } from '../hooks/useInvoices';
import { useActs } from '../hooks/useActs';
import { supabase } from '../lib/supabase';

interface ContractDetailProps {
  contract: Contract;
  pdfSettings: PDFSettings;
  onBack: () => void;
  onEditContract: () => void;
}

export function ContractDetail({ 
  contract, 
  pdfSettings, 
  onBack,
  onEditContract 
}: ContractDetailProps) {
  const { 
    invoices, 
    loading: invoicesLoading, 
    createInvoice, 
    updateInvoice, 
    deleteInvoice,
    getNextNumber: getNextInvoiceNumber 
} = useInvoices(contract.id);
  
  const { 
    acts, 
    loading: actsLoading, 
    createAct, 
    updateAct, 
    deleteAct,
    getNextNumber: getNextActNumber 
  } = useActs(contract.id);

  // Состояния для модальных окон
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const [isActFormOpen, setIsActFormOpen] = useState(false);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);
  const [isActPreviewOpen, setIsActPreviewOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingAct, setEditingAct] = useState<Act | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewAct, setPreviewAct] = useState<Act | null>(null);

  // Обработчики счетов
  const handleCreateInvoice = useCallback(() => {
    setEditingInvoice(null);
    setIsInvoiceFormOpen(true);
  }, []);

  const handleEditInvoice = useCallback((invoice: Invoice) => {
    setEditingInvoice(invoice);
    setIsInvoiceFormOpen(true);
  }, []);

  const handlePreviewInvoice = useCallback((invoice: Invoice) => {
    setPreviewInvoice(invoice);
    setIsInvoicePreviewOpen(true);
  }, []);

  const handleSaveInvoice = useCallback(async (data: Partial<Invoice>) => {
    try {
      // Получаем текущего пользователя
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Ошибка: пользователь не авторизован');
        return;
      }
      
      // Добавляем user_id к данным
      const invoiceData = { ...data, user_id: user.id };
      
      let result;
      if (editingInvoice) {
        result = await updateInvoice(editingInvoice.id, invoiceData);
      } else {
        result = await createInvoice(invoiceData);
      }
      
      if (result?.error) {
        console.error('Error saving invoice:', result.error);
        alert('Ошибка при сохранении счета: ' + result.error);
        return;
      }
      
      setIsInvoiceFormOpen(false);
      setEditingInvoice(null);
    } catch (err) {
      console.error('Exception saving invoice:', err);
      alert('Ошибка при сохранении счета');
    }
  }, [editingInvoice, createInvoice, updateInvoice]);

  const handleDeleteInvoice = useCallback(async (invoice: Invoice) => {
    if (confirm(`Удалить счет № ${invoice.number}?`)) {
      await deleteInvoice(invoice.id);
    }
  }, [deleteInvoice]);

  // Обработчики актов
  const handleCreateAct = useCallback(() => {
    setEditingAct(null);
    setIsActFormOpen(true);
  }, []);

  const handleEditAct = useCallback((act: Act) => {
    setEditingAct(act);
    setIsActFormOpen(true);
  }, []);

  const handlePreviewAct = useCallback((act: Act) => {
    setPreviewAct(act);
    setIsActPreviewOpen(true);
  }, []);

  const handleSaveAct = useCallback(async (data: Partial<Act>, items: Partial<any>[]) => {
    try {
      // Получаем текущего пользователя
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Ошибка: пользователь не авторизован');
        return;
      }
      
      // Добавляем user_id к данным
      const actData = { ...data, user_id: user.id };
      
      let result;
      if (editingAct) {
        result = await updateAct(editingAct.id, actData, items);
      } else {
        result = await createAct(actData, items);
      }
      
      if (result?.error) {
        console.error('Error saving act:', result.error);
        alert('Ошибка при сохранении акта: ' + result.error);
        return;
      }
      
      setIsActFormOpen(false);
      setEditingAct(null);
    } catch (err) {
      console.error('Exception saving act:', err);
      alert('Ошибка при сохранении акта');
    }
  }, [editingAct, createAct, updateAct]);

  const handleDeleteAct = useCallback(async (act: Act) => {
    if (confirm(`Удалить акт № ${act.number}?`)) {
      await deleteAct(act.id);
    }
  }, [deleteAct]);

  const contractStatus = CONTRACT_STATUS_COLORS[contract.status];

  return (
    <div className="space-y-4">
      {/* Шапка с кнопкой назад */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к списку
        </Button>
        <h1 className="text-xl font-semibold">Договор № {contract.number}</h1>
        <Badge className={`${contractStatus.bg} ${contractStatus.text} border-0`}>
          {CONTRACT_STATUS_LABELS[contract.status]}
        </Badge>
      </div>

      {/* Информация о договоре */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">Основная информация</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {CONTRACT_TYPE_LABELS[contract.type]} от {format(new Date(contract.date), 'dd.MM.yyyy')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onEditContract}>
              <Edit className="w-4 h-4 mr-2" />
              Редактировать
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Заказчик</div>
              <div className="font-medium">{contract.customer?.name || '-'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Мероприятие</div>
              <div className="font-medium">{contract.event_name || '-'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Период</div>
              <div className="font-medium">
                {contract.event_start_date 
                  ? `${format(new Date(contract.event_start_date), 'dd.MM.yyyy')} — ${contract.event_end_date ? format(new Date(contract.event_end_date), 'dd.MM.yyyy') : ''}`
                  : '-'
                }
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Сумма</div>
              <div className="font-medium">{contract.total_amount.toLocaleString('ru-RU')} ₽</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Вкладки со счетами и актами */}
      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="w-4 h-4" />
            Счета
            {invoices.length > 0 && (
              <Badge variant="secondary" className="ml-1">{invoices.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="acts" className="gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Акты
            {acts.length > 0 && (
              <Badge variant="secondary" className="ml-1">{acts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Вкладка Счета */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Счета на оплату</CardTitle>
              <Button onClick={handleCreateInvoice} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Новый счет
              </Button>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет счетов. Создайте первый счет.
                </div>
              ) : (
                <div className="space-y-2">
                  {invoices.map((invoice) => {
                    const status = INVOICE_STATUS_COLORS[invoice.status];
                    return (
                      <div 
                        key={invoice.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status.bg}`}>
                            <Receipt className={`w-5 h-5 ${status.text}`} />
                          </div>
                          <div>
                            <div className="font-medium">Счет № {invoice.number}</div>
                            <div className="text-sm text-muted-foreground">
                              от {format(new Date(invoice.date), 'dd.MM.yyyy')}
                              {invoice.due_date && ` • оплатить до ${format(new Date(invoice.due_date), 'dd.MM.yyyy')}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-medium">{invoice.total_amount.toLocaleString('ru-RU')} ₽</div>
                            <Badge className={`${status.bg} ${status.text} border-0 text-xs`}>
                              {INVOICE_STATUS_LABELS[invoice.status]}
                            </Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handlePreviewInvoice(invoice)}
                              title="Просмотр"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleEditInvoice(invoice)}
                              title="Редактировать"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDeleteInvoice(invoice)}
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка Акты */}
        <TabsContent value="acts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Акты выполненных работ</CardTitle>
              <Button onClick={handleCreateAct} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Новый акт
              </Button>
            </CardHeader>
            <CardContent>
              {actsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
              ) : acts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет актов. Создайте первый акт.
                </div>
              ) : (
                <div className="space-y-2">
                  {acts.map((act) => {
                    const status = ACT_STATUS_COLORS[act.status];
                    return (
                      <div 
                        key={act.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status.bg}`}>
                            <ClipboardCheck className={`w-5 h-5 ${status.text}`} />
                          </div>
                          <div>
                            <div className="font-medium">Акт № {act.number}</div>
                            <div className="text-sm text-muted-foreground">
                              от {format(new Date(act.date), 'dd.MM.yyyy')}
                              {act.period_start && act.period_end && (
                                ` • период: ${format(new Date(act.period_start), 'dd.MM.yyyy')} — ${format(new Date(act.period_end), 'dd.MM.yyyy')}`
                              )}
                            </div>
                            {act.invoice && (
                              <div className="text-xs text-muted-foreground">
                                к счету № {act.invoice.number}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-medium">{act.total_amount.toLocaleString('ru-RU')} ₽</div>
                            <Badge className={`${status.bg} ${status.text} border-0 text-xs`}>
                              {ACT_STATUS_LABELS[act.status]}
                            </Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handlePreviewAct(act)}
                              title="Просмотр"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleEditAct(act)}
                              title="Редактировать"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDeleteAct(act)}
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Диалог формы счета */}
      <Dialog open={isInvoiceFormOpen} onOpenChange={setIsInvoiceFormOpen}>
        <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingInvoice ? 'Редактирование счета' : 'Новый счет'}
            </DialogTitle>
          </DialogHeader>
          <InvoiceForm
            invoice={editingInvoice}
            contract={contract}
            onSave={handleSaveInvoice}
            onCancel={() => setIsInvoiceFormOpen(false)}
            getNextNumber={getNextInvoiceNumber}
          />
        </DialogContent>
      </Dialog>

      {/* Диалог формы акта */}
      <Dialog open={isActFormOpen} onOpenChange={setIsActFormOpen}>
        <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAct ? 'Редактирование акта' : 'Новый акт'}
            </DialogTitle>
          </DialogHeader>
          <ActForm
            act={editingAct}
            contract={contract}
            invoices={invoices}
            onSave={handleSaveAct}
            onCancel={() => setIsActFormOpen(false)}
            getNextNumber={getNextActNumber}
          />
        </DialogContent>
      </Dialog>

      {/* Диалог просмотра счета */}
      <Dialog open={isInvoicePreviewOpen} onOpenChange={setIsInvoicePreviewOpen}>
        <DialogContent className="max-w-[98vw] w-[1200px] max-h-[95vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Просмотр счета</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewInvoice && (
              <InvoicePreview
                invoice={previewInvoice}
                pdfSettings={pdfSettings}
                onClose={() => setIsInvoicePreviewOpen(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог просмотра акта */}
      <Dialog open={isActPreviewOpen} onOpenChange={setIsActPreviewOpen}>
        <DialogContent className="max-w-[98vw] w-[1200px] max-h-[95vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Просмотр акта</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewAct && (
              <ActPreview
                act={previewAct}
                pdfSettings={pdfSettings}
                onClose={() => setIsActPreviewOpen(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
