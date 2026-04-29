import { useState, useCallback, memo, useEffect, useRef, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Plus, Edit, Trash2, Layout, Copy, FileSpreadsheet, Users, Loader2, Lock, CheckCircle2, Clock, XCircle, FileText, Search, ChevronDown, ChevronRight, CalendarDays } from 'lucide-react';
import type { Estimate, PDFSettings, Template, EstimateItem, EstimateStatus } from '../types';
import { EstimateBuilder } from './EstimateBuilder';
import { EstimateImportDialog } from './EstimateImportDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface EstimateManagerProps {
  estimates: Estimate[];
  equipment: any[];
  templates: Template[];
  customers: any[];
  pdfSettings: PDFSettings;
  company?: { name?: string; inn?: string; kpp?: string; ogrn?: string; legal_address?: string } | null;
  equipmentCategories?: string[];
  repairs?: any[];
  cableCategories?: any[];
  onCreate: (estimate: any, items: any[], categoryOrder?: string[]) => Promise<{ error: any; data?: any }>;
  onUpdate: (id: string, estimate: any, items: any[], categoryOrder?: string[]) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
  onUpdateStatus?: (id: string, status: EstimateStatus) => Promise<{ error: any }>;
  onCreateEquipment?: (equipment: any) => Promise<{ error: any; data?: any }>;
  onStartEditing?: (estimateId: string) => Promise<{ error: any }>;
  onStopEditing?: (estimateId?: string) => Promise<{ error: any }>;
  fetchEstimateItems?: (estimateId: string) => Promise<{ error: any; items: EstimateItem[] }>;
  currentUserId?: string;
  fabAction?: number;
}

export const EstimateManager = memo(function EstimateManager({
  estimates,
  equipment,
  templates,
  customers,
  pdfSettings,
  company,
  equipmentCategories,
  repairs,
  cableCategories,
  onCreate,
  onUpdate,
  onDelete,
  onUpdateStatus,
  onCreateEquipment,
  onStartEditing,
  onStopEditing,
  fetchEstimateItems,
  currentUserId,
  fabAction,
}: EstimateManagerProps) {
  // Helper для отображения статуса
  const getStatusBadge = (status?: EstimateStatus) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 whitespace-nowrap"><CheckCircle2 className="w-3 h-3 mr-1 shrink-0" /> Выполнена</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 whitespace-nowrap"><CheckCircle2 className="w-3 h-3 mr-1 shrink-0" /> Согласована</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 whitespace-nowrap"><Clock className="w-3 h-3 mr-1 shrink-0" /> В работе</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 whitespace-nowrap"><XCircle className="w-3 h-3 mr-1 shrink-0" /> Отменена</Badge>;
      default:
        return <Badge variant="outline" className="whitespace-nowrap"><FileText className="w-3 h-3 mr-1 shrink-0" /> Черновик</Badge>;
    }
  };
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
  
  // Синхронизируем editingEstimate с актуальными данными из estimates
  // Только когда конструктор закрыт, чтобы не перезаписывать несохранённые изменения
  useEffect(() => {
    if (!isBuilderOpen && editingEstimate && editingEstimate.id && !editingEstimate.id.startsWith('local_')) {
      const freshEstimate = estimates.find(e => e.id === editingEstimate.id);
      if (freshEstimate) {
        setEditingEstimate(freshEstimate);
      }
    }
  }, [estimates, isBuilderOpen, editingEstimate?.id]);
  
  // Поиск и группировка
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  
  // Фильтрация смет по поиску
  const filteredEstimates = useMemo(() => {
    if (!searchQuery.trim()) return estimates;
    const query = searchQuery.toLowerCase();
    return estimates.filter(e => 
      e.event_name?.toLowerCase().includes(query) ||
      e.customer_name?.toLowerCase().includes(query) ||
      e.venue?.toLowerCase().includes(query) ||
      e.total?.toString().includes(query)
    );
  }, [estimates, searchQuery]);
  
  // Группировка по месяцам
  const groupedEstimates = useMemo(() => {
    const groups: Record<string, Estimate[]> = {};
    filteredEstimates.forEach(estimate => {
      const date = estimate.event_date || estimate.created_at;
      if (date) {
        const monthKey = format(parseISO(date), 'yyyy-MM', { locale: ru });
        const monthLabel = format(parseISO(date), 'MMMM yyyy', { locale: ru });
        if (!groups[monthLabel]) groups[monthLabel] = [];
        groups[monthLabel].push(estimate);
      } else {
        if (!groups['Без даты']) groups['Без даты'] = [];
        groups['Без даты'].push(estimate);
      }
    });
    
    // Сортируем сметы внутри каждого месяца по дате (от дальней к ближайшей)
    Object.values(groups).forEach(monthEstimates => {
      monthEstimates.sort((a, b) => {
        const dateA = parseISO(a.event_date || a.created_at || '');
        const dateB = parseISO(b.event_date || b.created_at || '');
        return dateB.getTime() - dateA.getTime(); // По убыванию (новые сверху)
      });
    });
    
    // Сортируем месяцы по убыванию (новые сверху)
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === 'Без даты') return 1;
      if (b[0] === 'Без даты') return -1;
      // Преобразуем обратно в дату для сравнения
      const dateA = parseISO(filteredEstimates.find(e => format(parseISO(e.event_date || e.created_at!), 'MMMM yyyy', { locale: ru }) === a[0])?.event_date || '');
      const dateB = parseISO(filteredEstimates.find(e => format(parseISO(e.event_date || e.created_at!), 'MMMM yyyy', { locale: ru }) === b[0])?.event_date || '');
      return dateB.getTime() - dateA.getTime();
    });
  }, [filteredEstimates]);
  
  // При первой загрузке разворачиваем только текущий месяц
  useEffect(() => {
    if (groupedEstimates.length > 0 && expandedMonths.size === 0) {
      const currentMonth = format(new Date(), 'MMMM yyyy', { locale: ru });
      // Если текущий месяц есть в списке, разворачиваем только его
      // Иначе разворачиваем первый (самый новый) месяц
      const monthToExpand = groupedEstimates.find(([month]) => month === currentMonth)?.[0] || groupedEstimates[0]?.[0];
      if (monthToExpand) {
        setExpandedMonths(new Set([monthToExpand]));
      }
    }
  }, [groupedEstimates]);

  const handleEdit = useCallback(async (estimate: Estimate) => {
    console.log('[EstimateManager] handleEdit called:', estimate.id, estimate.event_name, 'items:', estimate.items?.length, 'sections:', estimate.sections?.length);
    
    // Загружаем items напрямую из Supabase, чтобы быть уверенными что все items на месте
    let estimateWithItems = estimate;
    if (fetchEstimateItems && estimate.id !== 'new') {
      const { error, items } = await fetchEstimateItems(estimate.id);
      if (!error && items.length > 0) {
        console.log('[EstimateManager] Loaded fresh items:', items.length, 'for estimate:', estimate.id);
        estimateWithItems = { ...estimate, items };
      } else if (error) {
        console.error('[EstimateManager] Failed to load fresh items:', error);
      }
    }
    
    // Устанавливаем статус редактирования
    if (onStartEditing && estimate.id !== 'new') {
      await onStartEditing(estimate.id);
    }
    setEditingEstimate(estimateWithItems);
    setSelectedTemplate(null);
    setIsBuilderOpen(true);
  }, [onStartEditing, fetchEstimateItems]);

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
      total: (items || []).reduce((sum, item) => sum + (item.price * item.quantity * (item.coefficient || 1)), 0),
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
    console.log('[EstimateManager] handleSave called:', editingEstimate?.id, 'items count:', items.length);
    if (editingEstimate && editingEstimate.id !== 'new') {
      await onUpdate(editingEstimate.id, estimateData, items, categoryOrder);
      // Обновляем editingEstimate актуальными данными чтобы избежать рассинхронизации
      setEditingEstimate(prev => prev ? { ...prev, ...estimateData, items, category_order: categoryOrder } as Estimate : prev);
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Загрузка данных...</p>
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
        company={company}
        equipmentCategories={categoriesList}
        repairs={repairs}
        cableCategories={cableCategories}
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
        
        {/* Поиск */}
        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
            <Input
              placeholder="Поиск по названию, заказчику, площадке..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setSearchQuery('')}
              >
                ×
              </Button>
            )}
          </div>
          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-1">
              Найдено: {filteredEstimates.length} из {estimates.length}
            </p>
          )}
        </div>
        
        <CardContent>
          {/* Desktop Table с группировкой */}
          <div className="hidden md:block space-y-4">
            {groupedEstimates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'Ничего не найдено' : 'Нет смет'}
              </div>
            ) : (
              groupedEstimates.map(([month, monthEstimates]) => (
                <div key={month} className="border rounded-lg overflow-hidden">
                  {/* Заголовок месяца */}
                  <button
                    onClick={() => {
                      const newExpanded = new Set(expandedMonths);
                      if (newExpanded.has(month)) {
                        newExpanded.delete(month);
                      } else {
                        newExpanded.add(month);
                      }
                      setExpandedMonths(newExpanded);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-5 h-5 text-muted-foreground" />
                      <span className="font-semibold text-foreground">{month}</span>
                      <Badge variant="secondary" className="ml-2">
                        {monthEstimates.length}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        {monthEstimates.reduce((sum, e) => sum + (e.total || 0), 0).toLocaleString('ru-RU')} ₽
                      </span>
                      {expandedMonths.has(month) ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground/70" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground/70" />
                      )}
                    </div>
                  </button>
                  
                  {/* Таблица смет */}
                  {expandedMonths.has(month) && (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[30%]">Мероприятие</TableHead>
                          <TableHead>Заказчик</TableHead>
                          <TableHead>Площадка</TableHead>
                          <TableHead>Период</TableHead>
                          <TableHead className="text-right">Сумма</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead className="w-[100px]">Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthEstimates.map((estimate) => (
                          <TableRow 
                            key={estimate.id} 
                            className={`cursor-pointer hover:bg-primary/10 transition-colors ${estimate.is_editing ? 'bg-primary/10' : ''}`}
                            onClick={() => handleEdit(estimate)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {estimate.event_name}
                                {estimate.is_editing && (
                                  <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
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
                            <TableCell className="text-right font-medium">{estimate.total.toLocaleString('ru-RU')} ₽</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {onUpdateStatus ? (
                                <Select 
                                  value={estimate.status || 'draft'} 
                                  onValueChange={(value) => onUpdateStatus(estimate.id, value as EstimateStatus)}
                                >
                                  <SelectTrigger className="w-[150px] h-8 shrink-0">
                                    <SelectValue>{getStatusBadge(estimate.status)}</SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="draft">Черновик</SelectItem>
                                    <SelectItem value="pending">В работе</SelectItem>
                                    <SelectItem value="approved">Согласована</SelectItem>
                                    <SelectItem value="completed">Выполнена</SelectItem>
                                    <SelectItem value="cancelled">Отменена</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                getStatusBadge(estimate.status)
                              )}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(estimate);
                                  }}
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
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Удалить смету "${estimate.event_name}"?`)) {
                                      onDelete(estimate.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Mobile Cards с группировкой */}
          <div className="md:hidden space-y-4">
            {groupedEstimates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'Ничего не найдено' : 'Нет смет'}
              </div>
            ) : (
              groupedEstimates.map(([month, monthEstimates]) => (
                <div key={month} className="border rounded-lg overflow-hidden">
                  {/* Заголовок месяца */}
                  <button
                    onClick={() => {
                      const newExpanded = new Set(expandedMonths);
                      if (newExpanded.has(month)) {
                        newExpanded.delete(month);
                      } else {
                        newExpanded.add(month);
                      }
                      setExpandedMonths(newExpanded);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-muted"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold text-sm text-foreground">{month}</span>
                      <Badge variant="secondary" className="text-xs">
                        {monthEstimates.length}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {monthEstimates.reduce((sum, e) => sum + (e.total || 0), 0).toLocaleString('ru-RU')} ₽
                      </span>
                      {expandedMonths.has(month) ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground/70" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground/70" />
                      )}
                    </div>
                  </button>
                  
                  {/* Карточки смет */}
                  {expandedMonths.has(month) && (
                    <div className="divide-y">
                      {monthEstimates.map((estimate) => {
                        const isMultiDay = (estimate.event_end_date || estimate.event_date) !== (estimate.event_start_date || estimate.event_date);
                        return (
                          <Card 
                            key={estimate.id} 
                            className={`rounded-none border-0 shadow-none cursor-pointer hover:bg-muted ${estimate.is_editing ? 'bg-primary/10' : ''}`}
                            onClick={() => handleEdit(estimate)}
                          >
                            <CardContent className="p-3">
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-sm break-words leading-tight">
                                    {estimate.event_name}
                                    {estimate.is_editing && (
                                      <span className="ml-1 inline-flex items-center text-[10px] text-primary bg-primary/10 px-1 rounded">
                                        <Loader2 className="w-2 h-2 animate-spin mr-0.5" />
                                        редакт.
                                      </span>
                                    )}
                                  </h3>
                                  <p className="text-xs text-muted-foreground truncate">{estimate.venue || 'Без площадки'}</p>
                                </div>
                                <div className="flex gap-0.5 shrink-0">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={estimate.is_editing && estimate.editing_by !== currentUserId}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(estimate);
                                    }}
                                  >
                                    {estimate.is_editing ? <Lock className="w-3.5 h-3.5 text-orange-500" /> : <Edit className="w-3.5 h-3.5" />}
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm(`Удалить смету "${estimate.event_name}"?`)) {
                                        onDelete(estimate.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <span>
                                  {new Date(estimate.event_start_date || estimate.event_date).toLocaleDateString('ru-RU')}
                                  {isMultiDay && ` — ${new Date(estimate.event_end_date || estimate.event_date).toLocaleDateString('ru-RU')}`}
                                </span>
                              </div>
                              
                              {onUpdateStatus && (
                                <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                                  <Select 
                                    value={estimate.status || 'draft'} 
                                    onValueChange={(value) => onUpdateStatus(estimate.id, value as EstimateStatus)}
                                  >
                                    <SelectTrigger className="w-full h-7 text-xs min-w-[120px]">
                                      <SelectValue>{getStatusBadge(estimate.status)}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="draft">Черновик</SelectItem>
                                      <SelectItem value="pending">В работе</SelectItem>
                                      <SelectItem value="approved">Согласована</SelectItem>
                                      <SelectItem value="completed">Выполнена</SelectItem>
                                      <SelectItem value="cancelled">Отменена</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              
                              <div className="flex items-end justify-between mt-1.5 pt-1.5 border-t border-border">
                                <span className="text-xs text-muted-foreground truncate">{estimate.customer_name || '-'}</span>
                                <span className="font-bold text-sm text-primary">{estimate.total.toLocaleString('ru-RU')} ₽</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Диалог выбора шаблона */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6" aria-describedby="template-dialog-desc">
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
                  <div className="text-xs text-muted-foreground">
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
export default EstimateManager;

