import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Download, 
  Users,
  Search,
  FileText
} from 'lucide-react';
import type { Staff } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StaffManagerProps {
  staff: Staff[];
  onAdd: (staff: Omit<Staff, 'id' | 'created_at' | 'updated_at'>) => Promise<{ error: any }>;
  onUpdate: (id: string, updates: Partial<Staff>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
}

export function StaffManager({ staff, onAdd, onUpdate, onDelete }: StaffManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

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
    if (editingStaff) {
      await onUpdate(editingStaff.id, data);
    } else {
      await onAdd(data);
    }
    handleClose();
  };

  // Экспорт списка в PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('SPISOK PERSONALA', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Vsego: ${filteredStaff.length} chelovek`, 20, 35);
    doc.text(`Data formirovaniya: ${new Date().toLocaleDateString('ru-RU')}`, 20, 42);

    const tableData = filteredStaff.map((s, idx) => [
      (idx + 1).toString(),
      s.full_name,
      s.position,
      s.phone || '-',
      s.email || '-',
      s.birth_date ? new Date(s.birth_date).toLocaleDateString('ru-RU') : '-'
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['#', 'FIO', 'Dolzhnost', 'Telefon', 'Email', 'Data rozhdeniya']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`personal_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Экспорт полных данных (с паспортами) - для внутреннего использования
  const exportFullDataPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Альбомная ориентация
    
    doc.setFontSize(16);
    doc.text('POLNIE DANNYE PERSONALA', 148, 15, { align: 'center' });
    
    doc.setFontSize(8);
    doc.text(`Data: ${new Date().toLocaleDateString('ru-RU')}`, 20, 25);

    const tableData = filteredStaff.map((s, idx) => [
      (idx + 1).toString(),
      s.full_name,
      s.position,
      s.passport_series && s.passport_number ? `${s.passport_series} ${s.passport_number}` : '-',
      s.passport_issued_by || '-',
      s.passport_issue_date ? new Date(s.passport_issue_date).toLocaleDateString('ru-RU') : '-',
      s.phone || '-',
      s.birth_date ? new Date(s.birth_date).toLocaleDateString('ru-RU') : '-'
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['#', 'FIO', 'Dolzhnost', 'Pasport', 'Vidan', 'Data vydachi', 'Telefon', 'Data rozhd.']],
      body: tableData,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`personal_full_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Персонал
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Активных: {activeCount} | Уволенных: {inactiveCount}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={exportToPDF}>
                <FileText className="w-4 h-4 mr-2" />
                Список (PDF)
              </Button>
              <Button variant="outline" onClick={exportFullDataPDF}>
                <Download className="w-4 h-4 mr-2" />
                Полные данные (PDF)
              </Button>
              <Button onClick={handleOpenNew}>
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
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="showInactive"
                checked={showInactive}
                onCheckedChange={(checked) => setShowInactive(checked as boolean)}
              />
              <Label htmlFor="showInactive" className="cursor-pointer">
                Показывать уволенных
              </Label>
            </div>
          </div>

          {/* Таблица */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>ФИО</TableHead>
                  <TableHead>Должность</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="w-24">Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      Сотрудники не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaff.map((s, idx) => (
                    <TableRow key={s.id} className={!s.is_active ? 'bg-gray-50' : ''}>
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
                      <TableCell className="hidden sm:table-cell">{s.email || '-'}</TableCell>
                      <TableCell>
                        {s.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Активен</Badge>
                        ) : (
                          <Badge variant="secondary">Уволен</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleOpenEdit(s)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => onDelete(s.id)}
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
        </CardContent>
      </Card>

      {/* Диалог добавления/редактирования */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? 'Редактировать сотрудника' : 'Новый сотрудник'}
            </DialogTitle>
          </DialogHeader>
          <StaffForm
            initialData={editingStaff}
            onSubmit={handleSubmit}
            onCancel={handleClose}
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
}

function StaffForm({ initialData, onSubmit, onCancel }: StaffFormProps) {
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
    notes: initialData?.notes || '',
    is_active: initialData?.is_active ?? true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Основная информация */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="full_name">ФИО *</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            placeholder="Иванов Иван Иванович"
            required
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
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Телефон</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+7 (999) 123-45-67"
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
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="birth_date">Дата рождения</Label>
          <Input
            id="birth_date"
            type="date"
            value={formData.birth_date}
            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
          />
        </div>
      </div>

      {/* Паспортные данные */}
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
            />
          </div>

          <div className="space-y-2 col-span-2">
            <Label htmlFor="passport_issue_date">Дата выдачи</Label>
            <Input
              id="passport_issue_date"
              type="date"
              value={formData.passport_issue_date}
              onChange={(e) => setFormData({ ...formData, passport_issue_date: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <Label htmlFor="passport_issued_by">Кем выдан</Label>
          <Input
            id="passport_issued_by"
            value={formData.passport_issued_by}
            onChange={(e) => setFormData({ ...formData, passport_issued_by: e.target.value })}
            placeholder="Отделом УФМС России по г. Москве"
          />
        </div>
      </div>

      {/* Примечания */}
      <div className="space-y-2">
        <Label htmlFor="notes">Примечания</Label>
        <Input
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Дополнительная информация..."
        />
      </div>

      {/* Статус */}
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

      {/* Кнопки */}
      <div className="flex gap-3 pt-4 border-t">
        <Button type="submit" className="flex-1">
          {initialData ? 'Сохранить изменения' : 'Добавить сотрудника'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
