import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Spinner } from './ui/spinner';
import { Plus, Edit, Trash2, Search, Building2, User, Phone, Mail, AlertCircle, SearchIcon } from 'lucide-react';
import type { Customer } from '../types';

interface CustomersManagerProps {
  customers: Customer[];
  userId: string | undefined;
  onAdd: (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'> & { user_id: string }) => Promise<{ error: any }>;
  onUpdate: (id: string, updates: Partial<Customer>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
  loading?: boolean;
  error?: string | null;
}

export function CustomersManager({ customers, userId, onAdd, onUpdate, onDelete, loading, error }: CustomersManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    if (editingCustomer) {
      await onUpdate(editingCustomer.id, data);
    } else {
      if (!userId) return;
      await onAdd({ ...data, user_id: userId });
    }
    setSubmitting(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="shadow-sm rounded-xl p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Ошибка загрузки</h3>
          <p className="text-gray-600 max-w-md mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Пожалуйста, выполните SQL скрипт <code className="bg-gray-100 px-1 py-0.5 rounded">supabase_schema.sql</code> в Supabase Dashboard
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-sm hover:shadow-md transition-shadow rounded-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-xl">Заказчики</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Всего: {customers.length}</p>
            </div>
            <Button onClick={handleOpenNew} className="shadow-sm hover:shadow-md transition-all rounded-lg">
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
              className="pl-10 rounded-lg"
            />
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block border rounded-xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead>Название / Контакт</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>ИНН</TableHead>
                  <TableHead>Телефон</TableHead>
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
                    <TableRow key={customer.id} className="hover:bg-blue-50/50 transition-colors">
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
                      <TableCell>
                        <Badge variant="outline" className="rounded-md">{getTypeLabel(customer.type)}</Badge>
                      </TableCell>
                      <TableCell>{customer.inn || '-'}</TableCell>
                      <TableCell>{customer.phone || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleOpenEdit(customer)}
                            className="rounded-lg hover:bg-blue-100"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onDelete(customer.id)}
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
            {filteredCustomers.length === 0 ? (
              <p className="text-center py-8 text-gray-500">Заказчики не найдены</p>
            ) : (
              filteredCustomers.map((customer) => (
                <Card key={customer.id} className="p-4 shadow-sm hover:shadow-md transition-all rounded-xl">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        {getTypeIcon(customer.type)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{customer.name}</p>
                        {customer.contact_person && (
                          <p className="text-xs text-gray-500 truncate">{customer.contact_person}</p>
                        )}
                        <Badge variant="outline" className="mt-1 text-xs rounded-md">{getTypeLabel(customer.type)}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg hover:bg-blue-100"
                        onClick={() => handleOpenEdit(customer)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg hover:bg-red-100"
                        onClick={() => onDelete(customer.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  {(customer.phone || customer.email || customer.inn) && (
                    <div className="mt-3 pt-3 border-t text-sm space-y-1">
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-3 h-3" />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                      {customer.inn && (
                        <p className="text-xs text-gray-500">ИНН: {customer.inn}</p>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl" aria-describedby="customer-dialog-desc">
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
            submitting={submitting}
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
  submitting: boolean;
}

// Проверка наличия API ключа
const DADATA_API_KEY = import.meta.env.VITE_DADATA_API_KEY;

// Функция для запроса данных по ИНН через API Dadata
async function fetchCompanyByInn(inn: string): Promise<any> {
  // Очистка ИНН от пробелов
  const cleanInn = inn.replace(/\s/g, '');
  
  if (cleanInn.length !== 10 && cleanInn.length !== 12) {
    throw new Error('ИНН должен содержать 10 или 12 цифр');
  }

  // API Dadata (бесплатно до 10 000 запросов)
  if (!DADATA_API_KEY || DADATA_API_KEY === 'your_dadata_api_key_here') {
    throw new Error('API ключ Dadata не настроен. Добавьте VITE_DADATA_API_KEY в .env файл и перезапустите сервер');
  }

  try {
    const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${DADATA_API_KEY}`
      },
      body: JSON.stringify({ 
        query: cleanInn,
        branch_type: 'MAIN'
      })
    });

    if (response.status === 401) {
      throw new Error('Неверный API ключ. Проверьте VITE_DADATA_API_KEY в .env файле');
    }

    if (!response.ok) {
      throw new Error(`Ошибка API: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.suggestions || data.suggestions.length === 0) {
      throw new Error('Организация с таким ИНН не найдена');
    }

    return data.suggestions[0].data;
  } catch (error: any) {
    if (error.message?.includes('Failed to fetch')) {
      throw new Error('Ошибка сети. Проверьте подключение к интернету');
    }
    throw error;
  }
}

function CustomerForm({ initialData, onSubmit, onCancel, submitting }: CustomerFormProps) {
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
  
  const [isLoadingInn, setIsLoadingInn] = useState(false);
  const [innError, setInnError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return;
    }
    onSubmit(formData);
  };

  const handleInnLookup = async () => {
    if (!formData.inn || formData.inn.length < 10) {
      setInnError('Введите корректный ИНН (10 или 12 цифр)');
      return;
    }

    setIsLoadingInn(true);
    setInnError(null);

    try {
      const companyData = await fetchCompanyByInn(formData.inn);
      
      // Определяем тип организации
      const isIp = companyData.type === 'INDIVIDUAL';
      
      setFormData(prev => ({
        ...prev,
        type: isIp ? 'ip' : 'company',
        name: companyData.name?.full || companyData.name?.short || prev.name,
        kpp: companyData.kpp || prev.kpp,
        ogrn: companyData.ogrn || prev.ogrn,
        legal_address: companyData.address?.value || companyData.address?.unrestricted_value || prev.legal_address,
        // Для ИП ФИО из руководителя
        contact_person: isIp && companyData.fio ? 
          `${companyData.fio.surname} ${companyData.fio.name} ${companyData.fio.patronymic || ''}`.trim() : 
          prev.contact_person
      }));

    } catch (error: any) {
      setInnError(error.message || 'Ошибка при получении данных');
    } finally {
      setIsLoadingInn(false);
    }
  };

  const handleInnChange = (value: string) => {
    // Разрешаем только цифры
    const cleanValue = value.replace(/\D/g, '').slice(0, 12);
    setFormData(prev => ({ ...prev, inn: cleanValue }));
    setInnError(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs defaultValue="main">
        <TabsList className="grid w-full grid-cols-3 rounded-lg">
          <TabsTrigger value="main">Основное</TabsTrigger>
          <TabsTrigger value="contacts">Контакты</TabsTrigger>
          <TabsTrigger value="bank">Банк</TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Тип</Label>
            <select
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
              className="rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>ИНН</Label>
                {DADATA_API_KEY && DADATA_API_KEY !== 'your_dadata_api_key_here' && DADATA_API_KEY.length > 10 ? (
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    API активен
                  </span>
                ) : (
                  <span className="text-xs text-orange-500 flex items-center gap-1" title="Добавьте VITE_DADATA_API_KEY в Environment Variables Vercel">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    API не настроен
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={formData.inn}
                  onChange={(e) => handleInnChange(e.target.value)}
                  placeholder="1234567890"
                  className="rounded-lg flex-1"
                  maxLength={12}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleInnLookup}
                  disabled={isLoadingInn || formData.inn.length < 10 || !DADATA_API_KEY || DADATA_API_KEY === 'your_dadata_api_key_here' || DADATA_API_KEY.length < 10}
                  className="rounded-lg whitespace-nowrap"
                  title={!DADATA_API_KEY || DADATA_API_KEY === 'your_dadata_api_key_here' ? 'Добавьте VITE_DADATA_API_KEY в Environment Variables Vercel' : ''}
                >
                  {isLoadingInn ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    <>
                      <SearchIcon className="w-4 h-4 mr-1 hidden sm:inline" />
                      <span>Заполнить</span>
                    </>
                  )}
                </Button>
              </div>
              {innError && (
                <p className="text-xs text-red-500">{innError}</p>
              )}
              <p className="text-xs text-gray-400">
                {!DADATA_API_KEY || DADATA_API_KEY === 'your_dadata_api_key_here' || DADATA_API_KEY.length < 10
                  ? '⚠️ Добавьте VITE_DADATA_API_KEY в Settings → Environment Variables на Vercel, затем redeploy' 
                  : 'Введите ИНН и нажмите "Заполнить" для автозаполнения данных'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>КПП</Label>
              <Input
                value={formData.kpp}
                onChange={(e) => setFormData({ ...formData, kpp: e.target.value })}
                placeholder="123456789"
                className="rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>ОГРН / ОГРНИП</Label>
            <Input
              value={formData.ogrn}
              onChange={(e) => setFormData({ ...formData, ogrn: e.target.value })}
              placeholder="1234567890123"
              className="rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label>Юридический адрес</Label>
            <Input
              value={formData.legal_address}
              onChange={(e) => setFormData({ ...formData, legal_address: e.target.value })}
              placeholder="660000, г.Красноярск, ул.Ленина, д.1"
              className="rounded-lg"
            />
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Контактное лицо</Label>
            <Input
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              placeholder="ФИО ответственного лица"
              className="rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+7 (391) 123-45-67"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="info@company.ru"
                className="rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Примечания</Label>
            <textarea
              className="w-full border rounded-lg p-2 min-h-[80px] resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Дополнительная информация..."
            />
          </div>
        </TabsContent>

        <TabsContent value="bank" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Наименование банка</Label>
            <Input
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              placeholder="ПАО СБЕРБАНК РОССИИ"
              className="rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>БИК</Label>
              <Input
                value={formData.bank_bik}
                onChange={(e) => setFormData({ ...formData, bank_bik: e.target.value })}
                placeholder="040407627"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>К/с</Label>
              <Input
                value={formData.bank_corr_account}
                onChange={(e) => setFormData({ ...formData, bank_corr_account: e.target.value })}
                placeholder="30101810800000000627"
                className="rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Р/с</Label>
            <Input
              value={formData.bank_account}
              onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
              placeholder="40802810100000001234"
              className="rounded-lg"
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="rounded-lg" disabled={submitting}>
          Отмена
        </Button>
        <Button type="submit" className="rounded-lg" disabled={submitting}>
          {submitting && <Spinner className="w-4 h-4 mr-2" />}
          {initialData ? 'Сохранить' : 'Добавить'}
        </Button>
      </div>
    </form>
  );
}
