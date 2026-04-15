import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  CalendarIcon, 
  Building2, 
  User, 
  Briefcase,
  CalendarDays,
  Banknote
} from 'lucide-react';
import type { Contract, ContractTemplate, ContractType, ContractStatus, PDFSettings, CompanyBankAccount } from '../types';
import { CONTRACT_TYPE_LABELS, CONTRACT_STATUS_LABELS } from '../types';

interface ContractFormProps {
  contract: Contract | null;
  templates: ContractTemplate[];
  customers: any[];
  estimates: any[];
  pdfSettings: PDFSettings;
  bankAccounts?: CompanyBankAccount[];
  getNextNumber: (type: ContractType, year: number) => Promise<string>;
  onSave: (contract: any, estimateIds: string[], bankAccountId?: string) => void;
  onCancel: () => void;
}

export function ContractForm({
  contract,
  templates,
  customers,
  estimates,
  pdfSettings,
  bankAccounts = [],
  getNextNumber,
  onSave,
  onCancel,
}: ContractFormProps) {
  const isEditing = !!contract;
  const currentYear = new Date().getFullYear();
  
  // Используем ref для отслеживания инициализации
  const initializedRef = useRef(false);

  // Основные поля
  const [number, setNumber] = useState(contract?.number || '');
  const [date, setDate] = useState<Date>(contract?.date ? new Date(contract.date) : new Date());
  const [type, setType] = useState<ContractType>(contract?.type || 'service');
  const [status, setStatus] = useState<ContractStatus>(contract?.status || 'draft');
  const [templateId, setTemplateId] = useState(contract?.template_id || '');
  const [customerId, setCustomerId] = useState(contract?.customer_id || '');
  
  // Мероприятие
  const [eventName, setEventName] = useState(contract?.event_name || '');
  const [eventStartDate, setEventStartDate] = useState<Date | undefined>(
    contract?.event_start_date ? new Date(contract.event_start_date) : undefined
  );
  const [eventEndDate, setEventEndDate] = useState<Date | undefined>(
    contract?.event_end_date ? new Date(contract.event_end_date) : undefined
  );
  const [venue, setVenue] = useState(contract?.venue || '');
  
  // Финансы
  const [totalAmount, setTotalAmount] = useState(contract?.total_amount || 0);
  const [paymentTerms, setPaymentTerms] = useState(contract?.payment_terms || '');
  
  // Исполнитель
  const [executorName, setExecutorName] = useState(contract?.executor_name || pdfSettings.companyName || '');
  const [executorRepresentative, setExecutorRepresentative] = useState(contract?.executor_representative || pdfSettings.personName || '');
  const [executorBasis, setExecutorBasis] = useState(contract?.executor_basis || 'Устава');
  
  // Дополнительно
  const [subject, setSubject] = useState(contract?.subject || '');
  const [additionalTerms, setAdditionalTerms] = useState(contract?.additional_terms || '');
  
  // Привязанные сметы
  const [selectedEstimateIds, setSelectedEstimateIds] = useState<string[]>(
    contract?.estimates?.map((e: any) => e.estimate_id) || []
  );
  
  // Банковский счет
  const defaultAccount = bankAccounts.find(a => a.is_default);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>(
    contract?.bank_account_id || defaultAccount?.id || ''
  );

  // Обновление состояний при изменении contract (для редактирования существующего договора)
  useEffect(() => {
    if (contract) {
      setNumber(contract.number || '');
      setDate(contract.date ? new Date(contract.date) : new Date());
      setType(contract.type || 'service');
      setStatus(contract.status || 'draft');
      setTemplateId(contract.template_id || '');
      setCustomerId(contract.customer_id || '');
      setEventName(contract.event_name || '');
      setEventStartDate(contract.event_start_date ? new Date(contract.event_start_date) : undefined);
      setEventEndDate(contract.event_end_date ? new Date(contract.event_end_date) : undefined);
      setVenue(contract.venue || '');
      setTotalAmount(contract.total_amount || 0);
      setPaymentTerms(contract.payment_terms || '');
      setExecutorName(contract.executor_name || pdfSettings.companyName || '');
      setExecutorRepresentative(contract.executor_representative || pdfSettings.personName || '');
      setExecutorBasis(contract.executor_basis || 'Устава');
      setSubject(contract.subject || '');
      setAdditionalTerms(contract.additional_terms || '');
      setSelectedEstimateIds(contract.estimates?.map((e: any) => e.estimate_id) || []);
      setSelectedBankAccountId(contract.bank_account_id || defaultAccount?.id || '');
    } else {
      // Сброс состояний при создании нового договора
      setNumber('');
      setDate(new Date());
      setType('service');
      setStatus('draft');
      setTemplateId('');
      setCustomerId('');
      setEventName('');
      setEventStartDate(undefined);
      setEventEndDate(undefined);
      setVenue('');
      setTotalAmount(0);
      setPaymentTerms('');
      setExecutorName(pdfSettings.companyName || '');
      setExecutorRepresentative(pdfSettings.personName || '');
      setExecutorBasis('Устава');
      setSubject('');
      setAdditionalTerms('');
      setSelectedEstimateIds([]);
      setSelectedBankAccountId(defaultAccount?.id || '');
      
      // Генерация номера для нового договора
      getNextNumber('service', currentYear).then(setNumber);
      setPaymentTerms('Оплата в течение 15 банковских дней с даты подписания Акта сдачи-приемки услуг.');
    }
    
    // Сбрасываем флаг инициализации
    initializedRef.current = false;
  }, [contract?.id]); // Запускаем при изменении ID договора

  // Пересчёт суммы при изменении выбранных смет
  useEffect(() => {
    if (selectedEstimateIds.length === 0) {
      setTotalAmount(0);
      return;
    }
    const sum = estimates
      .filter((e: any) => selectedEstimateIds.includes(e.id))
      .reduce((acc: number, e: any) => acc + (e.total || 0), 0);
    setTotalAmount(sum);
  }, [selectedEstimateIds]);

  // Автовыбор шаблона при создании нового договора
  useEffect(() => {
    if (!isEditing && !templateId && templates.length > 0) {
      // Сначала ищем текстовый шаблон по умолчанию, затем любой по умолчанию, затем первый текстовый, затем первый любой
      const defaultTemplate = templates.find(t => !t.is_file_template && t.is_default) 
        || templates.find(t => t.is_default)
        || templates.find(t => !t.is_file_template)
        || templates[0];
      if (defaultTemplate) {
        setTemplateId(defaultTemplate.id);
      }
    }
  }, [templates, isEditing, templateId]);

  const handleTypeChange = useCallback((newType: ContractType) => {
    setType(newType);
    if (!isEditing) {
      getNextNumber(newType, currentYear).then(setNumber);
    }
  }, [isEditing, currentYear, getNextNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const contractData = {
      number,
      date: date.toISOString().split('T')[0],
      type,
      status,
      template_id: templateId || null,
      customer_id: customerId || null,
      event_name: eventName || null,
      event_start_date: eventStartDate?.toISOString().split('T')[0] || null,
      event_end_date: eventEndDate?.toISOString().split('T')[0] || null,
      venue: venue || null,
      total_amount: totalAmount,
      payment_terms: paymentTerms || null,
      executor_name: executorName || null,
      executor_representative: executorRepresentative || null,
      executor_basis: executorBasis || null,
      subject: subject || null,
      additional_terms: additionalTerms || null,
      // Сохраняем отредактированный контент если он есть
      content: contract?.content || null,
    };

    onSave(contractData, selectedEstimateIds, selectedBankAccountId);
  };

  const toggleEstimate = (estimateId: string) => {
    setSelectedEstimateIds(prev => 
      prev.includes(estimateId)
        ? prev.filter(id => id !== estimateId)
        : [...prev, estimateId]
    );
  };

  // Выбранный заказчик
  const selectedCustomer = customers.find((c: any) => c.id === customerId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="main" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="main">Основное</TabsTrigger>
          <TabsTrigger value="event">Мероприятие</TabsTrigger>
          <TabsTrigger value="finance">Финансы</TabsTrigger>
          <TabsTrigger value="estimates">Сметы ({selectedEstimateIds.length})</TabsTrigger>
        </TabsList>

        {/* Основная информация */}
        <TabsContent value="main" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="number">Номер договора</Label>
              <Input
                id="number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
                placeholder="01-25У"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Дата договора</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'dd.MM.yyyy', { locale: ru }) : 'Выберите дату'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Тип договора</Label>
              <Select value={type} onValueChange={(v) => handleTypeChange(v as ContractType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Статус</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ContractStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Шаблон договора ({templates.length})</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите шаблон" />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 ? (
                  <SelectItem value="" disabled>
                    Нет доступных шаблонов
                  </SelectItem>
                ) : (
                  templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.is_file_template ? ' (DOCX)' : ''}
                      {template.is_default && !template.is_file_template ? ' (по умолчанию)' : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer">Заказчик</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите заказчика" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCustomer && (
            <Card className="bg-muted">
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span>{selectedCustomer.type === 'company' ? 'ООО' : selectedCustomer.type === 'ip' ? 'ИП' : 'Физ.лицо'}</span>
                </div>
                {selectedCustomer.inn && <div>ИНН: {selectedCustomer.inn}</div>}
                {selectedCustomer.legal_address && <div>Адрес: {selectedCustomer.legal_address}</div>}
                {selectedCustomer.contact_person && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span>{selectedCustomer.contact_person}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label htmlFor="subject">Предмет договора</Label>
            <Textarea
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Описание предмета договора"
              rows={3}
            />
          </div>
        </TabsContent>

        {/* Мероприятие */}
        <TabsContent value="event" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eventName">Название мероприятия</Label>
            <Input
              id="eventName"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Например: Корпоративное мероприятие"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Дата начала</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {eventStartDate ? format(eventStartDate, 'dd.MM.yyyy', { locale: ru }) : 'Выберите дату'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={eventStartDate}
                    onSelect={setEventStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>Дата окончания</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {eventEndDate ? format(eventEndDate, 'dd.MM.yyyy', { locale: ru }) : 'Выберите дату'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={eventEndDate}
                    onSelect={setEventEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="venue">Место проведения</Label>
            <Input
              id="venue"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Адрес площадки"
            />
          </div>
        </TabsContent>

        {/* Финансы */}
        <TabsContent value="finance" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="totalAmount">Общая сумма договора</Label>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="totalAmount"
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(Number(e.target.value))}
                className="pl-10"
                min={0}
                step={0.01}
              />
            </div>
            <p className="text-sm text-gray-500">Сумма автоматически рассчитывается из привязанных смет</p>
          </div>

          {bankAccounts.length > 0 && (
            <div className="space-y-2">
              <Label>Банковский счет для оплаты</Label>
              <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите счет" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <span>{account.name}</span>
                        <span className="text-muted-foreground">({account.currency})</span>
                        {account.is_default && (
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">по умолчанию</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBankAccountId && (
                <div className="text-sm text-muted-foreground space-y-1 bg-muted p-2 rounded">
                  {(() => {
                    const acc = bankAccounts.find(a => a.id === selectedBankAccountId);
                    return acc ? (
                      <>
                        <p><span className="font-medium">Банк:</span> {acc.bank_name}</p>
                        <p><span className="font-medium">Р/с:</span> {acc.account}</p>
                        <p><span className="font-medium">БИК:</span> {acc.bik}</p>
                      </>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="paymentTerms">Условия оплаты</Label>
            <Textarea
              id="paymentTerms"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="Условия и сроки оплаты"
              rows={3}
            />
          </div>

          <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30">
            <CardContent className="pt-4 space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Реквизиты Исполнителя
              </h4>
              
              <div className="space-y-2">
                <Label htmlFor="executorName">Наименование</Label>
                <Input
                  id="executorName"
                  value={executorName}
                  onChange={(e) => setExecutorName(e.target.value)}
                  placeholder="ИП Фамилия И.О. или ООО «Название»"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="executorRepresentative">Представитель</Label>
                <Input
                  id="executorRepresentative"
                  value={executorRepresentative}
                  onChange={(e) => setExecutorRepresentative(e.target.value)}
                  placeholder="Директор Иванов И.И."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="executorBasis">Действует на основании</Label>
                <Select value={executorBasis} onValueChange={setExecutorBasis}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Устава">Устава</SelectItem>
                    <SelectItem value="Свидетельства о регистрации">Свидетельства о регистрации</SelectItem>
                    <SelectItem value="Доверенности №____ от __.__.20__">Доверенности</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label htmlFor="additionalTerms">Дополнительные условия</Label>
            <Textarea
              id="additionalTerms"
              value={additionalTerms}
              onChange={(e) => setAdditionalTerms(e.target.value)}
              placeholder="Любые дополнительные условия договора"
              rows={4}
            />
          </div>
        </TabsContent>

        {/* Сметы */}
        <TabsContent value="estimates" className="space-y-4">
          <div className="text-sm text-muted-foreground mb-2">Выберите сметы для включения в договор:</div>
          
          {estimates.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Нет доступных смет. Сначала создайте сметы.</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {estimates.map((estimate: any) => {
                const isSelected = selectedEstimateIds.includes(estimate.id);
                return (
                  <div
                    key={estimate.id}
                    className={`p-3 border rounded-lg transition-colors cursor-pointer ${
                      isSelected 
                        ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/40' 
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={() => toggleEstimate(estimate.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{estimate.event_name}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(estimate.event_date || estimate.event_start_date).toLocaleDateString('ru-RU')}
                          {' · '}
                          {estimate.venue || 'Площадка не указана'}
                        </div>
                        <div className="text-sm font-medium mt-1">
                          {estimate.total?.toLocaleString('ru-RU')} ₽
                          {' · '}
                          {estimate.items?.length || 0} позиций
                        </div>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          {selectedEstimateIds.length > 0 && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="font-medium mb-2">Итого по выбранным сметам:</div>
              <div className="text-2xl font-bold text-blue-600">
                {estimates
                  .filter((e: any) => selectedEstimateIds.includes(e.id))
                  .reduce((sum: number, e: any) => sum + (e.total || 0), 0)
                  .toLocaleString('ru-RU')} ₽
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Отмена</Button>
        <Button type="submit">{isEditing ? 'Сохранить изменения' : 'Создать договор'}</Button>
      </div>
    </form>
  );
}
