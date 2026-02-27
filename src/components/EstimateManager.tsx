import { useState, useCallback, memo, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Plus, Edit, Trash2, Layout, Copy, FileSpreadsheet, Users, Loader2, Lock } from 'lucide-react';
import type { Estimate, PDFSettings, Template, EstimateItem } from '../types';
import { EstimateBuilder } from './EstimateBuilder';
import { EstimateImportDialog } from './EstimateImportDialog';

interface EstimateManagerProps {
  estimates: Estimate[];
  equipment: any[];
  templates: Template[];
  customers: any[];
  pdfSettings: PDFSettings;
  equipmentCategories?: string[];
  onCreate: (estimate: any, items: any[], categoryOrder?: string[]) => Promise<{ error: any; data?: any }>;
  onUpdate: (id: string, estimate: any, items: any[], categoryOrder?: string[]) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
  onCreateEquipment?: (equipment: any) => Promise<{ error: any; data?: any }>;
  onStartEditing?: (estimateId: string) => Promise<{ error: any }>;
  onStopEditing?: (estimateId?: string) => Promise<{ error: any }>;
  currentUserId?: string;
  fabAction?: number;
}

export const EstimateManager = memo(function EstimateManager({
  estimates,
  equipment,
  templates,
  customers,
  pdfSettings,
  equipmentCategories,
  onCreate,
  onUpdate,
  onDelete,
  onCreateEquipment,
  onStartEditing,
  onStopEditing,
  currentUserId,
  fabAction,
}: EstimateManagerProps) {
  // Открываем создание сметы при нажатии FAB (пропускаем первый рендер)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (fabAction && fabAction > 0) {
      handleCreateNew();
    }
  }, [fabAction]);
  // Защита от undefined
  const categoriesList = equipmentCategories || [];
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const handleEdit = useCallback(async (estimate: Estimate) => {
    // Устанавливаем статус редактирования
    if (onStartEditing && estimate.id !== 'new') {
      await onStartEditing(estimate.id);
    }
    setEditingEstimate(estimate);
    setSelectedTemplate(null);
    setIsBuilderOpen(true);
  }, [onStartEditing]);

  const handleClose = useCallback(async () => {
    // Снимаем статус редактирования
    if (onStopEditing && editingEstimate && editingEstimate.id !== 'new') {
      await onStopEditing(editingEstimate.id);
    }
    setIsBuilderOpen(false);
    setEditingEstimate(null);
    setSelectedTemplate(null);
  }, [onStopEditing, editingEstimate]);

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
      total: (items || []).reduce((sum, item) => sum + (item.price * item.quantity * item.coefficient), 0),
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

  const handleSave = useCallback(async (estimateData: any, items: any[], categoryOrder?: string[]) => {
    if (editingEstimate && editingEstimate.id !== 'new') {
      await onUpdate(editingEstimate.id, estimateData, items, categoryOrder);
    } else {
      const result = await onCreate(estimateData, items, categoryOrder);
      // После создания новой сметы, обновляем editingEstimate чтобы можно было продолжить редактирование
      if (result.data) {
        setEditingEstimate({ ...result.data, items } as Estimate);
      }
    }
    // Не закрываем конструктор после сохранения
  }, [editingEstimate, onUpdate, onCreate]);

  if (isBuilderOpen) {
    // Защита: не рендерим Builder пока данные не загружены
    if (!equipment || !estimates) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка данных...</p>
          </div>
        </div>
      );
    }
    
    return (
      <EstimateBuilder
        equipment={equipment}
        estimates={estimates}
        templates={templates}
        customers={customers}
        estimate={editingEstimate}
        selectedTemplate={selectedTemplate}
        pdfSettings={pdfSettings}
        equipmentCategories={categoriesList}
        onSave={handleSave}
        onClose={handleClose}
        onCreateEquipment={onCreateEquipment}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center gap-2">
            <CardTitle className="text-lg md:text-xl">Сметы</CardTitle>
            
            {/* Desktop buttons */}
            <div className="hidden md:flex gap-2">
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
            
            {/* Mobile buttons - compact */}
            <div className="flex md:hidden gap-1">
              <Button 
                variant="outline" 
                size="sm"
                className="px-2"
                onClick={() => setIsImportDialogOpen(true)}
                title="Из Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </Button>

              {templates.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="px-2"
                  onClick={() => setIsTemplateDialogOpen(true)}
                  title="Из шаблона"
                >
                  <Layout className="w-4 h-4" />
                </Button>
              )}
              <Button 
                size="sm"
                onClick={handleCreateNew}
                className="px-2"
              >
                <Plus className="w-4 h-4" />
                <span className="ml-1">Новая</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Мероприятие</TableHead>
                  <TableHead>Заказчик</TableHead>
                  <TableHead>Площадка</TableHead>
                  <TableHead>Период</TableHead>
                  <TableHead>Позиций</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(estimates || []).map((estimate) => (
                  <TableRow key={estimate.id} className={estimate.is_editing ? 'bg-blue-50' : ''}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {estimate.event_name}
                        {estimate.is_editing && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {estimate.editor_name || 'редактируется'}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{estimate.customer_name || '-'}</TableCell>
                    <TableCell>{estimate.venue || '-'}</TableCell>
                    <TableCell>
                      {new Date(estimate.event_start_date || estimate.event_date).toLocaleDateString('ru-RU')}
                      {(estimate.event_end_date || estimate.event_date) !== (estimate.event_start_date || estimate.event_date) && 
                        ` — ${new Date(estimate.event_end_date || estimate.event_date).toLocaleDateString('ru-RU')}`}
                    </TableCell>
                    <TableCell>{estimate.items?.length || 0}</TableCell>
                    <TableCell>{estimate.total.toLocaleString('ru-RU')} ₽</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEdit(estimate)}
                          disabled={estimate.is_editing && estimate.editing_by !== currentUserId}
                          title={estimate.is_editing ? `Редактирует: ${estimate.editor_name || 'другой пользователь'}` : 'Редактировать'}
                        >
                          {estimate.is_editing ? (
                            <Lock className="w-4 h-4 text-orange-500" />
                          ) : (
                            <Edit className="w-4 h-4" />
                          )}
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
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {(estimates || []).map((estimate) => {
              const isMultiDay = (estimate.event_end_date || estimate.event_date) !== (estimate.event_start_date || estimate.event_date);
              return (
                <Card 
                  key={estimate.id} 
                  className={`overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${estimate.is_editing ? 'border-blue-300 bg-blue-50/50' : ''}`}
                  onClick={() => handleEdit(estimate)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate">
                          {estimate.event_name}
                          {estimate.is_editing && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                              <Loader2 className="w-3 h-3 animate-spin" />
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">{estimate.venue || 'Без площадки'}</p>
                        {estimate.is_editing && (
                          <p className="text-xs text-blue-600 mt-1">
                            Редактирует: {estimate.editor_name || 'другой пользователь'}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={estimate.is_editing && estimate.editing_by !== currentUserId}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(estimate);
                          }}
                        >
                          {estimate.is_editing ? (
                            <Lock className="w-4 h-4 text-orange-500" />
                          ) : (
                            <Edit className="w-4 h-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(estimate.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-gray-600">
                        📅 {new Date(estimate.event_start_date || estimate.event_date).toLocaleDateString('ru-RU')}
                      </span>
                      {isMultiDay && (
                        <span className="text-xs text-gray-500">
                          — {new Date(estimate.event_end_date || estimate.event_date).toLocaleDateString('ru-RU')}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {estimate.customer_name && (
                          <span className="text-sm text-gray-600 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {estimate.customer_name}
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          {estimate.items?.length || 0} поз.
                        </span>
                      </div>
                      <span className="font-bold text-lg text-blue-600">
                        {estimate.total.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
            {(templates || []).map((template) => (
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