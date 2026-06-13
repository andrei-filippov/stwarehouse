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

      const { error } = await supabase
        .from('targets')
        .insert({
          ...target,
          company_id: companyId,
          user_id: user?.id
        });

      if (error) throw error;

      await fetchTargets();
      toast.success('Цель добавлена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при добавлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchTargets]);

  const updateTarget = useCallback(async (id: string, updates: Partial<Target>) => {
    if (!companyId) return { error: new Error('No company selected') };

    try {
      const { error } = await supabase
        .from('targets')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchTargets();
      toast.success('Цель обновлена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchTargets]);

  const deleteTarget = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };

    try {
      const { error } = await supabase
        .from('targets')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchTargets();
      toast.success('Цель удалена');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchTargets]);

  // Contribute amount to target
  const contribute = useCallback(async (id: string, amount: number) => {
    if (!companyId) return { error: new Error('No company selected') };

    try {
      const target = allTargets.find(t => t.id === id);
      if (!target) throw new Error('Цель не найдена');

      const newAmount = target.current_amount + amount;
      const status: Target['status'] = newAmount >= target.target_amount ? 'completed' : 'active';

      const { error } = await supabase
        .from('targets')
        .update({ current_amount: newAmount, status })
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchTargets();
      if (status === 'completed') {
        toast.success('🎉 Цель достигнута!', { description: target.title });
      } else {
        toast.success(`Отложено ${amount.toLocaleString('ru-RU')} ₽ на цель`);
      }
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка', { description: err.message });
      return { error: err };
    }
  }, [companyId, allTargets, fetchTargets]);

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
