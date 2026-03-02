import { useState, useCallback, memo, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  Plus, 
  Edit, 
  Trash2, 
  FileText, 
  Eye,
  Printer,
  Download,
  FileSignature,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import type { Contract, PDFSettings, ContractType, ContractStatus } from '../types';
import { CONTRACT_TYPE_LABELS, CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS } from '../types';
import { ContractForm } from './ContractForm';
import { ContractPreview } from './ContractPreview';

interface ContractManagerProps {
  contracts: Contract[];
  templates: Contract[];
  customers: any[];
  estimates: any[];
  pdfSettings: PDFSettings;
  onCreate: (contract: any, estimateIds: string[]) => Promise<{ error: any; data?: any }>;
  onUpdate: (id: string, contract: any, estimateIds: string[]) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
  getNextNumber: (type: ContractType, year: number) => Promise<string>;
  fabAction?: number;
}

const statusIcons: Record<ContractStatus, React.ReactNode> = {
  draft: <AlertCircle className="w-4 h-4" />,
  signed: <FileSignature className="w-4 h-4" />,
  in_progress: <Clock className="w-4 h-4" />,
  completed: <CheckCircle className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
};

export const ContractManager = memo(function ContractManager({
  contracts,
  templates,
  customers,
  estimates,
  pdfSettings,
  onCreate,
  onUpdate,
  onDelete,
  getNextNumber,
  fabAction,
}: ContractManagerProps) {
  const isFirstRender = useRef(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [previewContract, setPreviewContract] = useState<Contract | null>(null);

  // Открытие формы при нажатии FAB
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (fabAction && fabAction > 0) {
      handleCreateNew();
    }
  }, [fabAction]);

  const handleCreateNew = useCallback(() => {
    setEditingContract(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((contract: Contract) => {
    setEditingContract(contract);
    setIsFormOpen(true);
  }, []);

  const handlePreview = useCallback((contract: Contract) => {
    setPreviewContract(contract);
    setIsPreviewOpen(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingContract(null);
  }, []);

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setPreviewContract(null);
  }, []);

  const handleSave = useCallback(async (contractData: any, estimateIds: string[]) => {
    if (editingContract) {
      await onUpdate(editingContract.id, contractData, estimateIds);
    } else {
      await onCreate(contractData, estimateIds);
    }
    setIsFormOpen(false);
    setEditingContract(null);
  }, [editingContract, onCreate, onUpdate]);

  const handleDelete = useCallback(async (contract: Contract) => {
    if (confirm(`Удалить договор № ${contract.number}?`)) {
      await onDelete(contract.id);
    }
  }, [onDelete]);

  // Форматирование периода мероприятия
  const formatEventPeriod = (contract: Contract) => {
    const start = contract.event_start_date || contract.estimates?.[0]?.estimate?.event_date;
    const end = contract.event_end_date;
    
    if (!start) return '-';
    if (!end || start === end) {
      return new Date(start).toLocaleDateString('ru-RU');
    }
    return `${new Date(start).toLocaleDateString('ru-RU')} — ${new Date(end).toLocaleDateString('ru-RU')}`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center gap-2">
            <CardTitle className="text-lg md:text-xl">Договоры</CardTitle>
            <Button onClick={handleCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              Новый договор
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Номер / Дата</TableHead>
                  <TableHead>Заказчик</TableHead>
                  <TableHead>Мероприятие</TableHead>
                  <TableHead>Период</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      Нет договоров. Создайте первый договор.
                    </TableCell>
                  </TableRow>
                ) : (
                  contracts.map((contract) => {
                    const statusColors = CONTRACT_STATUS_COLORS[contract.status];
                    return (
                      <TableRow key={contract.id}>
                        <TableCell>
                          <div className="font-medium">№ {contract.number}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(contract.date).toLocaleDateString('ru-RU')}
                          </div>
                          <div className="text-xs text-gray-400">
                            {CONTRACT_TYPE_LABELS[contract.type]}
                          </div>
                        </TableCell>
                        <TableCell>{contract.customer?.name || '-'}</TableCell>
                        <TableCell>
                          {contract.event_name || contract.estimates?.[0]?.estimate?.event_name || '-'}
                        </TableCell>
                        <TableCell>{formatEventPeriod(contract)}</TableCell>
                        <TableCell className="font-medium">
                          {contract.total_amount.toLocaleString('ru-RU')} ₽
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusColors.bg} ${statusColors.text}`}>
                            {statusIcons[contract.status]}
                            {CONTRACT_STATUS_LABELS[contract.status]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handlePreview(contract)}
                              title="Просмотр и печать"
                            >
                              <Eye className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEdit(contract)}
                              title="Редактировать"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDelete(contract)}
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {contracts.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Нет договоров. Создайте первый договор.
              </div>
            ) : (
              contracts.map((contract) => {
                const statusColors = CONTRACT_STATUS_COLORS[contract.status];
                return (
                  <Card 
                    key={contract.id} 
                    className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleEdit(contract)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium">№ {contract.number}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(contract.date).toLocaleDateString('ru-RU')}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusColors.bg} ${statusColors.text}`}>
                          {statusIcons[contract.status]}
                          {CONTRACT_STATUS_LABELS[contract.status]}
                        </span>
                      </div>
                      
                      <div className="text-sm mb-2">
                        <span className="text-gray-500">Заказчик:</span>{' '}
                        {contract.customer?.name || '-'}
                      </div>
                      
                      <div className="text-sm mb-2">
                        <span className="text-gray-500">Мероприятие:</span>{' '}
                        {contract.event_name || contract.estimates?.[0]?.estimate?.event_name || '-'}
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-500">
                          {formatEventPeriod(contract)}
                        </div>
                        <div className="font-bold">
                          {contract.total_amount.toLocaleString('ru-RU')} ₽
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog for Contract Form */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContract ? 'Редактирование договора' : 'Новый договор'}
            </DialogTitle>
          </DialogHeader>
          <ContractForm
            contract={editingContract}
            templates={templates}
            customers={customers}
            estimates={estimates}
            pdfSettings={pdfSettings}
            getNextNumber={getNextNumber}
            onSave={handleSave}
            onCancel={handleCloseForm}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog for Contract Preview */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Просмотр договора</DialogTitle>
          </DialogHeader>
          {previewContract && (
            <ContractPreview
              contract={previewContract}
              pdfSettings={pdfSettings}
              onClose={handleClosePreview}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});
