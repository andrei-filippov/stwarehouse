import { useState, useEffect, useCallback, memo, useRef, ChangeEvent } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Trash2, Edit, Copy, FileText, Upload, Download, FileCode } from 'lucide-react';
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
          <ContractTemplates userId={userId} />
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="template-dialog-desc">
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
}

function ContractTemplates({ userId }: ContractTemplatesProps) {
  const {
    templates,
    loading,
    uploadTemplateFile,
    createTextTemplate,
    deleteTemplate,
    downloadFile,
  } = useContractTemplates(userId);

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
            <Button variant="outline" onClick={() => setIsTextDialogOpen(true)}>
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
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
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
        <DialogContent className="max-w-lg" aria-describedby="upload-dialog-desc">
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

      {/* Диалог создания текстового шаблона */}
      <Dialog open={isTextDialogOpen} onOpenChange={setIsTextDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="text-template-desc">
          <DialogHeader>
            <DialogTitle>Текстовый шаблон договора</DialogTitle>
            <DialogDescription id="text-template-desc">
              Создайте шаблон договора с использованием плейсхолдеров
            </DialogDescription>
          </DialogHeader>
          <ContractTemplateForm
            onCancel={() => setIsTextDialogOpen(false)}
            onSave={async (data) => {
              const { error } = await createTextTemplate(data);
              if (!error) {
                setIsTextDialogOpen(false);
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
  onCancel: () => void;
  onSave: (data: any) => void;
}

function ContractTemplateForm({ onCancel, onSave }: ContractTemplateFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'service' as ContractType,
    description: '',
    content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    table.spec { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }
    table.spec th, table.spec td { border: 1px solid #000; padding: 5px; text-align: left; }
    table.spec th { background-color: #f0f0f0; }
  </style>
</head>
<body>
  <h2 class="center bold">ДОГОВОР № {{contract_number}}</h2>
  <p class="center">от {{contract_date}}</p>
  
  <p><span class="bold">{{executor_name}}</span>, именуемое в дальнейшем «Исполнитель», 
  в лице <span class="bold">{{executor_representative}}</span>, действующего на основании 
  <span class="bold">{{executor_basis}}</span>, с одной стороны, и 
  <span class="bold">{{customer_name}}</span>, именуемое в дальнейшем «Заказчик», 
  в лице <span class="bold">{{customer_representative}}</span>, действующего на основании 
  <span class="bold">{{customer_basis}}</span>, с другой стороны, вместе именуемые «Стороны», 
  заключили настоящий договор о нижеследующем:</p>

  <h3>1. Предмет договора</h3>
  <p>1.1. По настоящему Договору Исполнитель обязуется оказать услуги по техническому 
  оснащению мероприятия «<span class="bold">{{event_name}}</span>», 
  <span class="bold">{{event_date}}</span>.</p>

  <h3>2. Цена договора</h3>
  <p>2.1. Общая стоимость услуг составляет <span class="bold">{{total_amount}}</span> 
  (<span class="italic">{{total_amount_text}}</span>), НДС не облагается.</p>

  <h3>3. Реквизиты сторон</h3>
  <table class="spec">
    <tr>
      <td><b>Исполнитель:</b><br>{{executor_name}}<br>{{executor_representative}}</td>
      <td><b>Заказчик:</b><br>{{customer_name}}<br>{{customer_representative}}</td>
    </tr>
  </table>

  <p>Подписи сторон:</p>
  <table class="spec">
    <tr>
      <td>От Исполнителя: _______________</td>
      <td>От Заказчика: _______________</td>
    </tr>
  </table>
</body>
</html>`,
    is_default: false,
  });

  const placeholders = [
    { key: '{{contract_number}}', desc: 'Номер договора' },
    { key: '{{contract_date}}', desc: 'Дата договора' },
    { key: '{{customer_name}}', desc: 'Наименование заказчика' },
    { key: '{{customer_type}}', desc: 'Тип заказчика (ООО, ИП, ФЛ)' },
    { key: '{{customer_inn}}', desc: 'ИНН заказчика' },
    { key: '{{customer_kpp}}', desc: 'КПП заказчика' },
    { key: '{{customer_address}}', desc: 'Юр. адрес заказчика' },
    { key: '{{customer_representative}}', desc: 'Представитель заказчика' },
    { key: '{{customer_basis}}', desc: 'Основание (Устава/доверенность)' },
    { key: '{{executor_name}}', desc: 'Наименование исполнителя' },
    { key: '{{executor_representative}}', desc: 'Представитель исполнителя' },
    { key: '{{executor_basis}}', desc: 'Основание исполнителя' },
    { key: '{{event_name}}', desc: 'Название мероприятия' },
    { key: '{{event_date}}', desc: 'Дата мероприятия' },
    { key: '{{event_venue}}', desc: 'Место проведения' },
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

      <div className="bg-gray-50 p-3 rounded-lg">
        <h4 className="text-sm font-medium mb-2">Доступные плейсхолдеры:</h4>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {placeholders.map((p) => (
            <div key={p.key} className="flex items-center gap-2">
              <code className="bg-gray-200 px-1 rounded">{p.key}</code>
              <span className="text-gray-600">{p.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <Button variant="outline" onClick={onCancel}>Отмена</Button>
        <Button onClick={() => onSave(formData)} disabled={!formData.name}>
          <Copy className="w-4 h-4 mr-2" />
          Сохранить шаблон
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

      <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
        <h4 className="font-medium">Добавить оборудование в шаблон</h4>
        
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-4">
            <select
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={newItem.equipment_id}
              onChange={(e) => handleEquipmentSelect(e.target.value)}
            >
              <option value="">Выберите оборудование</option>
              {equipment.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} ({eq.category})
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3">
            <Input
              placeholder="Или введите название вручную"
              value={newItem.equipment_id ? '' : newItem.equipment_name}
              onChange={(e) => setNewItem({ ...newItem, equipment_name: e.target.value, equipment_id: '', category: '' })}
              onKeyDown={handleKeyDown}
              disabled={!!newItem.equipment_id}
            />
          </div>
          <div className="col-span-2">
            <select
              className="w-full border rounded-md px-3 py-2 text-sm"
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
          <div className="col-span-2">
            <Input
              type="text"
              min={1}
              placeholder="Кол-во"
              value={quantityInput}
              onChange={(e) => handleQuantityChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="col-span-1">
            <Button 
              onClick={addItem} 
              size="sm" 
              className="w-full"
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
                  className="flex justify-between items-center bg-white p-3 rounded border"
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

export default TemplatesManager;

