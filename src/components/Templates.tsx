import { useState, useEffect, useCallback, memo, useRef, ChangeEvent, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Trash2, Edit, Copy, FileText, Upload, Download, FileCode, Search } from 'lucide-react';
import type { Template, TemplateItem, ContractTemplate, ContractType } from '../types';
import { CONTRACT_TYPE_LABELS } from '../types';
import { useContractTemplates } from '../hooks/useContractTemplates';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';

// ============================================
// Types
// ============================================
interface TemplatesManagerProps {
  templates: Template[];
  categories: { id: string; name: string }[];
  equipment: { id: string; name: string; category: string }[];
  onCreate: (template: any, items: any[]) => Promise<{ error: any; data?: any }>;
  onUpdate: (id: string, updates: any, items?: any[]) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
  userId?: string;
  companyId?: string;
  fabAction?: number;
}

// ============================================
// Main Component
// ============================================
export const TemplatesManager = memo(function TemplatesManager({
  templates,
  categories,
  equipment,
  onCreate,
  onUpdate,
  onDelete,
  userId,
  companyId,
  fabAction
}: TemplatesManagerProps) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="estimates" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="estimates">
            <FileText className="w-4 h-4 mr-2" />
            Шаблоны смет
          </TabsTrigger>
          <TabsTrigger value="contracts">
            <FileCode className="w-4 h-4 mr-2" />
            Шаблоны договоров
          </TabsTrigger>
        </TabsList>

        <TabsContent value="estimates" className="mt-4">
          <EstimateTemplates
            templates={templates}
            categories={categories}
            equipment={equipment}
            onCreate={onCreate}
            onUpdate={onUpdate}
            onDelete={onDelete}
            fabAction={fabAction}
          />
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          <ContractTemplates userId={userId} companyId={companyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
});

// ============================================
// Estimate Templates Component
// ============================================
interface EstimateTemplatesProps {
  templates: Template[];
  categories: { id: string; name: string }[];
  equipment: { id: string; name: string; category: string }[];
  onCreate: (template: any, items: any[]) => Promise<{ error: any; data?: any }>;
  onUpdate: (id: string, updates: any, items?: any[]) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
  fabAction?: number;
}

function EstimateTemplates({
  templates,
  categories,
  equipment,
  onCreate,
  onUpdate,
  onDelete,
  fabAction
}: EstimateTemplatesProps) {
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isFirstRender = useRef(false);

  useEffect(() => {
    if (!isFirstRender.current) {
      isFirstRender.current = true;
      return;
    }
    if (fabAction && fabAction > 0) {
      handleOpenNew();
    }
  }, [fabAction]);

  const handleOpenNew = useCallback(() => {
    setEditingTemplate(null);
    setIsDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((template: Template) => {
    setEditingTemplate(template);
    setIsDialogOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
  }, []);

  const handleSubmit = useCallback(async (data: any, items: any[]) => {
    if (editingTemplate) {
      await onUpdate(editingTemplate.id, data, items);
    } else {
      await onCreate(data, items);
    }
    handleClose();
  }, [editingTemplate, onUpdate, onCreate, handleClose]);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Шаблоны смет</CardTitle>
          <Button onClick={handleOpenNew}>
            <Plus className="w-4 h-4 mr-2" />
            Новый шаблон
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-2">Нет созданных шаблонов</p>
            <p className="text-sm">Создайте шаблон для быстрого заполнения смет</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Описание</TableHead>
                <TableHead>Позиций</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>{template.description || '-'}</TableCell>
                  <TableCell>{template.items?.length || 0}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleOpenEdit(template)}
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onDelete(template.id)}
                        title="Удалить"
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
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl w-[95%] max-h-[90vh] overflow-y-auto rounded-xl p-4 sm:p-6" aria-describedby="template-dialog-desc">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Редактировать шаблон' : 'Новый шаблон'}
            </DialogTitle>
            <DialogDescription id="template-dialog-desc">
              {editingTemplate ? 'Измените шаблон сметы' : 'Создайте шаблон для быстрого заполнения смет'}
            </DialogDescription>
          </DialogHeader>
          <TemplateForm
            categories={categories}
            equipment={equipment}
            template={editingTemplate}
            onSubmit={handleSubmit}
            onCancel={handleClose}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================
// Contract Templates Component
// ============================================
interface ContractTemplatesProps {
  userId?: string;
  companyId?: string;
}

function ContractTemplates({ userId, companyId }: ContractTemplatesProps) {
  const {
    templates,
    loading,
    uploadTemplateFile,
    createTextTemplate,
    updateTemplate,
    deleteTemplate,
    downloadFile,
  } = useContractTemplates(userId, companyId);
  
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isTextDialogOpen, setIsTextDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    type: 'service' as ContractType,
    description: '',
    isDefault: false,
  });

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Автоматически подставляем имя файла без расширения
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      setUploadForm(prev => ({ ...prev, name: fileName }));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Выберите файл');
      return;
    }
    if (!uploadForm.name) {
      toast.error('Введите название шаблона');
      return;
    }

    const { error } = await uploadTemplateFile(selectedFile, {
      name: uploadForm.name,
      type: uploadForm.type,
      description: uploadForm.description,
      is_default: uploadForm.isDefault,
      content: '',
    });

    if (!error) {
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadForm({ name: '', type: 'service', description: '', isDefault: false });
    }
  };

  const handleDelete = async (template: ContractTemplate) => {
    if (confirm('Вы уверены, что хотите удалить этот шаблон?')) {
      await deleteTemplate(template.id, template.file_path || undefined);
    }
  };
  
  const handleEdit = (template: ContractTemplate) => {
    setEditingTemplate(template);
    setIsTextDialogOpen(true);
  };
  
  const handleCloseDialog = () => {
    setIsTextDialogOpen(false);
    setEditingTemplate(null);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Шаблоны договоров</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setEditingTemplate(null); setIsTextDialogOpen(true); }}>
              <FileText className="w-4 h-4 mr-2" />
              Текстовый
            </Button>
            <Button onClick={() => setIsUploadDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Загрузить DOC/DOCX
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Загрузка...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-2">Нет шаблонов договоров</p>
            <p className="text-sm">Загрузите DOC/DOCX файл или создайте текстовый шаблон</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Формат</TableHead>
                <TableHead>Размер</TableHead>
                <TableHead>По умолчанию</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>{CONTRACT_TYPE_LABELS[template.type]}</TableCell>
                  <TableCell>
                    {template.is_file_template ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                        <FileCode className="w-3 h-3 mr-1" />
                        {template.file_name?.split('.').pop()?.toUpperCase()}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        <FileText className="w-3 h-3 mr-1" />
                        Текст
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{formatFileSize(template.file_size)}</TableCell>
                  <TableCell>
                    {template.is_default ? (
                      <span className="text-green-600 text-sm">✓ Да</span>
                    ) : (
                      <span className="text-gray-400 text-sm">Нет</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {template.is_file_template && template.file_path && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(template.file_path!, template.file_name!)}
                          title="Скачать"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      {!template.is_file_template && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(template)}
                          title="Редактировать"
                        >
                          <Edit className="w-4 h-4 text-blue-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(template)}
                        title="Удалить"
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
      </CardContent>

      {/* Диалог загрузки файла */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6" aria-describedby="upload-dialog-desc">
          <DialogHeader>
            <DialogTitle>Загрузить шаблон договора</DialogTitle>
            <DialogDescription id="upload-dialog-desc">
              Загрузите файл .doc или .docx для использования как шаблон
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-file">Файл шаблона *</Label>
              <Input
                id="template-file"
                type="file"
                accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileSelect}
              />
              {selectedFile && (
                <p className="text-sm text-gray-500">
                  Выбран: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-name">Название шаблона *</Label>
              <Input
                id="template-name"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                placeholder="Например: Договор аренды 2024"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-type">Тип договора</Label>
              <Select
                value={uploadForm.type}
                onValueChange={(value) => setUploadForm({ ...uploadForm, type: value as ContractType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Оказание услуг</SelectItem>
                  <SelectItem value="rent">Аренда оборудования</SelectItem>
                  <SelectItem value="supply">Поставка</SelectItem>
                  <SelectItem value="mixed">Смешанный</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-desc">Описание</Label>
              <Textarea
                id="template-desc"
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                placeholder="Краткое описание шаблона (необязательно)"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="template-default"
                checked={uploadForm.isDefault}
                onCheckedChange={(checked) => setUploadForm({ ...uploadForm, isDefault: checked })}
              />
              <Label htmlFor="template-default">Использовать по умолчанию для этого типа</Label>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleUpload} disabled={!selectedFile || !uploadForm.name}>
              <Upload className="w-4 h-4 mr-2" />
              Загрузить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог создания/редактирования текстового шаблона */}
      <Dialog open={isTextDialogOpen} onOpenChange={setIsTextDialogOpen}>
        <DialogContent className="max-w-3xl w-[95%] max-h-[90vh] overflow-y-auto rounded-xl p-4 sm:p-6" aria-describedby="text-template-desc">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Редактирование шаблона договора' : 'Текстовый шаблон договора'}
            </DialogTitle>
            <DialogDescription id="text-template-desc">
              {editingTemplate 
                ? 'Измените шаблон договора с использованием плейсхолдеров' 
                : 'Создайте шаблон договора с использованием плейсхолдеров'}
            </DialogDescription>
          </DialogHeader>
          <ContractTemplateForm
            companyId={companyId}
            editingTemplate={editingTemplate}
            onCancel={handleCloseDialog}
            onSave={async (data) => {
              const { error } = await createTextTemplate(data);
              if (!error) {
                handleCloseDialog();
              }
            }}
            onUpdate={async (id, data) => {
              const { error } = await updateTemplate(id, data);
              if (!error) {
                handleCloseDialog();
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================
// Contract Template Form (for text templates)
// ============================================
interface ContractTemplateFormProps {
  companyId?: string;
  editingTemplate?: ContractTemplate | null;
  onCancel: () => void;
  onSave: (data: any) => void;
  onUpdate?: (id: string, data: any) => void;
}

function ContractTemplateForm({ companyId, editingTemplate, onCancel, onSave, onUpdate }: ContractTemplateFormProps) {
  const defaultContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; max-width: 800px; margin: 0 auto; padding: 20px; text-align: justify; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .header { margin-bottom: 20px; }
    .date-line { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .section { margin: 15px 0; }
    .section-title { font-weight: bold; text-align: center; margin: 20px 0 10px 0; }
    .requisites-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .requisites-table td { width: 50%; vertical-align: top; padding: 15px; border: 1px solid #000; }
    table.spec { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }
    table.spec th, table.spec td { border: 1px solid #000; padding: 5px; text-align: left; }
    table.spec th { background-color: #f0f0f0; }
    .page-break { page-break-before: always; }
    p { margin: 8px 0; text-indent: 0; }
  </style>
</head>
<body>
  <div class="header center">
    <div class="bold" style="font-size: 14pt;">ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ № {{contract_number}}</div>
    <div class="date-line">
      <span>г. {{event_city}}</span>
      <span>{{contract_date}}</span>
    </div>
  </div>
  
  <p style="text-align: justify;">{{executor_type}} {{executor_name}}, именуемый в дальнейшем «Исполнитель», с одной стороны, и 
  {{customer_type}} {{customer_name}}, именуемый в дальнейшем «Заказчик», с другой стороны, 
  вместе именуемые «Стороны», заключили настоящий договор о нижеследующем:</p>

  <div class="section">
    <div class="section-title">1&nbsp;&nbsp;Предмет договора</div>
    <p>1.1&nbsp;&nbsp;По настоящему Договору Исполнитель обязуется по заданию Заказчика оказать ему Услуги по техническому обеспечению 
    {{event_name}}, с этой целью:</p>
    <p>- обеспечить звуковым оборудованием, в необходимой для проведения мероприятия комплектации;</p>
    <p>- произвести монтаж и демонтаж оборудования;</p>
    <p>- обеспечить работу технических специалистов для сопровождения мероприятия.</p>
    <p>1.2&nbsp;&nbsp;Заказчик обязуется принять и оплатить услуги согласно Приложению № 1 к настоящему Договору, 
    которое является неотъемлемой частью Договора.</p>
    <p>1.3&nbsp;&nbsp;Для оказания услуг Исполнитель вправе привлекать соисполнителей по своему выбору по согласованию с Заказчиком. 
    Использование работы соисполнителей не снимает ответственности с Исполнителя за качество оказываемых услуг.</p>
  </div>

  <div class="section">
    <div class="section-title">2&nbsp;&nbsp;Цена договора и порядок оплаты</div>
    <p>2.1&nbsp;&nbsp;Стоимость оказываемых услуг составляет {{total_amount}} ({{total_amount_text}}) рублей, НДС не облагается.</p>
    <p>2.2&nbsp;&nbsp;Заказчик осуществляет оплату в следующем порядке: {{payment_terms}}</p>
  </div>

  <div class="section">
    <div class="section-title">3&nbsp;&nbsp;Права и обязанности сторон</div>
    <p><b>Права и обязанности Исполнителя:</b></p>
    <p>3.1.1&nbsp;&nbsp;Исполнитель обязуется обеспечить услуги надлежащего качества.</p>
    <p>3.1.2&nbsp;&nbsp;Исполнитель вправе требовать оплаты за оказанные услуги.</p>
    <p><b>Права и обязанности Заказчика:</b></p>
    <p>3.2.1&nbsp;&nbsp;Заказчик обязан осуществить оплату услуг в соответствии с настоящим Договором.</p>
    <p>3.2.2&nbsp;&nbsp;Заказчик вправе получать от Исполнителя объяснения, связанные с оказанием услуг.</p>
  </div>

  <div class="section">
    <div class="section-title">4&nbsp;&nbsp;Срок оказания услуг</div>
    <p>4.1&nbsp;&nbsp;Срок оказания услуг {{event_date}}.</p>
    <p>4.2&nbsp;&nbsp;По окончании оказания услуги сторонами составляется акт приемки оказанных услуг, 
    в котором должно быть указано наименование оказанной услуги и ее стоимость.</p>
  </div>

  <div class="section">
    <div class="section-title">5&nbsp;&nbsp;Ответственность сторон</div>
    <p>5.1&nbsp;&nbsp;Стороны несут ответственность за нарушение условий настоящего Договора в соответствии с законодательством Российской Федерации.</p>
    <p>5.2&nbsp;&nbsp;Сторона, не исполнившая или ненадлежащим образом исполнившая свои обязательства по настоящему Договору, 
    обязана возместить другой стороне причиненные убытки.</p>
    <p>5.3&nbsp;&nbsp;В случае повреждения предоставляемого Исполнителем звукового оборудования сотрудниками Заказчика и (или) зрителями мероприятия, 
    Исполнитель вправе потребовать возмещения ущерба.</p>
  </div>

  <div class="section">
    <div class="section-title">6&nbsp;&nbsp;Порядок разрешения споров</div>
    <p>6.1&nbsp;&nbsp;Все споры или разногласия, возникающие между сторонами по настоящему Договору или в связи с ним, 
    разрешаются путем переговоров между сторонами.</p>
    <p>6.2&nbsp;&nbsp;В случае невозможности разрешения споров или разногласий путем переговоров они подлежат разрешению судом 
    в установленном законодательством порядке.</p>
  </div>

  <div class="section">
    <div class="section-title">7&nbsp;&nbsp;Срок действия договора</div>
    <p>7.1&nbsp;&nbsp;Настоящий договор вступает в силу с момента его подписания обеими Сторонами и действует до полного исполнения 
    сторонами обязательств по настоящему договору.</p>
  </div>

  <div class="section">
    <div class="section-title">8&nbsp;&nbsp;Порядок изменения и дополнения договора</div>
    <p>8.1&nbsp;&nbsp;Любые изменения и дополнения к настоящему Договору имеют силу только в том случае, 
    если они оформлены в письменном виде и подписаны обеими сторонами.</p>
  </div>

  <div class="section">
    <div class="section-title">9&nbsp;&nbsp;Прочие условия</div>
    <p>9.1&nbsp;&nbsp;Настоящий Договор составлен в двух экземплярах, имеющих одинаковую силу, по одному экземпляру для каждой из сторон.</p>
  </div>

  <div class="section">
    <div class="section-title">10&nbsp;&nbsp;Адреса, банковские реквизиты и подписи сторон</div>
    <table class="requisites-table">
      <tr>
        <td>
          <b>Исполнитель:</b><br><br>
          {{executor_type_short}} {{executor_name}}<br>
          ИНН: {{executor_inn}}<br>
          ОГРНИП: {{executor_ogrn}}<br>
          Адрес: {{executor_address}}<br><br>
          Расчётный счёт: {{executor_bank_account}}<br>
          Банк: {{executor_bank_name}}<br>
          БИК: {{executor_bank_bik}}<br>
          Корр.счёт: {{executor_bank_corr_account}}<br><br>
          ______________ {{executor_representative_short}}<br>
          М.П.
        </td>
        <td>
          <b>Заказчик:</b><br><br>
          {{customer_type_short}} {{customer_name}}<br>
          ИНН: {{customer_inn}}<br>
          ОГРНИП: {{customer_ogrn}}<br>
          Адрес: {{customer_address}}<br><br>
          Расчётный счёт: {{customer_bank_account}}<br>
          Банк: {{customer_bank_name}}<br>
          БИК: {{customer_bank_bik}}<br>
          Корр.счёт: {{customer_bank_corr_account}}<br><br>
          ______________ {{customer_representative_short}}<br>
          М.П.
        </td>
      </tr>
    </table>
  </div>

  <div class="page-break"></div>

  <div class="center" style="margin-bottom: 20px;">
    <div class="bold">Приложение № 1</div>
    <div>к Договору возмездного оказания услуг № {{contract_number}} от {{contract_date}}</div>
    <div class="bold" style="margin-top: 15px;">СПЕЦИФИКАЦИЯ</div>
    <div>на оказание услуг по предоставлению оборудования и персонала</div>
  </div>

  {{specification_table}}

  <div style="margin-top: 30px; text-align: right; font-weight: bold;">
    ИТОГО: {{total_amount}}
  </div>

  <div style="margin-top: 50px;">
    <table style="width: 100%;">
      <tr>
        <td style="width: 50%;">
          {{executor_type}}<br>
          {{executor_name}}<br>
          ___________________ {{executor_representative_short}}
        </td>
        <td style="width: 50%;">
          {{customer_type}}<br>
          {{customer_name}}<br>
          ___________________ {{customer_representative_short}}
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

  const [formData, setFormData] = useState({
    name: '',
    type: 'service' as ContractType,
    description: '',
    content: defaultContent,
    is_default: false,
  });

  // Заполняем форму при редактировании
  useEffect(() => {
    if (editingTemplate) {
      setFormData({
        name: editingTemplate.name,
        type: editingTemplate.type,
        description: editingTemplate.description || '',
        content: editingTemplate.content || defaultContent,
        is_default: editingTemplate.is_default,
      });
    } else {
      setFormData({
        name: '',
        type: 'service' as ContractType,
        description: '',
        content: defaultContent,
        is_default: false,
      });
    }
  }, [editingTemplate]);

  const placeholders = [
    { key: '{{contract_number}}', desc: 'Номер договора' },
    { key: '{{contract_date}}', desc: 'Дата договора' },
    { key: '{{contract_subject}}', desc: 'Предмет договора' },
    { key: '{{customer_name}}', desc: 'Наименование заказчика' },
    { key: '{{customer_type}}', desc: 'Тип заказчика (ИП/ООО)' },
    { key: '{{customer_type_short}}', desc: 'Тип коротко (ИП/ООО)' },
    { key: '{{customer_representative_short}}', desc: 'Представитель (Фамилия И.О.)' },
    { key: '{{customer_inn}}', desc: 'ИНН заказчика' },
    { key: '{{customer_kpp}}', desc: 'КПП заказчика' },
    { key: '{{customer_ogrn}}', desc: 'ОГРН/ОГРНИП заказчика' },
    { key: '{{customer_address}}', desc: 'Юр. адрес заказчика' },
    { key: '{{customer_representative}}', desc: 'Представитель заказчика' },
    { key: '{{customer_basis}}', desc: 'Основание (Устава/доверенность)' },
    { key: '{{customer_bank_name}}', desc: 'Банк заказчика' },
    { key: '{{customer_bank_bik}}', desc: 'БИК банка заказчика' },
    { key: '{{customer_bank_account}}', desc: 'Р/с заказчика' },
    { key: '{{customer_bank_corr_account}}', desc: 'К/с банка заказчика' },
    { key: '{{executor_type}}', desc: 'Тип исполнителя (ИП/ООО)' },
    { key: '{{executor_type_short}}', desc: 'Тип коротко (ИП/ООО)' },
    { key: '{{executor_name}}', desc: 'Наименование исполнителя' },
    { key: '{{executor_representative}}', desc: 'Представитель исполнителя' },
    { key: '{{executor_representative_short}}', desc: 'Представитель (Фамилия И.О.)' },
    { key: '{{executor_basis}}', desc: 'Основание исполнителя' },
    { key: '{{executor_inn}}', desc: 'ИНН исполнителя' },
    { key: '{{executor_kpp}}', desc: 'КПП исполнителя' },
    { key: '{{executor_ogrn}}', desc: 'ОГРН/ОГРНИП исполнителя' },
    { key: '{{executor_address}}', desc: 'Юр. адрес исполнителя' },
    { key: '{{executor_bank_name}}', desc: 'Банк исполнителя' },
    { key: '{{executor_bank_bik}}', desc: 'БИК банка исполнителя' },
    { key: '{{executor_bank_account}}', desc: 'Р/с исполнителя' },
    { key: '{{executor_bank_corr_account}}', desc: 'К/с банка исполнителя' },
    { key: '{{event_name}}', desc: 'Название мероприятия' },
    { key: '{{event_date}}', desc: 'Дата мероприятия' },
    { key: '{{event_venue}}', desc: 'Место проведения' },
    { key: '{{event_city}}', desc: 'Город проведения' },
    { key: '{{total_amount}}', desc: 'Сумма цифрами' },
    { key: '{{total_amount_text}}', desc: 'Сумма прописью' },
    { key: '{{payment_terms}}', desc: 'Условия оплаты' },
    { key: '{{specification_table}}', desc: 'Таблица спецификации' },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Название шаблона *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Например: Стандартный договор аренды"
        />
      </div>

      <div className="space-y-2">
        <Label>Тип договора</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData({ ...formData, type: value as ContractType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="service">Оказание услуг</SelectItem>
            <SelectItem value="rent">Аренда оборудования</SelectItem>
            <SelectItem value="supply">Поставка</SelectItem>
            <SelectItem value="mixed">Смешанный</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Описание</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Краткое описание"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="is-default"
          checked={formData.is_default}
          onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
        />
        <Label htmlFor="is-default">Использовать по умолчанию</Label>
      </div>

      <div className="space-y-2">
        <Label>HTML-шаблон (используйте плейсхолдеры)</Label>
        <Textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={15}
          className="font-mono text-xs"
        />
      </div>

      <div className="bg-muted p-3 rounded-lg">
        <h4 className="text-sm font-medium mb-2">Доступные плейсхолдеры:</h4>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {placeholders.map((p) => (
            <div key={p.key} className="flex items-center gap-2">
              <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">{p.key}</code>
              <span className="text-gray-600 dark:text-gray-400">{p.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <Button variant="outline" onClick={onCancel}>Отмена</Button>
        <Button 
          onClick={() => {
            if (editingTemplate && onUpdate) {
              onUpdate(editingTemplate.id, { ...formData, company_id: companyId });
            } else {
              onSave({ ...formData, company_id: companyId });
            }
          }} 
          disabled={!formData.name}
        >
          <Copy className="w-4 h-4 mr-2" />
          {editingTemplate ? 'Сохранить изменения' : 'Сохранить шаблон'}
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Estimate Template Form Component
// ============================================
interface TemplateFormProps {
  categories: { id: string; name: string }[];
  equipment: { id: string; name: string; category: string }[];
  template: Template | null;
  onSubmit: (data: any, items: any[]) => void;
  onCancel: () => void;
}

function TemplateForm({ categories, equipment, template, onSubmit, onCancel }: TemplateFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [newItem, setNewItem] = useState({
    category: '',
    equipment_id: '',
    equipment_name: '',
    default_quantity: 1
  });
  const [quantityInput, setQuantityInput] = useState('1');
  const [equipmentSearch, setEquipmentSearch] = useState('');

  // Фильтрация оборудования по поиску
  const filteredEquipment = useMemo(() => {
    if (!equipmentSearch.trim()) return equipment;
    const query = equipmentSearch.toLowerCase();
    return equipment.filter(eq => 
      eq.name.toLowerCase().includes(query) ||
      eq.category.toLowerCase().includes(query)
    );
  }, [equipment, equipmentSearch]);

  useEffect(() => {
    if (template) {
      setName(template.name || '');
      setDescription(template.description || '');
      setItems(template.items || []);
    } else {
      setName('');
      setDescription('');
      setItems([]);
    }
    setNewItem({ category: '', equipment_id: '', equipment_name: '', default_quantity: 1 });
    setQuantityInput('1');
  }, [template?.id]);

  const addItem = useCallback(() => {
    if (!newItem.equipment_name) return;
    const itemToAdd: TemplateItem = {
      id: crypto.randomUUID(),
      category: newItem.category,
      equipment_id: newItem.equipment_id || undefined,
      equipment_name: newItem.equipment_name,
      default_quantity: parseInt(quantityInput) || 1
    };
    setItems([...items, itemToAdd]);
    setNewItem({ category: '', equipment_id: '', equipment_name: '', default_quantity: 1 });
    setQuantityInput('1');
    setEquipmentSearch(''); // Сбрасываем поиск
  }, [newItem, quantityInput, items]);

  const removeItem = useCallback((index: number) => {
    setItems(items.filter((_, i) => i !== index));
  }, [items]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  }, [addItem]);

  const handleQuantityChange = useCallback((value: string) => {
    setQuantityInput(value);
    const num = parseInt(value);
    if (!isNaN(num) && num > 0) {
      setNewItem(prev => ({ ...prev, default_quantity: num }));
    }
  }, []);

  const handleEquipmentSelect = useCallback((equipmentId: string) => {
    const selected = equipment.find(e => e.id === equipmentId);
    if (selected) {
      setNewItem({
        category: selected.category,
        equipment_id: selected.id,
        equipment_name: selected.name,
        default_quantity: 1
      });
    } else {
      setNewItem({ category: '', equipment_id: '', equipment_name: '', default_quantity: 1 });
    }
  }, [equipment]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="template-name">Название шаблона *</Label>
          <Input 
            id="template-name"
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Например: Конференция, Концерт, Свадьба"
            required 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-desc">Описание</Label>
          <Input 
            id="template-desc"
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание шаблона (необязательно)"
          />
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-4 bg-muted">
        <h4 className="font-medium">Добавить оборудование в шаблон</h4>
        
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-5 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/70 w-4 h-4" />
              <Input
                placeholder="Поиск оборудования..."
                value={equipmentSearch}
                onChange={(e) => setEquipmentSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <select
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card text-foreground overflow-y-auto"
                value={newItem.equipment_id}
                onChange={(e) => handleEquipmentSelect(e.target.value)}
                style={{ maxHeight: '200px', minHeight: '120px' }}
                size={Math.min(8, filteredEquipment.length + 1) as number}
              >
                <option value="">Выберите оборудование...</option>
                {filteredEquipment.map(eq => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} ({eq.category})
                  </option>
                ))}
              </select>
            </div>
            {equipmentSearch && filteredEquipment.length === 0 && (
              <p className="text-xs text-muted-foreground">Ничего не найдено</p>
            )}
            {filteredEquipment.length > 0 && (
              <p className="text-xs text-muted-foreground">Найдено: {filteredEquipment.length}</p>
            )}
          </div>
          <div className="col-span-3">
            <Input
              placeholder="Или введите название вручную"
              value={newItem.equipment_id ? '' : newItem.equipment_name}
              onChange={(e) => setNewItem({ ...newItem, equipment_name: e.target.value, equipment_id: '', category: '' })}
              onKeyDown={handleKeyDown}
              disabled={!!newItem.equipment_id}
              className="h-10"
            />
          </div>
          <div className="col-span-2">
            <select
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card text-foreground h-10"
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              disabled={!!newItem.equipment_id}
            >
              <option value="">Категория</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-1">
            <Input
              type="text"
              min={1}
              placeholder="Кол-во"
              value={quantityInput}
              onChange={(e) => handleQuantityChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-10"
            />
          </div>
          <div className="col-span-1 flex items-end">
            <Button 
              onClick={addItem} 
              size="sm" 
              className="w-full h-10"
              disabled={!newItem.equipment_name}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700">
            Позиции шаблона ({items.length})
          </h5>
          
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Добавьте оборудование в шаблон
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {items.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex justify-between items-center bg-card p-3 rounded border"
                >
                  <div className="flex-1">
                    <span className="font-medium text-sm">{item.equipment_name}</span>
                    <span className="text-gray-500 text-sm ml-2">
                      ({item.category}) × {item.default_quantity} шт.
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeItem(idx)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <Button 
          onClick={() => onSubmit({ name, description }, items)}
          className="flex-1"
          disabled={!name}
        >
          <Copy className="w-4 h-4 mr-2" />
          {template ? 'Сохранить изменения' : 'Создать шаблон'}
        </Button>
        <Button 
          variant="outline" 
          onClick={onCancel}
        >
          Отмена
        </Button>
      </div>
    </div>
  );
}

import { toast } from 'sonner';

export default TemplatesManager;

