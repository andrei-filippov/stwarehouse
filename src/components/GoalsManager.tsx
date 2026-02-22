import { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle,
  Calendar,
  Filter,
  Target,
  User
} from 'lucide-react';
import type { Task } from '../types/goals';
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES } from '../types/goals';
import type { Staff } from '../types';
import { format, parseISO, isPast, isToday, isTomorrow, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Spinner } from './ui/spinner';

interface GoalsManagerProps {
  tasks: Task[];
  staff: Staff[];
  onAdd: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => Promise<{ error: any }>;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
  loading?: boolean;
}

export function GoalsManager({ tasks, staff, onAdd, onUpdate, onDelete, loading }: GoalsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState<Task['status'] | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<Task['category'] | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Task['priority'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => t.due_date < today && t.status !== 'completed' && t.status !== 'cancelled').length,
      today: tasks.filter(t => t.due_date === today).length,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesCategory = filterCategory === 'all' || task.category === filterCategory;
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
      const matchesSearch = 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesCategory && matchesPriority && matchesSearch;
    });
  }, [tasks, filterStatus, filterCategory, filterPriority, searchQuery]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      week: [],
      future: [],
      completed: [],
    };

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = addDays(today, 1).toISOString().split('T')[0];
    const weekLaterStr = addDays(today, 7).toISOString().split('T')[0];

    filteredTasks.forEach(task => {
      if (task.status === 'completed' || task.status === 'cancelled') {
        groups.completed.push(task);
      } else if (task.due_date < todayStr) {
        groups.overdue.push(task);
      } else if (task.due_date === todayStr) {
        groups.today.push(task);
      } else if (task.due_date === tomorrowStr) {
        groups.tomorrow.push(task);
      } else if (task.due_date <= weekLaterStr) {
        groups.week.push(task);
      } else {
        groups.future.push(task);
      }
    });

    return groups;
  }, [filteredTasks]);

  const handleOpenNew = () => {
    setEditingTask(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (data: any) => {
    if (editingTask) {
      await onUpdate(editingTask.id, data);
    } else {
      await onAdd(data);
    }
    setIsDialogOpen(false);
    setEditingTask(null);
  };

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await onUpdate(task.id, { status: newStatus });
  };

  const getCategoryLabel = (value: string) => TASK_CATEGORIES.find(c => c.value === value)?.label || value;
  const getPriorityLabel = (value: string) => TASK_PRIORITIES.find(p => p.value === value)?.label || value;
  const getStatusLabel = (value: string) => TASK_STATUSES.find(s => s.value === value)?.label || value;

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-600',
      medium: 'bg-blue-100 text-blue-600',
      high: 'bg-orange-100 text-orange-600',
      urgent: 'bg-red-100 text-red-600',
    };
    return colors[priority] || 'bg-gray-100';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      repair: 'bg-red-100 text-red-800',
      check: 'bg-blue-100 text-blue-800',
      wiring: 'bg-yellow-100 text-yellow-800',
      moving: 'bg-purple-100 text-purple-800',
      purchase: 'bg-green-100 text-green-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || 'bg-gray-100';
  };

  const renderTaskGroup = (title: string, tasks: Task[], colorClass: string = '') => {
    if (tasks.length === 0) return null;
    
    return (
      <div className="mb-6">
        <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${colorClass}`}>
          {title}
          <Badge variant="secondary">{tasks.length}</Badge>
        </h3>
        <div className="space-y-2">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              staff={staff}
              onToggle={() => handleToggleStatus(task)}
              onEdit={() => handleOpenEdit(task)}
              onDelete={() => onDelete(task.id)}
              getCategoryColor={getCategoryColor}
              getPriorityColor={getPriorityColor}
              getCategoryLabel={getCategoryLabel}
              getPriorityLabel={getPriorityLabel}
            />
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard 
          title="Всего" 
          value={stats.total} 
          icon={Target} 
          color="bg-blue-50 text-blue-600" 
        />
        <StatCard 
          title="На сегодня" 
          value={stats.today} 
          icon={Calendar} 
          color="bg-green-50 text-green-600" 
        />
        <StatCard 
          title="В работе" 
          value={stats.inProgress} 
          icon={Clock} 
          color="bg-yellow-50 text-yellow-600" 
        />
        <StatCard 
          title="Ожидают" 
          value={stats.pending} 
          icon={Circle} 
          color="bg-gray-50 text-gray-600" 
        />
        <StatCard 
          title="Выполнено" 
          value={stats.completed} 
          icon={CheckCircle2} 
          color="bg-green-50 text-green-600" 
        />
        <StatCard 
          title="Просрочено" 
          value={stats.overdue} 
          icon={AlertCircle} 
          color="bg-red-50 text-red-600" 
        />
      </div>

      {/* Фильтры */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <Input
                placeholder="Поиск по задачам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  {TASK_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as any)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Категория" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {TASK_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as any)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Приоритет" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все приоритеты</SelectItem>
                  {TASK_PRIORITIES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={handleOpenNew}>
                <Plus className="w-4 h-4 mr-2" />
                Новая задача
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Список задач */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Задачи
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Задачи не найдены</p>
              <p className="text-sm mt-1">Создайте новую задачу</p>
            </div>
          ) : (
            <div className="space-y-2">
              {renderTaskGroup('⚠️ Просрочено', groupedTasks.overdue, 'text-red-600')}
              {renderTaskGroup('📅 Сегодня', groupedTasks.today, 'text-green-600')}
              {renderTaskGroup('🔔 Завтра', groupedTasks.tomorrow, 'text-blue-600')}
              {renderTaskGroup('📆 На этой неделе', groupedTasks.week, 'text-purple-600')}
              {renderTaskGroup('📌 Позже', groupedTasks.future, 'text-gray-600')}
              {renderTaskGroup('✅ Выполнено / Отменено', groupedTasks.completed, 'text-gray-400')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Диалог создания/редактирования */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? 'Редактировать задачу' : 'Новая задача'}
            </DialogTitle>
          </DialogHeader>
          <TaskForm
            initialData={editingTask}
            staff={staff}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  return (
    <Card className={`${color} border-0`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-80">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <Icon className="w-8 h-8 opacity-50" />
        </div>
      </CardContent>
    </Card>
  );
}

interface TaskCardProps {
  task: Task;
  staff: Staff[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  getCategoryColor: (c: string) => string;
  getPriorityColor: (p: string) => string;
  getCategoryLabel: (c: string) => string;
  getPriorityLabel: (p: string) => string;
}

function TaskCard({ 
  task, staff, onToggle, onEdit, onDelete, 
  getCategoryColor, getPriorityColor, getCategoryLabel, getPriorityLabel 
}: TaskCardProps) {
  const assignedStaff = staff.find(s => s.id === task.assigned_to);
  const isCompleted = task.status === 'completed';
  const isOverdue = !isCompleted && task.due_date < new Date().toISOString().split('T')[0];

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
      isCompleted ? 'bg-gray-50 opacity-60' : isOverdue ? 'bg-red-50 border-red-200' : 'bg-white hover:bg-gray-50'
    }`}>
      <Checkbox 
        checked={isCompleted}
        onCheckedChange={onToggle}
        className="mt-1"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className={`font-medium ${isCompleted ? 'line-through text-gray-500' : ''}`}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge className={getCategoryColor(task.category)}>
            {getCategoryLabel(task.category)}
          </Badge>
          <Badge className={getPriorityColor(task.priority)}>
            {getPriorityLabel(task.priority)}
          </Badge>
          <Badge variant="outline" className={isOverdue ? 'text-red-600 border-red-300' : ''}>
            <Calendar className="w-3 h-3 mr-1" />
            {format(parseISO(task.due_date), 'dd MMM', { locale: ru })}
          </Badge>
          {assignedStaff && (
            <Badge variant="secondary">
              <User className="w-3 h-3 mr-1" />
              {assignedStaff.full_name}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

interface TaskFormProps {
  initialData: Task | null;
  staff: Staff[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

function TaskForm({ initialData, staff, onSubmit, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    category: initialData?.category || 'other',
    priority: initialData?.priority || 'medium',
    status: initialData?.status || 'pending',
    due_date: initialData?.due_date || new Date().toISOString().split('T')[0],
    assigned_to: initialData?.assigned_to || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Название задачи *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Например: Отвезти микшер в ремонт"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Описание</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Подробное описание задачи..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Категория</Label>
          <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v as any })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Приоритет</Label>
          <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v as any })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="due_date">Срок выполнения *</Label>
          <Input
            id="due_date"
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Назначено на</Label>
          <Select 
            value={formData.assigned_to || 'unassigned'} 
            onValueChange={(v) => setFormData({ ...formData, assigned_to: v === 'unassigned' ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите сотрудника" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Не назначено</SelectItem>
              {staff.filter(s => s.is_active).map(s => (
                <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {initialData && (
        <div className="space-y-2">
          <Label>Статус</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as any })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1">
          {initialData ? 'Сохранить' : 'Создать задачу'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
