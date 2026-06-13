import { useState, useMemo, useCallback, memo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import {
  Plus,
  Trash2,
  Edit2,
  Target,
  TrendingUp,
  Lock,
  AlertTriangle,
  PiggyBank,
  CheckCircle2
} from 'lucide-react';
import type { Target } from '../types/targets';
import {
  TARGET_PRIORITIES,
  TARGET_STATUS_LABELS,
  TARGET_STATUS_COLORS,
  calculateMonthsToTarget,
  calculateTargetDate
} from '../types/targets';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Spinner } from './ui/spinner';

interface TargetsManagerProps {
  targets: Target[];
  avgMonthlyProfit: number;
  onAdd: (target: Omit<Target, 'id' | 'created_at' | 'updated_at'>) => Promise<{ error: any }>;
  onUpdate: (id: string, updates: Partial<Target>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
  onContribute: (id: string, amount: number) => Promise<{ error: any }>;
  loading?: boolean;
}

export const TargetsManager = memo(function TargetsManager({
  targets,
  avgMonthlyProfit,
  onAdd,
  onUpdate,
  onDelete,
  onContribute,
  loading
}: TargetsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<Target | null>(null);
  const [contributeTarget, setContributeTarget] = useState<Target | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');

  const handleOpenNew = useCallback(() => {
    setEditingTarget(null);
    setIsDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((target: Target) => {
    setEditingTarget(target);
    setIsDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(async (data: any) => {
    if (editingTarget) {
      await onUpdate(editingTarget.id, data);
    } else {
      await onAdd(data);
    }
    setIsDialogOpen(false);
    setEditingTarget(null);
  }, [editingTarget, onAdd, onUpdate]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmTarget?.id) return;
    await onDelete(deleteConfirmTarget.id);
    setDeleteConfirmTarget(null);
  }, [deleteConfirmTarget, onDelete]);

  const handleContribute = useCallback(async () => {
    if (!contributeTarget?.id || !contributeAmount) return;
    const amount = parseFloat(contributeAmount);
    if (isNaN(amount) || amount <= 0) return;
    await onContribute(contributeTarget.id, amount);
    setContributeTarget(null);
    setContributeAmount('');
  }, [contributeTarget, contributeAmount, onContribute]);

  const filteredTargets = useMemo(() => {
    return targets.filter(t => t.status !== 'completed');
  }, [targets]);

  const completedTargets = useMemo(() => {
    return targets.filter(t => t.status === 'completed');
  }, [targets]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400">Активных целей</p>
                <p className="text-2xl font-bold">{filteredTargets.length}</p>
              </div>
              <Target className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 dark:text-green-400">Достигнуто</p>
                <p className="text-2xl font-bold">{completedTargets.length}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 dark:text-purple-400">Средняя маржа/мес</p>
                <p className="text-2xl font-bold">
                  {avgMonthlyProfit > 0 ? `${Math.round(avgMonthlyProfit).toLocaleString('ru-RU')} ₽` : '—'}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <Button onClick={handleOpenNew}>
          <Plus className="w-4 h-4 mr-2" />
          Новая цель
        </Button>
      </div>

      {/* Active targets */}
      <div className="space-y-3">
        {filteredTargets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Target className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Нет активных целей</p>
            <p className="text-sm mt-1">Создайте цель — например, «Купить новый микшер»</p>
          </div>
        ) : (
          filteredTargets.map(target => (
            <TargetCard
              key={target.id}
              target={target}
              avgMonthlyProfit={avgMonthlyProfit}
              onEdit={() => handleOpenEdit(target)}
              onDelete={() => setDeleteConfirmTarget(target)}
              onContribute={() => setContributeTarget(target)}
            />
          ))
        )}
      </div>

      {/* Completed targets */}
      {completedTargets.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Достигнутые цели
            <Badge variant="secondary">{completedTargets.length}</Badge>
          </h3>
          <div className="space-y-2 opacity-60">
            {completedTargets.map(target => (
              <TargetCard
                key={target.id}
                target={target}
                avgMonthlyProfit={avgMonthlyProfit}
                onEdit={() => handleOpenEdit(target)}
                onDelete={() => setDeleteConfirmTarget(target)}
                onContribute={() => {}}
                isCompleted
              />
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl w-[95%] rounded-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {editingTarget ? 'Редактировать цель' : 'Новая цель'}
            </DialogTitle>
            <DialogDescription>
              {editingTarget ? 'Измените данные цели' : 'Заполните форму для создания финансовой цели'}
            </DialogDescription>
          </DialogHeader>
          <TargetForm
            initialData={editingTarget}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirmTarget} onOpenChange={() => setDeleteConfirmTarget(null)}>
        <DialogContent className="max-w-md w-[95%] rounded-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Удалить цель?
            </DialogTitle>
            <DialogDescription>
              {deleteConfirmTarget && (
                <>Цель <strong>"{deleteConfirmTarget.title}"</strong> будет удалена безвозвратно.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmTarget(null)}>Отмена</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contribute dialog */}
      <Dialog open={!!contributeTarget} onOpenChange={() => setContributeTarget(null)}>
        <DialogContent className="max-w-md w-[95%] rounded-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-green-600" />
              Отложить на цель
            </DialogTitle>
            <DialogDescription>
              {contributeTarget && (
                <>"{contributeTarget.title}" — накоплено {contributeTarget.current_amount.toLocaleString('ru-RU')} ₽ из {contributeTarget.target_amount.toLocaleString('ru-RU')} ₽</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Сумма (₽)</label>
              <Input
                type="number"
                min={1}
                placeholder="Введите сумму"
                value={contributeAmount}
                onChange={(e) => setContributeAmount(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setContributeTarget(null)}>Отмена</Button>
            <Button onClick={handleContribute} disabled={!contributeAmount || parseFloat(contributeAmount) <= 0}>
              <PiggyBank className="w-4 h-4 mr-2" />
              Отложить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

// ─── Target Card ───

interface TargetCardProps {
  target: Target;
  avgMonthlyProfit: number;
  onEdit: () => void;
  onDelete: () => void;
  onContribute: () => void;
  isCompleted?: boolean;
}

function TargetCard({ target, avgMonthlyProfit, onEdit, onDelete, onContribute, isCompleted }: TargetCardProps) {
  const progress = target.target_amount > 0
    ? Math.min(100, (target.current_amount / target.target_amount) * 100)
    : 0;

  const monthsToTarget = calculateMonthsToTarget(
    target.target_amount,
    target.current_amount,
    avgMonthlyProfit,
    target.allocation_percent
  );

  const targetDate = calculateTargetDate(monthsToTarget);
  const priorityConfig = TARGET_PRIORITIES.find(p => p.value === target.priority);

  return (
    <Card className={`${isCompleted ? 'border-green-200' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Circular progress */}
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-muted/30"
              />
              <circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                className={progress >= 100 ? 'text-green-500' : progress >= 50 ? 'text-blue-500' : 'text-orange-500'}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold">{Math.round(progress)}%</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium flex items-center gap-2">
                  {target.title}
                  {target.is_private && <Lock className="w-3 h-3 text-amber-500" />}
                </h3>
                {target.description && (
                  <p className="text-sm text-muted-foreground mt-1">{target.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">
                  {target.current_amount.toLocaleString('ru-RU')} ₽ из {target.target_amount.toLocaleString('ru-RU')} ₽
                </span>
                <span className="font-medium">
                  {progress >= 100 ? '✅ Достигнута' : `${Math.round(progress)}%`}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-orange-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Badge className={priorityConfig?.color || ''}>
                {priorityConfig?.label} ({target.allocation_percent}%)
              </Badge>
              <Badge className={TARGET_STATUS_COLORS[target.status]}>
                {TARGET_STATUS_LABELS[target.status]}
              </Badge>
              {monthsToTarget !== null && !isCompleted && (
                <span className="text-xs text-muted-foreground">
                  {monthsToTarget === 0 ? '🎉 Уже достигнута!' : `~${monthsToTarget} мес.`}
                  {targetDate && ` (к ${format(targetDate, 'MMM yyyy', { locale: ru })})`}
                </span>
              )}
            </div>

            {/* Contribute button */}
            {!isCompleted && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={onContribute}
              >
                <PiggyBank className="w-4 h-4 mr-2" />
                Отложить
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Target Form ───

interface TargetFormProps {
  initialData: Target | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

function TargetForm({ initialData, onSubmit, onCancel }: TargetFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    target_amount: initialData?.target_amount || 0,
    current_amount: initialData?.current_amount || 0,
    priority: initialData?.priority || 'medium',
    allocation_percent: initialData?.allocation_percent || 10,
    status: initialData?.status || 'active',
    is_private: initialData?.is_private || false,
    target_date: initialData?.target_date || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formData.target_amount);
    if (!amount || amount <= 0) {
      toast.error('Укажите сумму цели больше 0');
      return;
    }
    onSubmit({
      ...formData,
      target_amount: amount,
      current_amount: Number(formData.current_amount),
      allocation_percent: Number(formData.allocation_percent),
    });
  };

  const priorityConfig = TARGET_PRIORITIES.find(p => p.value === formData.priority);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Название цели *</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Например: Купить микшер Yamaha QL1"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium">Описание</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Дополнительная информация"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Сумма цели (₽) *</label>
          <Input
            type="number"
            min={1}
            value={formData.target_amount || ''}
            onChange={(e) => setFormData({ ...formData, target_amount: e.target.value === '' ? 0 : Number(e.target.value) })}
            onFocus={(e) => e.target.select()}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Уже накоплено (₽)</label>
          <Input
            type="number"
            min={0}
            value={formData.current_amount || ''}
            onChange={(e) => setFormData({ ...formData, current_amount: e.target.value === '' ? 0 : Number(e.target.value) })}
            onFocus={(e) => e.target.select()}
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Приоритет</label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {TARGET_PRIORITIES.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setFormData({ ...formData, priority: p.value, allocation_percent: p.allocationPercent })}
              className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                formData.priority === p.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-muted hover:border-muted-foreground'
              }`}
            >
              <div>{p.label}</div>
              <div className="text-xs text-muted-foreground">{p.allocationPercent}% от маржи</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Желаемая дата</label>
          <Input
            type="date"
            value={formData.target_date}
            onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
          />
        </div>
        {initialData && (
          <div>
            <label className="text-sm font-medium">Статус</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Target['status'] })}
              className="w-full border rounded-md p-2"
            >
              <option value="active">Активна</option>
              <option value="paused">Приостановлена</option>
              <option value="completed">Достигнута</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
        <input
          type="checkbox"
          id="target_is_private"
          checked={formData.is_private}
          onChange={(e) => setFormData({ ...formData, is_private: e.target.checked })}
          className="w-4 h-4"
        />
        <label htmlFor="target_is_private" className="text-sm font-medium cursor-pointer flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          Личная цель (видна только мне)
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Отмена</Button>
        <Button type="submit">
          {initialData ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </form>
  );
}
