import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Spinner } from './ui/spinner';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Download, 
  Users,
  Search,
  FileText,
  Phone,
  Mail,
  Calendar,
  Car
} from 'lucide-react';
import type { Staff } from '../types';

interface StaffManagerProps {
  staff: Staff[];
  onAdd: (staff: Omit<Staff, 'id' | 'created_at' | 'updated_at'>) => Promise<{ error: any }>;
  onUpdate: (id: string, updates: Partial<Staff>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
  loading?: boolean;
}

export function StaffManager({ staff, onAdd, onUpdate, onDelete, loading }: StaffManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const filteredStaff = staff.filter(s => {
    const matchesSearch = 
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery));
    const matchesActive = showInactive || s.is_active;
    return matchesSearch && matchesActive;
  });

  const activeCount = staff.filter(s => s.is_active).length;
  const inactiveCount = staff.filter(s => !s.is_active).length;

  const handleOpenNew = () => {
    setEditingStaff(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (s: Staff) => {
    setEditingStaff(s);
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingStaff(null);
  };

  const handleSubmit = async (data: any) => {
    setSubmitting(true);
    if (editingStaff) {
      await onUpdate(editingStaff.id, data);
    } else {
      await onAdd(data);
    }
    setSubmitting(false);
    handleClose();
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredStaff.map(s => s.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const selectedStaff = filteredStaff.filter(s => selectedIds.has(s.id));

  const exportToPDF = async () => {
    const staffToExport = selectedStaff.length > 0 ? selectedStaff : filteredStaff;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Список персонала</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { text-align: center; font-size: 18px; margin-bottom: 10px; }
          .info { font-size: 12px; margin-bottom: 20px; color: #666; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #2980b9; color: white; padding: 8px; text-align: left; }
          td { padding: 6px 8px; border-bottom: 1px solid #ddd; }
          tr:nth-child(even) { background: #f5f5f5; }
          .inactive { color: #999; }
        </style>
      </head>
      <body>
        <h1>СПИСОК ПЕРСОНАЛА</h1>
        <div class="info">
          Всего: ${staffToExport.length} человек | 
          Дата формирования: ${new Date().toLocaleDateString('ru-RU')}
          ${selectedStaff.length > 0 ? ' (выбранные)' : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>ФИО</th>
              <th>Должность</th>
              <th>Телефон</th>
              <th>Email</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            ${staffToExport.map((s, idx) => `
              <tr class="${s.is_active ? '' : 'inactive'}">
                <td>${idx + 1}</td>
                <td>${s.full_name}</td>
                <td>${s.position}</td>
                <td>${s.phone || '-'}</td>
                <td>${s.email || '-'}</td>
                <td>${s.is_active ? 'Активен' : 'Уволен'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const exportFullDataPDF = async () => {
    const staffToExport = selectedStaff.length > 0 ? selectedStaff : filteredStaff;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Полные данные персонала</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 15px; }
          h1 { text-align: center; font-size: 16px; margin-bottom: 10px; }
          .info { font-size: 11px; margin-bottom: 15px; color: #666; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; }
          th { background: #2980b9; color: white; padding: 6px; text-align: left; }
          td { padding: 4px 6px; border-bottom: 1px solid #ddd; }
          tr:nth-child(even) { background: #f5f5f5; }
          .passport { font-family: monospace; }
        </style>
      </head>
      <body>
        <h1>ПОЛНЫЕ ДАННЫЕ ПЕРСОНАЛА</h1>
        <div class="info">
          Всего: ${staffToExport.length} человек | 
          Дата: ${new Date().toLocaleDateString('ru-RU')}
          ${selectedStaff.length > 0 ? ' (выбранные)' : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>ФИО</th>
              <th>Должность</th>
              <th>Паспорт</th>
              <th>Телефон</th>
              <th>Дата рожд.</th>
            </tr>
          </thead>
          <tbody>
            ${staffToExport.map((s, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${s.full_name}</td>
                <td>${s.position}</td>
                <td class="passport">${s.passport_series || ''} ${s.passport_number || ''}</td>
                <td>${s.phone || '-'}</td>
                <td>${s.birth_date ? new Date(s.birth_date).toLocaleDateString('ru-RU') : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-sm hover:shadow-md transition-shadow rounded-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="w-5 h-5" />
                Персонал
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Активных: {activeCount} | Уволенных: {inactiveCount}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {selectedIds.size > 0 && (
                <Badge variant="secondary" className="mr-2 rounded-lg">
                  Выбрано: {selectedIds.size}
                </Badge>
              )}
              <Button variant="outline" onClick={exportToPDF} className="rounded-lg shadow-sm hover:shadow-md transition-all">
                <FileText className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{selectedIds.size > 0 ? 'Экспорт выбранных' : 'Список (PDF)'}</span>
                <span className="sm:hidden">PDF</span>
              </Button>
              <Button variant="outline" onClick={exportFullDataPDF} className="rounded-lg shadow-sm hover:shadow-md transition-all hidden sm:flex">
                <Download className="w-4 h-4 mr-2" />
                Полные данные
              </Button>
              <Button onClick={handleOpenNew} className="shadow-sm hover:shadow-md transition-all rounded-lg">
                <Plus className="w-4 h-4 mr-2" />
                Добавить
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Фильтры */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Поиск по ФИО, должности, телефону..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="showInactive"
                checked={showInactive}
                onCheckedChange={(checked) => setShowInactive(checked as boolean)}
              />
              <Label htmlFor="showInactive" className="cursor-pointer text-sm">
                Показывать уволенных
              </Label>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block border rounded-xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={selectedIds.size === filteredStaff.length && filteredStaff.length > 0}
                      onCheckedChange={(checked) => checked ? selectAll() : deselectAll()}
                    />
                  </TableHead>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>ФИО</TableHead>
                  <TableHead>Должность</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-24">Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Сотрудники не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaff.map((s, idx) => (
                    <TableRow key={s.id} className={`hover:bg-blue-50/50 transition-colors ${!s.is_active ? 'bg-gray-50' : ''}`}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.has(s.id)}
                          onCheckedChange={() => toggleSelection(s.id)}
                        />
                      </TableCell>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-medium">
                        {s.full_name}
                        {s.birth_date && (
                          <span className="block text-xs text-gray-500">
                            {new Date().getFullYear() - new Date(s.birth_date).getFullYear()} лет
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{s.position}</TableCell>
                      <TableCell>{s.phone || '-'}</TableCell>
                      <TableCell>{s.email || '-'}</TableCell>
                      <TableCell>
                        {s.is_active ? (
                          <Badge className="bg-green-100 text-green-800 rounded-md">Активен</Badge>
                        ) : (
                          <Badge variant="secondary" className="rounded-md">Уволен</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleOpenEdit(s)}
                            className="rounded-lg hover:bg-blue-100"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => onDelete(s.id)}
                            className="rounded-lg hover:bg-red-100"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredStaff.length === 0 ? (
              <p className="text-center py-8 text-gray-500">Сотрудники не найдены</p>
            ) : (
              filteredStaff.map((s, idx) => (
                <Card key={s.id} className={`p-4 shadow-sm hover:shadow-md transition-all rounded-xl ${!s.is_active ? 'opacity-70' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Checkbox 
                        checked={selectedIds.has(s.id)}
                        onCheckedChange={() => toggleSelection(s.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{s.full_name}</p>
                          {s.is_active ? (
                            <Badge className="bg-green-100 text-green-800 text-xs rounded-md">Активен</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs rounded-md">Уволен</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{s.position}</p>
                        {s.birth_date && (
                          <p className="text-xs text-gray-500">
                            {new Date().getFullYear() - new Date(s.birth_date).getFullYear()} лет
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg hover:bg-blue-100"
                        onClick={() => handleOpenEdit(s)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg hover:bg-red-100"
                        onClick={() => onDelete(s.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  {(s.phone || s.email) && (
                    <div className="mt-3 pt-3 border-t text-sm space-y-1">
                      {s.phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-3 h-3" />
                          <span>{s.phone}</span>
                        </div>
                      )}
                      {s.email && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{s.email}</span>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Диалог добавления/редактирования */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? 'Редактировать сотрудника' : 'Новый сотрудник'}
            </DialogTitle>
          </DialogHeader>
          <StaffForm
            initialData={editingStaff}
            onSubmit={handleSubmit}
            onCancel={handleClose}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface StaffFormProps {
  initialData: Staff | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  submitting: boolean;
}

function StaffForm({ initialData, onSubmit, onCancel, submitting }: StaffFormProps) {
  const [formData, setFormData] = useState({
    full_name: initialData?.full_name || '',
    position: initialData?.position || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    birth_date: initialData?.birth_date || '',
    passport_series: initialData?.passport_series || '',
    passport_number: initialData?.passport_number || '',
    passport_issued_by: initialData?.passport_issued_by || '',
    passport_issue_date: initialData?.passport_issue_date || '',
    car_info: initialData?.car_info || '',
    notes: initialData?.notes || '',
    is_active: initialData?.is_active ?? true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="full_name">ФИО *</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            placeholder="Иванов Иван Иванович"
            required
            className="rounded-lg"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="position">Должность *</Label>
          <Input
            id="position"
            value={formData.position}
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
            placeholder="Звукорежиссер"
            required
            className="rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Телефон</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+7 (999) 123-45-67"
            className="rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@example.com"
            className="rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="birth_date">Дата рождения</Label>
          <Input
            id="birth_date"
            type="date"
            value={formData.birth_date}
            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
            className="rounded-lg"
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">Паспортные данные</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="passport_series">Серия</Label>
            <Input
              id="passport_series"
              value={formData.passport_series}
              onChange={(e) => setFormData({ ...formData, passport_series: e.target.value })}
              placeholder="4515"
              maxLength={4}
              className="rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="passport_number">Номер</Label>
            <Input
              id="passport_number"
              value={formData.passport_number}
              onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
              placeholder="123456"
              maxLength={6}
              className="rounded-lg"
            />
          </div>

          <div className="space-y-2 col-span-2">
            <Label htmlFor="passport_issue_date">Дата выдачи</Label>
            <Input
              id="passport_issue_date"
              type="date"
              value={formData.passport_issue_date}
              onChange={(e) => setFormData({ ...formData, passport_issue_date: e.target.value })}
              className="rounded-lg"
            />
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <Label htmlFor="passport_issued_by">Кем выдан</Label>
          <Input
            id="passport_issued_by"
            value={formData.passport_issued_by}
            onChange={(e) => setFormData({ ...formData, passport_issued_by: e.target.value })}
            placeholder="Отделом УФМС России"
            className="rounded-lg"
          />
        </div>

        <div className="space-y-2 mt-4">
          <Label htmlFor="car_info">Автомобиль</Label>
          <Input
            id="car_info"
            value={formData.car_info}
            onChange={(e) => setFormData({ ...formData, car_info: e.target.value })}
            placeholder="Ford Focus, А123БС777"
            className="rounded-lg"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Примечания</Label>
        <Input
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Дополнительная информация..."
          className="rounded-lg"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked as boolean })}
        />
        <Label htmlFor="is_active" className="cursor-pointer">
          Сотрудник активен
        </Label>
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <Button type="submit" className="flex-1 rounded-lg" disabled={submitting}>
          {submitting && <Spinner className="w-4 h-4 mr-2" />}
          {initialData ? 'Сохранить изменения' : 'Добавить сотрудника'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="rounded-lg" disabled={submitting}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
