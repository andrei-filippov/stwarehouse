import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Edit, Trash2, Search, Building2, User } from 'lucide-react';
import type { Customer } from '../types';

interface CustomersManagerProps {
  customers: Customer[];
  userId: string | undefined;
  onAdd: (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'> & { user_id: string }) => Promise<{ error: any }>;
  onUpdate: (id: string, updates: Partial<Customer>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
}

export function CustomersManager({ customers, userId, onAdd, onUpdate, onDelete }: CustomersManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.inn?.includes(searchQuery) ||
    c.contact_person?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenNew = () => {
    setEditingCustomer(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (data: any) => {
    if (editingCustomer) {
      await onUpdate(editingCustomer.id, data);
    } else {
      if (!userId) return;
      await onAdd({ ...data, user_id: userId });
    }
    setIsDialogOpen(false);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'company': return 'Компания';
      case 'ip': return 'ИП';
      case 'individual': return 'Физ.лицо';
      default: return type;
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'individual' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Заказчики</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Всего: {customers.length}</p>
            </div>
            <Button onClick={handleOpenNew}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Поиск по названию, ИНН, контакту..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название / Контакт</TableHead>
                  <TableHead className="hidden sm:table-cell">Тип</TableHead>
                  <TableHead className="hidden md:table-cell">ИНН</TableHead>
                  <TableHead className="hidden lg:table-cell">Телефон</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      Заказчики не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(customer.type)}
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            {customer.contact_person && (
                              <p className="text-xs text-gray-500">{customer.contact_person}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{getTypeLabel(customer.type)}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{customer.inn || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell">{customer.phone || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(customer)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onDelete(customer.id)}>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="customer-dialog-desc">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Редактировать' : 'Добавить'} заказчика</DialogTitle>
            <DialogDescription id="customer-dialog-desc">
              Заполните основные данные заказчика
            </DialogDescription>
          </DialogHeader>
          <CustomerForm 
            initialData={editingCustomer} 
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CustomerFormProps {
  initialData: Customer | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

function CustomerForm({ initialData, onSubmit, onCancel }: CustomerFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'company',
    inn: initialData?.inn || '',
    kpp: initialData?.kpp || '',
    ogrn: initialData?.ogrn || '',
    legal_address: initialData?.legal_address || '',
    contact_person: initialData?.contact_person || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    bank_name: initialData?.bank_name || '',
    bank_bik: initialData?.bank_bik || '',
    bank_account: initialData?.bank_account || '',
    bank_corr_account: initialData?.bank_corr_account || '',
    notes: initialData?.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Введите название');
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs defaultValue="main">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="main">Основное</TabsTrigger>
          <TabsTrigger value="contacts">Контакты</TabsTrigger>
          <TabsTrigger value="bank">Банк</TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-4">
          <div className="space-y-2">
            <Label>Тип</Label>
            <select
              className="w-full border rounded-md p-2"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="company">ООО / АО / Компания</option>
              <option value="ip">Индивидуальный предприниматель</option>
              <option value="individual">Физическое лицо</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Название / ФИО *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={formData.type === 'individual' ? 'Иванов Иван Иванович' : 'ООО "Ромашка"'}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ИНН</Label>
              <Input
                value={formData.inn}
                onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                placeholder="1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label>КПП</Label>
              <Input
                value={formData.kpp}
                onChange={(e) => setFormData({ ...formData, kpp: e.target.value })}
                placeholder="123456789"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>ОГРН / ОГРНИП</Label>
            <Input
              value={formData.ogrn}
              onChange={(e) => setFormData({ ...formData, ogrn: e.target.value })}
              placeholder="1234567890123"
            />
          </div>

          <div className="space-y-2">
            <Label>Юридический адрес</Label>
            <Input
              value={formData.legal_address}
              onChange={(e) => setFormData({ ...formData, legal_address: e.target.value })}
              placeholder="660000, г.Красноярск, ул.Ленина, д.1"
            />
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <div className="space-y-2">
            <Label>Контактное лицо</Label>
            <Input
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              placeholder="ФИО ответственного лица"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+7 (391) 123-45-67"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="info@company.ru"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Примечания</Label>
            <textarea
              className="w-full border rounded-md p-2 min-h-[80px]"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Дополнительная информация..."
            />
          </div>
        </TabsContent>

        <TabsContent value="bank" className="space-y-4">
          <div className="space-y-2">
            <Label>Наименование банка</Label>
            <Input
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              placeholder="ПАО СБЕРБАНК РОССИИ"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>БИК</Label>
              <Input
                value={formData.bank_bik}
                onChange={(e) => setFormData({ ...formData, bank_bik: e.target.value })}
                placeholder="040407627"
              />
            </div>
            <div className="space-y-2">
              <Label>К/с</Label>
              <Input
                value={formData.bank_corr_account}
                onChange={(e) => setFormData({ ...formData, bank_corr_account: e.target.value })}
                placeholder="30101810800000000627"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Р/с</Label>
            <Input
              value={formData.bank_account}
              onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
              placeholder="40802810100000001234"
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit">
          {initialData ? 'Сохранить' : 'Добавить'}
        </Button>
      </div>
    </form>
  );
}
