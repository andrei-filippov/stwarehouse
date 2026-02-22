import { useState, useCallback, memo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Plus, Edit, Trash2, Layout, Copy, FileSpreadsheet } from 'lucide-react';
import type { Estimate, PDFSettings, Template, EstimateItem } from '../types';
import { EstimateBuilder } from './EstimateBuilder';
import { EstimateImportDialog } from './EstimateImportDialog';

interface EstimateManagerProps {
  estimates: Estimate[];
  equipment: any[];
  templates: Template[];
  customers: any[];
  pdfSettings: PDFSettings;
  onCreate: (estimate: any, items: any[]) => Promise<{ error: any; data?: any }>;
  onUpdate: (id: string, estimate: any, items: any[]) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
}

export const EstimateManager = memo(function EstimateManager({
  estimates,
  equipment,
  templates,
  customers,
  pdfSettings,
  onCreate,
  onUpdate,
  onDelete
}: EstimateManagerProps) {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const handleEdit = useCallback((estimate: Estimate) => {
    setEditingEstimate(estimate);
    setSelectedTemplate(null);
    setIsBuilderOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsBuilderOpen(false);
    setEditingEstimate(null);
    setSelectedTemplate(null);
  }, []);

  const handleCreateFromTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template);
    setEditingEstimate(null);
    setIsBuilderOpen(true);
    setIsTemplateDialogOpen(false);
  }, []);

  const handleImportFromExcel = useCallback((estimateData: { event_name: string; venue: string; event_date: string }, items: EstimateItem[]) => {
    setSelectedTemplate(null);
    setEditingEstimate({
      id: 'new',
      event_name: estimateData.event_name,
      venue: estimateData.venue,
      event_date: estimateData.event_date,
      total: items.reduce((sum, item) => sum + (item.price * item.quantity * item.coefficient), 0),
      items: items
    } as Estimate);
    setIsImportDialogOpen(false);
    setIsBuilderOpen(true);
  }, []);

  const handleCreateNew = useCallback(() => {
    setSelectedTemplate(null);
    setEditingEstimate(null);
    setIsBuilderOpen(true);
  }, []);

  const handleSave = useCallback(async (estimateData: any, items: any[]) => {
    if (editingEstimate && editingEstimate.id !== 'new') {
      await onUpdate(editingEstimate.id, estimateData, items);
    } else {
      await onCreate(estimateData, items);
    }
    handleClose();
  }, [editingEstimate, onUpdate, onCreate, handleClose]);

  if (isBuilderOpen) {
    return (
      <EstimateBuilder
        equipment={equipment}
        estimates={estimates}
        templates={templates}
        customers={customers}
        estimate={editingEstimate}
        selectedTemplate={selectedTemplate}
        pdfSettings={pdfSettings}
        onSave={handleSave}
        onClose={handleClose}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Сметы</CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsImportDialogOpen(true)}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Из Excel
              </Button>
              {templates.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={() => setIsTemplateDialogOpen(true)}
                >
                  <Layout className="w-4 h-4 mr-2" />
                  Из шаблона
                </Button>
              )}
              <Button onClick={handleCreateNew}>
                <Plus className="w-4 h-4 mr-2" />
                Новая смета
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Мероприятие</TableHead>
                <TableHead>Заказчик</TableHead>
                <TableHead>Площадка</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Позиций</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimates.map((estimate) => (
                <TableRow key={estimate.id}>
                  <TableCell className="font-medium">{estimate.event_name}</TableCell>
                  <TableCell>{estimate.customer_name || '-'}</TableCell>
                  <TableCell>{estimate.venue || '-'}</TableCell>
                  <TableCell>{estimate.event_date}</TableCell>
                  <TableCell>{estimate.items?.length || 0}</TableCell>
                  <TableCell>{estimate.total.toLocaleString('ru-RU')} ₽</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEdit(estimate)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onDelete(estimate.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Диалог выбора шаблона */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-md" aria-describedby="template-dialog-desc">
          <DialogHeader>
            <DialogTitle>Выберите шаблон</DialogTitle>
            <DialogDescription id="template-dialog-desc">
              Выберите шаблон для создания новой сметы
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {templates.map((template) => (
              <Button
                key={template.id}
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => handleCreateFromTemplate(template)}
              >
                <div className="text-left">
                  <div className="font-medium">{template.name}</div>
                  <div className="text-xs text-gray-500">
                    {template.description || `${template.items?.length || 0} позиций`}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог импорта из Excel */}
      <EstimateImportDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImport={handleImportFromExcel}
      />
    </div>
  );
});