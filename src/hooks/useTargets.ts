import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase, safeChannel } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import type { Target } from '../types/targets';
import type { Income, Expense } from '../types/finance';
import type { SalaryRecord } from './useSalary';
import type { Estimate } from '../types';

export function useTargets(
  companyId: string | undefined,
  estimates: Estimate[],
  expenses: Expense[],
  incomes: Income[],
  salaryRecords: SalaryRecord[]
) {
  const [allTargets, setAllTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  const fetchTargets = useCallback(async (force = false) => {
    if (!companyId) return;

    const cacheKey = `fetchTargets_${companyId}`;
    if (!force) {
      const cached = getCached<any[]>(cacheKey);
      if (cached) { setAllTargets(cached); return; }
    }
    setLoading(true);

    const { data, error } = await supabase
      .from('targets')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      toast.error('Ошибка при загрузке целей', { description: error.message });
    } else {
      setAllTargets(data || []);
      setCached(cacheKey, data || []);
    }
    setLoading(false);
  }, [companyId]);

  // Filter: public OR private owned by current user
  const targets = useMemo(() => {
    if (!currentUserId) return [];
    return allTargets.filter(t => !t.is_private || t.user_id === currentUserId);
  }, [allTargets, currentUserId]);

  // Calculate average monthly profit from finance data
  const avgMonthlyProfit = useMemo(() => {
    const months = new Set<string>();

    estimates
      .filter(e => e.status === 'completed' && e.event_date)
      .forEach(e => {
        const d = new Date(e.event_date!);
        months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      });

    incomes
      .filter(i => i.type === 'manual' && i.date)
      .forEach(i => {
        const d = new Date(i.date);
        months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      });

    expenses
      .filter(e => e.date)
      .forEach(e => {
        const d = new Date(e.date);
        months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      });

    salaryRecords.forEach(r => months.add(r.month));

    const monthCount = months.size || 1;

    const totalIncome = estimates
      .filter(e => e.status === 'completed')
      .reduce((sum, e) => sum + (e.total || 0), 0)
      + incomes
        .filter(i => i.type === 'manual')
        .reduce((sum, i) => sum + (i.amount || 0), 0);

    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalSalary = salaryRecords.reduce((sum, r) => sum + (r.paid || 0), 0);

    return (totalIncome - totalExpenses - totalSalary) / monthCount;
  }, [estimates, expenses, incomes, salaryRecords]);

  const activeCount = useMemo(() => {
    return targets.filter(t => t.status === 'active').length;
  }, [targets]);

  const addTarget = useCallback(async (target: Partial<Target>) => {
    if (!companyId) return { error: new Error('No company selected') };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const tempId = crypto.randomUUID();
      const optimisticTarget: Target = {
        id: tempId,
        title: target.title || '',
        description: target.description || null,
        target_amount: Number(target.target_amount) || 0,
        current_amount: Number(target.current_amount) || 0,
        target_date: target.target_date || null,
        priority: (target.priority as Target['priority']) || 'medium',
        allocation_percent: Number(target.allocation_percent) || 10,
        status: 'active',
        company_id: companyId,
        user_id: user?.id || currentUserId || '',
        is_private: target.is_private || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      setAllTargets(prev => [optimisticTarget, ...prev]);

      const { data, error } = await supabase
        .from('targets')
        .insert({
          ...target,
          company_id: companyId,
          user_id: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic target with real one
      if (data) {
        setAllTargets(prev => prev.map(t => t.id === tempId ? data : t));
      }

      toast.success('Цель добавлена');
      return { error: null };
    } catch (err: any) {
      // Rollback on error
      await fetchTargets(true);
      toast.error('Ошибка при добавлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchTargets, currentUserId]);

  const updateTarget = useCallback(async (id: string, updates: Partial<Target>) => {
    if (!companyId) return { error: new Error('No company selected') };

    const previousTarget = allTargets.find(t => t.id === id);

    try {
      // Optimistic update
      setAllTargets(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

      const { error } = await supabase
        .from('targets')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      toast.success('Цель обновлена');
      return { error: null };
    } catch (err: any) {
      // Rollback on error
      if (previousTarget) {
        setAllTargets(prev => prev.map(t => t.id === id ? previousTarget : t));
      }
      toast.error('Ошибка при обновлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, allTargets]);

  const deleteTarget = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };

    const previousTargets = [...allTargets];

    try {
      // Optimistic delete
      setAllTargets(prev => prev.filter(t => t.id !== id));

      const { error } = await supabase
        .from('targets')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      toast.success('Цель удалена');
      return { error: null };
    } catch (err: any) {
      // Rollback on error
      setAllTargets(previousTargets);
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId, allTargets]);

  // Contribute amount to target
  const contribute = useCallback(async (id: string, amount: number) => {
    if (!companyId) return { error: new Error('No company selected') };

    const target = allTargets.find(t => t.id === id);
    if (!target) return { error: new Error('Цель не найдена') };

    const previousTarget = { ...target };
    const newAmount = target.current_amount + amount;
    const status: Target['status'] = newAmount >= target.target_amount ? 'completed' : 'active';

    try {
      // Optimistic update
      setAllTargets(prev => prev.map(t => t.id === id ? { ...t, current_amount: newAmount, status } : t));

      const { error } = await supabase
        .from('targets')
        .update({ current_amount: newAmount, status })
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      if (status === 'completed') {
        toast.success('🎉 Цель достигнута!', { description: target.title });
      } else {
        toast.success(`Отложено ${amount.toLocaleString('ru-RU')} ₽ на цель`);
      }
      return { error: null };
    } catch (err: any) {
      // Rollback on error
      setAllTargets(prev => prev.map(t => t.id === id ? previousTarget : t));
      toast.error('Ошибка', { description: err.message });
      return { error: err };
    }
  }, [companyId, allTargets]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  useEffect(() => {
    if (!companyId) return;

    const channel = safeChannel('targets-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'targets', filter: `company_id=eq.${companyId}` },
        () => { if (document.hidden) return; fetchTargets(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTargets, companyId]);

  return {
    targets,
    loading,
    activeCount,
    avgMonthlyProfit,
    addTarget,
    updateTarget,
    deleteTarget,
    contribute,
    refresh: fetchTargets
  };
}
