import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase, safeChannel } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import type { Task } from '../types';

export function useGoals(companyId: string | undefined) {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user ID
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  const fetchTasks = useCallback(async (force = false) => {
    if (!companyId) return;

    const cacheKey = `fetchTasks_${companyId}`;
    if (!force) {
      const cached = getCached<any[]>(cacheKey);
      if (cached) { setAllTasks(cached); return; }
    }
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
      setAllTasks(data || []);
      setCached(cacheKey, data || []);
    }
    setLoading(false);
  }, [companyId]);

  // Filter tasks: public OR private owned by current user
  const tasks = useMemo(() => {
    if (!currentUserId) return [];
    return allTasks.filter(task => 
      !task.is_private || task.user_id === currentUserId
    );
  }, [allTasks, currentUserId]);

  // Active count for menu badge (pending + in_progress)
  const activeCount = useMemo(() => {
    return tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  }, [tasks]);

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

    const channel = safeChannel('goals-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'goals', filter: `company_id=eq.${companyId}` },
        () => { if (document.hidden) return; fetchTasks(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks, companyId]);

  return {
    tasks,
    loading,
    activeCount,
    addTask,
    updateTask,
    deleteTask,
    refresh: fetchTasks
  };
}
