import { useState, useMemo, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
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
  Target,
  User,
  X
} from 'lucide-react';
import type { Task } from '../types/goals';
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES } from '../types/goals';
import type { Staff } from '../types';
import type { Profile } from '../types';
import { format, parseISO, isPast, isToday, isTomorrow, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

import { Spinner } from './ui/spinner';

interface GoalsManagerProps {
  tasks: Task[];
  staff: Staff[];
  onAdd: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => Promise<{ error: any }>;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
  loading?: boolean;
}

type FilterType = 'all' | 'today' | 'in_progress' | 'pending' | 'completed' | 'overdue';

export function GoalsManager({ tasks, staff, onAdd, onUpdate, onDelete, loading }: GoalsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [userProfiles, setUserProfiles] = useState<Record<string, Profile>>({});

  // Загружаем профили пользователей (создателей задач)
  useEffect(() => {
    const loadProfiles = async () => {
      const userIds = [...new Set(tasks.map(t => t.user_id).filter(Boolean))];
      if (userIds.length === 0) return;

      const { data } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (data) {
        const profileMap = data.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, Profile>);
        setUserProfiles(profileMap);
      }
    };

    loadProfiles();
  }, [tasks]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => t.due_date < today && t.status !== 'completed' && t.status !== 'cancelled').length,
      today: tasks.filter(t => t.due_date === today && t.status !== 'completed' && t.status !== 'cancelled').length,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const today = new Date().toISOString().split('T')[0];
      
      // Фильтр по плитке
      const matchesFilter = (() => {
        switch (activeFilter) {
          case 'today':
            return task.due_date === today && task.status !== 'completed' && task.status !== 'cancelled';
          case 'in_progress':
            return task.status === 'in_progress';
          case 'pending':
            return task.status === 'pending';
          case 'completed':
            return task.status === 'completed';
          case 'overdue':
            return task.due_date < today && task.status !== 'completed' && task.status !== 'cancelled';
          case 'all':
          default:
            return true;
        }
      })();

      // Поиск по тексту
      const matchesSearch = 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesFilter && matchesSearch;
    });
  }, [tasks, activeFilter, searchQuery]);

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
      purchase: 'bg-green-100 text-green-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || 'bg-gray-100';
  };

  const getFilterLabel = (filter: FilterType): string => {
    const labels: Record<FilterType, string> = {
      all: 'Все задачи',
      today: 'На сегодня',
      in_progress: 'В работе',
      pending: 'Ожидают',
      completed: 'Выполнено',
      overdue: 'Просрочено',
    };
    return labels[filter];
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
              userProfiles={userProfiles}
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
      {/* Кликабельная статистика */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard 
          title="Всего" 
          value={stats.total} 
          icon={Target} 
          color="bg-blue-50 text-blue-600" 
          isActive={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
        />
        <StatCard 
          title="На сегодня" 
          value={stats.today} 
          icon={Calendar} 
          color="bg-green-50 text-green-600" 
          isActive={activeFilter === 'today'}
          onClick={() => setActiveFilter('today')}
        />
        <StatCard 
          title="В работе" 
          value={stats.inProgress} 
          icon={Clock} 
          color="bg-yellow-50 text-yellow-600" 
          isActive={activeFilter === 'in_progress'}
          onClick={() => setActiveFilter('in_progress')}
        />
        <StatCard 
          title="Ожидают" 
          value={stats.pending} 
          icon={Circle} 
          color="bg-gray-50 text-gray-600" 
          isActive={activeFilter === 'pending'}
          onClick={() => setActiveFilter('pending')}
        />
        <StatCard 
          title="Выполнено" 
          value={stats.completed} 
          icon={CheckCircle2} 
          color="bg-emerald-50 text-emerald-600" 
          isActive={activeFilter === 'completed'}
          onClick={() => setActiveFilter('completed')}
        />
        <StatCard 
          title="Просрочено" 
          value={stats.overdue} 
          icon={AlertCircle} 
          color="bg-red-50 text-red-600" 
          isActive={activeFilter === 'overdue'}
          onClick={() => setActiveFilter('overdue')}
        />
      </div>

      {/* Активный фильтр и поиск */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Индикатор активного фильтра */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Фильтр:</span>
              <Badge 
                variant={activeFilter === 'all' ? 'secondary' : 'default'}
                className="cursor-pointer"
                onClick={() => setActiveFilter('all')}
              >
                {getFilterLabel(activeFilter)}
                {activeFilter !== 'all' && (
                  <X className="w-3 h-3 ml-1" onClick={(e) => { e.stopPropagation(); setActiveFilter('all'); }} />
                )}
              </Badge>
            </div>
            
            {/* Поиск */}
            <div className="flex-1">
              <Input
                placeholder="Поиск по задачам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            
            {/* Кнопка добавления */}
            <Button onClick={handleOpenNew} className="shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              Новая задача
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Список задач */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            {getFilterLabel(activeFilter)}
            <Badge variant="secondary">{filteredTasks.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Задачи не найдены</p>
              <p className="text-sm mt-1">Создайте новую задачу или измените фильтр</p>
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

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  isActive?: boolean;
  onClick?: () => void;
}

function StatCard({ title, value, icon: Icon, color, isActive, onClick }: StatCardProps) {
  return (
    <Card 
      className={`${color} border-0 cursor-pointer transition-all hover:scale-105 ${
        isActive ? 'ring-2 ring-offset-2 ring-blue-500' : ''
      }`}
      onClick={onClick}
    >
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
  userProfiles: Record<string, Profile>;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  getCategoryColor: (c: string) => string;
  getPriorityColor: (p: string) => string;
  getCategoryLabel: (c: string) => string;
  getPriorityLabel: (p: string) => string;
}

function TaskCard({ 
  task, staff, userProfiles, onToggle, onEdit, onDelete, 
  getCategoryColor, getPriorityColor, getCategoryLabel, getPriorityLabel 
}: TaskCardProps) {
  const assignedStaff = staff.find(s => s.id === task.assigned_to);
  const creator = task.user_id ? userProfiles[task.user_id] : null;
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
            
            {/* Метки и создатель */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge className={getCategoryColor(task.category)}>
                {getCategoryLabel(task.category)}
              </Badge>
              <Badge className={getPriorityColor(task.priority)}>
                {getPriorityLabel(task.priority)}
              </Badge>
              
              {/* Создатель задачи */}
              {creator && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <User className="w-3 h-3" />
                  <span>Создал: {creator.name || creator.email || 'Неизвестно'}</span>
                </div>
              )}
              
              {/* Исполнитель */}
              {assignedStaff && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <User className="w-3 h-3" />
                  <span>Исполнитель: {assignedStaff.name}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Дата и действия */}
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
              {format(parseISO(task.due_date), 'dd.MM.yyyy', { locale: ru })}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// TaskForm компонент остаётся без изменений
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
      <div>
        <label className="text-sm font-medium">Название *</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Введите название задачи"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium">Описание</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Описание задачи"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Категория</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full border rounded-md p-2"
          >
            {TASK_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Приоритет</label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="w-full border rounded-md p-2"
          >
            {TASK_PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Срок выполнения</label>
          <Input
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium">Исполнитель</label>
          <select
            value={formData.assigned_to}
            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
            className="w-full border rounded-md p-2"
          >
            <option value="">Не назначен</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {initialData && (
        <div>
          <label className="text-sm font-medium">Статус</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full border rounded-md p-2"
          >
            {TASK_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit">
          {initialData ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </form>
  );
}
