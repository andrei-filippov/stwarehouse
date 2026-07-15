import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { format } from 'date-fns';
import type { Staff } from '../../../types';

interface ProjectEntry {
  id: string;
  name: string;
  amount: string;
  date: string;
}

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff | null;
  onSubmit: (data: { name: string; amount: number; date: string }[]) => Promise<void>;
}

function createEmptyEntry(): ProjectEntry {
  return {
    id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  };
}

export function AddProjectDialog({ open, onOpenChange, staff, onSubmit }: AddProjectDialogProps) {
  const [entries, setEntries] = useState<ProjectEntry[]>([createEmptyEntry()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
    setEntries([createEmptyEntry()]);
  };

  const addEntry = () => {
    setEntries(prev => [...prev, createEmptyEntry()]);
  };

  const removeEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const updateEntry = (id: string, field: keyof ProjectEntry, value: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const handleSubmit = async () => {
    // Фильтруем только заполненные строки
    const validEntries = entries.filter(e => e.name.trim() && e.amount.trim() && parseFloat(e.amount) > 0);
    if (validEntries.length === 0) return;

    setIsSubmitting(true);
    await onSubmit(
      validEntries.map(e => ({
        name: e.name.trim(),
        amount: parseFloat(e.amount),
        date: e.date,
      }))
    );
    setIsSubmitting(false);
    setEntries([createEmptyEntry()]);
    onOpenChange(false);
  };

  const hasValidEntries = entries.some(e => e.name.trim() && e.amount.trim() && parseFloat(e.amount) > 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl w-[95%] rounded-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Добавить проект — {staff?.full_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_120px_140px_40px] gap-2 items-center text-sm text-muted-foreground px-1">
            <span>Название проекта / мероприятия</span>
            <span>Сумма (₽)</span>
            <span>Дата</span>
            <span></span>
          </div>

          {/* Entry rows */}
          {entries.map((entry, index) => (
            <div key={entry.id} className="grid grid-cols-[1fr_120px_140px_40px] gap-2 items-start">
              <Input
                placeholder="Например: Концерт в Крокусе"
                value={entry.name}
                onChange={(e) => updateEntry(entry.id, 'name', e.target.value)}
                className="w-full"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={entry.amount}
                onChange={(e) => updateEntry(entry.id, 'amount', e.target.value)}
                className="w-full"
              />
              <Input
                type="date"
                value={entry.date}
                onChange={(e) => updateEntry(entry.id, 'date', e.target.value)}
                className="w-full"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-destructive"
                onClick={() => removeEntry(entry.id)}
                disabled={entries.length === 1}
                title="Удалить строку"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Add row button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-1 border-dashed"
            onClick={addEntry}
          >
            <Plus className="h-4 w-4" />
            Добавить ещё проект
          </Button>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            className="w-full mt-2"
            disabled={isSubmitting || !hasValidEntries}
          >
            {isSubmitting
              ? 'Сохранение...'
              : `Добавить ${entries.filter(e => e.name.trim() && e.amount.trim() && parseFloat(e.amount) > 0).length} проект${entries.filter(e => e.name.trim() && e.amount.trim() && parseFloat(e.amount) > 0).length === 1 ? '' : entries.filter(e => e.name.trim() && e.amount.trim() && parseFloat(e.amount) > 0).length < 5 ? 'а' : 'ов'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
