import { useState } from 'react';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { format } from 'date-fns';
import type { Staff } from '../../../types';

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff | null;
  onSubmit: (data: { name: string; amount: number; date: string }) => Promise<void>;
}

export function AddProjectDialog({ open, onOpenChange, staff, onSubmit }: AddProjectDialogProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name || !amount) return;
    setIsSubmitting(true);
    await onSubmit({ name, amount: parseFloat(amount), date });
    setIsSubmitting(false);
    setName('');
    setAmount('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    onOpenChange(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-[95%] rounded-xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Добавить проект — {staff?.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Название проекта / мероприятия</Label>
            <Input
              placeholder="Например: Концерт в Крокусе"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Сумма (₽)</Label>
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
              <Label>Дата</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <Button 
            onClick={handleSubmit} 
            className="w-full"
            disabled={isSubmitting || !name || !amount || parseFloat(amount) <= 0}
          >
            {isSubmitting ? 'Сохранение...' : 'Добавить проект'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
