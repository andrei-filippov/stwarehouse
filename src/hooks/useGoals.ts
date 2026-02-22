import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Task } from '../types/goals';

export function useGoals(userId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true })
      .order('priority', { ascending: false });
    
    if (error) {
      toast.error('Ошибка при загрузке задач', { description: error.message });
    } else if (data) {
      setTasks(data as Task[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = async (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    const taskData: any = {
      title: task.title,
      user_id: userId
    };
    
    if (task.description) taskData.description = task.description;
    if (task.category) taskData.category = task.category;
    if (task.priority) taskData.priority = task.priority;
    if (task.status) taskData.status = task.status;
    if (task.due_date) taskData.due_date = task.due_date;
    if (task.assigned_to) taskData.assigned_to = task.assigned_to;
    
    const { data, error } = await supabase
      .from('goals')
      .insert([taskData])
      .select()
      .single();
    
    if (error) {
      toast.error('Ошибка при добавлении задачи', { description: error.message });
    } else if (data) {
      setTasks(prev => [...prev, data as Task]);
      toast.success('Задача добавлена', { description: task.title });
    }
    return { error, data };
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const updateData: any = { ...updates, updated_at: new Date().toISOString() };
    
    if (updates.status === 'completed' && !updates.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from('goals')
      .update(updateData)
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка при обновлении задачи', { description: error.message });
    } else {
      setTasks(prev => prev.map(t => 
        t.id === id ? { ...t, ...updates } : t
      ));
      if (updates.status === 'completed') {
        toast.success('Задача выполнена!');
      }
    }
    return { error };
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка при удалении задачи', { description: error.message });
    } else {
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success('Задача удалена');
    }
    return { error };
  };

  const getStats = () => {
    const today = new Date().toISOString().split('T')[0];
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => t.due_date < today && t.status !== 'completed' && t.status !== 'cancelled').length,
      today: tasks.filter(t => t.due_date === today).length,
    };
  };

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    getStats,
    refresh: fetchTasks,
  };
}
