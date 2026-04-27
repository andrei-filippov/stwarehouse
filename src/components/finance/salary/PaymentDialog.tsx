import { useState, useMemo } from 'react';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { format } from 'date-fns';
import type { Staff } from '../../../types';
import type { SalaryRecord } from '../../../hooks/useSalary';
import { PaymentType, getPaymentTypeLabel } from '../../../hooks/useSalary';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff | null;
  record: SalaryRecord | undefined;
  onSubmit: (data: { amount: number; date: string; type: PaymentType; notes?: string }) => Promise<void>;
}

export function PaymentDialog({ open, onOpenChange, staff, record, onSubmit }: PaymentDialogProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [type, setType] = useState<PaymentType>('regular');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculated = record?.total_calculated || 0;
  const paid = record?.paid || 0;
  const balance = calculated - paid;

  const isOverpayment = useMemo(() => {
    const val = parseFloat(amount);
    return !isNaN(val) && val > 0 && val > balance;
  }, [amount, balance]);

  const handleSubmit = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    setIsSubmitting(true);
    await onSubmit({ amount: val, date, type, notes: notes || undefined });
    setIsSubmitting(false);
    setAmount('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setType('regular');
    setNotes('');
    onOpenChange(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const handlePayFull = () => {
    if (balance > 0) {
      setAmount(balance.toString());
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Отметить выплату — {staff?.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {staff && (
            <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
              <p>Начислено: <span className="font-medium">{calculated.toLocaleString('ru-RU')} ₽</span></p>
              <p>Уже выдано: <span className="font-medium text-green-600">{paid.toLocaleString('ru-RU')} ₽</span></p>
              <p className="font-semibold">
                Остаток: <span className={balance > 0 ? 'text-amber-600' : 'text-green-600'}>
                  {balance.toLocaleString('ru-RU')} ₽
                </span>
              </p>
              {balance > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={handlePayFull}
                >
                  Выплатить остаток
                </Button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Тип выплаты</Label>
            <div className="flex gap-2 flex-wrap">
              {(['regular', 'advance', 'bonus'] as PaymentType[]).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={type === t ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setType(t)}
                >
                  {getPaymentTypeLabel(t)}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Сумма выплаты (₽)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Дата выплаты</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {isOverpayment && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              ⚠️ Выплата превышает начисленную сумму на {(parseFloat(amount) - balance).toLocaleString('ru-RU')} ₽
            </div>
          )}

          <div className="space-y-2">
            <Label>Примечание (необязательно)</Label>
            <Input
              placeholder="Например: через Сбербанк"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button 
            onClick={handleSubmit} 
            className="w-full"
            disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
          >
            {isSubmitting ? 'Сохранение...' : 'Отметить как выдано'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
