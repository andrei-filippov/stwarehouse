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
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarIcon, Plus, Trash2, List, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Act, ActItem, ActStatus, Contract, Invoice } from '../types';
import { ACT_STATUS_LABELS } from '../types';

interface ActFormProps {
  act?: Act | null;
  contract: Contract;
  invoices: Invoice[];
  onSave: (act: Partial<Act>, items: Partial<ActItem>[]) => Promise<void>;
  onCancel: () => void;
  getNextNumber: (year: number) => Promise<string>;
}

export function ActForm({ 
  act, 
  contract, 
  invoices,
  onSave, 
  onCancel,
  getNextNumber 
}: ActFormProps) {
  const [formData, setFormData] = useState<Partial<Act>>({
    contract_id: contract.id,
    date: new Date().toISOString().split('T')[0],
    status: 'draft' as ActStatus,
    vat_rate: 0,
    amount: contract.total_amount,
    vat_amount: 0,
    total_amount: contract.total_amount,
    period_start: contract.event_start_date || new Date().toISOString().split('T')[0],
    period_end: contract.event_end_date || new Date().toISOString().split('T')[0],
  });
  
  const [items, setItems] = useState<Partial<ActItem>[]>([]);
  const [useSubject, setUseSubject] = useState(false); // false - позиции, true - предмет договора
  const [loading, setLoading] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    if (act) {
      setFormData({
        ...act,
      });
      setItems(act.items || []);
    } else {
      // Генерируем номер для нового акта
      const initNumber = async () => {
        const year = new Date().getFullYear();
        const number = await getNextNumber(year);
        setFormData(prev => ({ ...prev, number }));
      };
      initNumber();
      
      // Инициализируем позиции из смет договора
      const estimateItems = contract.estimates?.flatMap(ee => 
        ee.estimate?.items?.map(item => ({
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          total: item.quantity * item.price,
        })) || []
      ) || [];
      
      if (estimateItems.length > 0) {
        setItems(estimateItems);
      } else {
        // Добавляем одну пустую позицию
        setItems([{ name: '', quantity: 1, unit: 'шт', price: 0, total: 0 }]);
      }
    }
  }, [act, contract, getNextNumber]);

  // Пересчет сумм при изменении ставки НДС
  useEffect(() => {
    const vatRate = formData.vat_rate || 0;
    const amount = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const vatAmount = Math.round(amount * vatRate / 100 * 100) / 100;
    const total = amount + vatAmount;
    
    setFormData(prev => ({
      ...prev,
      amount,
      vat_amount: vatAmount,
      total_amount: total,
    }));
  }, [items, formData.vat_rate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Если используем предмет договора, передаем пустой массив позиций
    await onSave(formData, useSubject ? [] : items);
    setLoading(false);
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, unit: 'шт', price: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ActItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Пересчитываем сумму если изменили количество или цену
    if (field === 'quantity' || field === 'price') {
      const qty = field === 'quantity' ? value : newItems[index].quantity;
      const price = field === 'price' ? value : newItems[index].price;
      newItems[index].total = (qty || 0) * (price || 0);
    }
    
    setItems(newItems);
  };

  const vatOptions = [
    { value: 0, label: 'Без НДС' },
    { value: 20, label: '20%' },
    { value: 10, label: '10%' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Номер акта */}
        <div className="space-y-2">
          <Label htmlFor="number">Номер акта</Label>
          <Input
            id="number"
            value={formData.number || ''}
            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            placeholder="001-2025А"
            required
          />
        </div>

        {/* Дата акта */}
        <div className="space-y-2">
          <Label>Дата акта</Label>
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

      {/* Связанный счет */}
      <div className="space-y-2">
        <Label>Связанный счет</Label>
        <Select
          value={formData.invoice_id || 'none'}
          onValueChange={(value) => setFormData({ ...formData, invoice_id: value === 'none' ? undefined : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите счет (необязательно)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Без связи со счетом</SelectItem>
            {invoices.map((inv) => (
              <SelectItem key={inv.id} value={inv.id}>
                Счет № {inv.number} от {format(new Date(inv.date), 'dd.MM.yyyy')} — {inv.total_amount.toLocaleString('ru-RU')} ₽
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        </CardContent>
      </Card>

      {/* Период выполнения работ */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Начало периода</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.period_start && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.period_start ? (
                  format(new Date(formData.period_start), 'dd.MM.yyyy', { locale: ru })
                ) : (
                  <span>Дата начала</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.period_start ? new Date(formData.period_start) : undefined}
                onSelect={(date) => setFormData({ ...formData, period_start: date?.toISOString().split('T')[0] })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Окончание периода</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.period_end && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.period_end ? (
                  format(new Date(formData.period_end), 'dd.MM.yyyy', { locale: ru })
                ) : (
                  <span>Дата окончания</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.period_end ? new Date(formData.period_end) : undefined}
                onSelect={(date) => setFormData({ ...formData, period_end: date?.toISOString().split('T')[0] })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Предмет договора */}
      {contract.subject && (
        <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
          <Label className="text-muted-foreground">Предмет договора</Label>
          <p className="text-sm font-medium">{contract.subject}</p>
        </div>
      )}

      {/* Переключатель: Позиции или Предмет */}
      <div className="flex items-center justify-between">
        <Label>Содержание акта</Label>
        <ToggleGroup
          type="single"
          value={useSubject ? 'subject' : 'items'}
          onValueChange={(value) => value && setUseSubject(value === 'subject')}
        >
          <ToggleGroupItem value="items" aria-label="Список позиций">
            <List className="w-4 h-4 mr-1" />
            Позиции
          </ToggleGroupItem>
          <ToggleGroupItem value="subject" aria-label="Предмет договора">
            <FileText className="w-4 h-4 mr-1" />
            Предмет
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Позиции акта */}
      {!useSubject && (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>Выполненные работы / оказанные услуги</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="w-4 h-4 mr-1" />
            Добавить
          </Button>
        </div>
        
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-start p-2 border rounded">
              <div className="col-span-4">
                <Input
                  placeholder="Наименование"
                  value={item.name || ''}
                  onChange={(e) => updateItem(index, 'name', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Input
                  placeholder="Ед."
                  value={item.unit || 'шт'}
                  onChange={(e) => updateItem(index, 'unit', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  placeholder="Кол-во"
                  value={item.quantity || ''}
                  onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  placeholder="Цена"
                  value={item.price || ''}
                  onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="col-span-1">
                <Input
                  type="number"
                  value={item.total?.toFixed(2) || '0.00'}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Ставка НДС */}
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

      {/* Итоговые суммы */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Сумма без НДС</Label>
          <Input
            type="number"
            value={formData.amount?.toFixed(2) || '0.00'}
            disabled
            className="bg-muted"
          />
        </div>
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
          <Label className="font-semibold">Всего</Label>
          <Input
            type="number"
            value={formData.total_amount?.toFixed(2) || '0.00'}
            disabled
            className="bg-muted font-semibold"
          />
        </div>
      </div>

      {/* Примечания */}
      <div className="space-y-2">
        <Label htmlFor="notes">Примечания</Label>
        <Textarea
          id="notes"
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Дополнительная информация..."
          className="min-h-[80px]"
        />
      </div>

      {/* Статус */}
      <div className="space-y-2">
        <Label htmlFor="status">Статус</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => setFormData({ ...formData, status: value as ActStatus })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите статус" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ACT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Кнопки */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Сохранение...' : act ? 'Сохранить' : 'Создать акт'}
        </Button>
      </div>
    </form>
  );
}
