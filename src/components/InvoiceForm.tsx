import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarIcon, Calculator } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Invoice, InvoiceStatus, Contract } from '../types';
import { INVOICE_STATUS_LABELS } from '../types';

interface InvoiceFormProps {
  invoice?: Invoice | null;
  contract: Contract;
  onSave: (invoice: Partial<Invoice>) => Promise<void>;
  onCancel: () => void;
  getNextNumber: (year: number) => Promise<string>;
}

export function InvoiceForm({ 
  invoice, 
  contract, 
  onSave, 
  onCancel,
  getNextNumber 
}: InvoiceFormProps) {
  const [formData, setFormData] = useState<Partial<Invoice>>({
    contract_id: contract.id,
    date: new Date().toISOString().split('T')[0],
    status: 'draft' as InvoiceStatus,
    vat_rate: 0,
    amount: contract.total_amount,
    vat_amount: 0,
    total_amount: contract.total_amount,
    description: `Оплата по договору № ${contract.number} от ${format(new Date(contract.date), 'dd.MM.yyyy')}${contract.subject ? ' (' + contract.subject + ')' : ''}`,
  });
  
  const [loading, setLoading] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);

  useEffect(() => {
    if (invoice) {
      setFormData({
        ...invoice,
      });
    } else {
      // Генерируем номер для нового счета
      const initNumber = async () => {
        const year = new Date().getFullYear();
        const number = await getNextNumber(year);
        setFormData(prev => ({ ...prev, number }));
      };
      initNumber();
    }
  }, [invoice, getNextNumber]);

  // Пересчет сумм при изменении ставки НДС или суммы
  useEffect(() => {
    const amount = formData.amount || 0;
    const vatRate = formData.vat_rate || 0;
    const vatAmount = Math.round(amount * vatRate / 100 * 100) / 100;
    const total = amount + vatAmount;
    
    setFormData(prev => ({
      ...prev,
      vat_amount: vatAmount,
      total_amount: total,
    }));
  }, [formData.amount, formData.vat_rate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave(formData);
    setLoading(false);
  };

  const vatOptions = [
    { value: 0, label: 'Без НДС' },
    { value: 5, label: '5%' },
    { value: 10, label: '10%' },
    { value: 20, label: '20%' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Номер счета */}
        <div className="space-y-2">
          <Label htmlFor="number">Номер счета</Label>
          <Input
            id="number"
            value={formData.number || ''}
            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            placeholder="001-2025"
            required
          />
        </div>

        {/* Дата счета */}
        <div className="space-y-2">
          <Label>Дата счета</Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.date ? (
                  format(new Date(formData.date), 'dd.MM.yyyy', { locale: ru })
                ) : (
                  <span>Выберите дату</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.date ? new Date(formData.date) : undefined}
                onSelect={(date) => {
                  setFormData({ ...formData, date: date?.toISOString().split('T')[0] });
                  setDateOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Информация о договоре */}
      <Card className="bg-muted/50">
        <CardContent className="p-4 space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Договор:</span>{' '}
            <span className="font-medium">№ {contract.number}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Заказчик:</span>{' '}
            <span className="font-medium">{contract.customer?.name}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Сумма договора:</span>{' '}
            <span className="font-medium">{contract.total_amount.toLocaleString('ru-RU')} ₽</span>
          </div>
        </CardContent>
      </Card>

      {/* Суммы */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Сумма без НДС</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            value={formData.amount || ''}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vat_rate">Ставка НДС</Label>
          <Select
            value={String(formData.vat_rate)}
            onValueChange={(value) => setFormData({ ...formData, vat_rate: parseFloat(value) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите ставку НДС" />
            </SelectTrigger>
            <SelectContent>
              {vatOptions.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Расчетные поля */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Сумма НДС</Label>
          <Input
            type="number"
            value={formData.vat_amount?.toFixed(2) || '0.00'}
            disabled
            className="bg-muted"
          />
        </div>

        <div className="space-y-2">
          <Label className="font-semibold">Всего к оплате</Label>
          <Input
            type="number"
            value={formData.total_amount?.toFixed(2) || '0.00'}
            disabled
            className="bg-muted font-semibold"
          />
        </div>
      </div>

      {/* Срок оплаты */}
      <div className="space-y-2">
        <Label>Срок оплаты</Label>
        <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !formData.due_date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.due_date ? (
                format(new Date(formData.due_date), 'dd.MM.yyyy', { locale: ru })
              ) : (
                <span>Укажите срок оплаты</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={formData.due_date ? new Date(formData.due_date) : undefined}
              onSelect={(date) => {
                setFormData({ ...formData, due_date: date?.toISOString().split('T')[0] });
                setDueDateOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Назначение платежа */}
      <div className="space-y-2">
        <Label htmlFor="description">Назначение платежа</Label>
        <Textarea
          id="description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Оплата по договору..."
          className="min-h-[80px]"
        />
      </div>

      {/* Статус */}
      <div className="space-y-2">
        <Label htmlFor="status">Статус</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => setFormData({ ...formData, status: value as InvoiceStatus })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите статус" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Дата оплаты (если оплачен) */}
      {formData.status === 'paid' && (
        <div className="space-y-2">
          <Label>Дата оплаты</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.paid_date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.paid_date ? (
                  format(new Date(formData.paid_date), 'dd.MM.yyyy', { locale: ru })
                ) : (
                  <span>Укажите дату оплаты</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.paid_date ? new Date(formData.paid_date) : undefined}
                onSelect={(date) => setFormData({ ...formData, paid_date: date?.toISOString().split('T')[0] })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Кнопки */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Сохранение...' : invoice ? 'Сохранить' : 'Создать счет'}
        </Button>
      </div>
    </form>
  );
}
