import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Task } from '../types';

export function useGoals(companyId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(500);
    
    if (error) {
      toast.error('Ошибка при загрузке задач', { description: error.message });
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  }, [companyId]);

  const addTask = useCallback(async (task: Partial<Task>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('goals')
        .insert({ 
          ...task, 
          company_id: companyId,
          user_id: user?.id
        });

      if (error) throw error;

      await fetchTasks();
      toast.success('Задача добавлена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при добавлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchTasks]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('goals')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchTasks();
      toast.success('Задача обновлена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchTasks]);

  const deleteTask = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchTasks();
      toast.success('Задача удалена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchTasks]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('goals-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'goals', filter: `company_id=eq.${companyId}` },
        () => fetchTasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks, companyId]);

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    refresh: fetchTasks
  };
}
