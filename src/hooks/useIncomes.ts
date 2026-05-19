import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useRealtimeWithFallback } from './useRealtimeWithFallback';
import { getCached, setCached } from '../lib/queryCache';
import type { Income } from '../types/finance';
import { createLogger } from '../lib/logger';

const logger = createLogger('incomes');

export function useIncomes(companyId: string | undefined) {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchIncomes = useCallback(async (force = false) => {
    if (!companyId) return;

    const cacheKey = `fetchIncomes_${companyId}`;
    if (!force) {
      const cached = getCached<any[]>(cacheKey);
      if (cached) { setIncomes(cached); return; }
    }
    setLoading(true);

    const { data, error } = await supabase
      .from('income')
      .select('*')
      .eq('company_id', companyId)
      .order('date', { ascending: false });

    if (error) {
      toast.error('Ошибка при загрузке доходов', { description: error.message });
    } else {
      setIncomes(data || []);
      setCached(cacheKey, data || []);
    }
    setLoading(false);
  }, [companyId]);

  const addIncome = useCallback(async (income: Partial<Income>) => {
    if (!companyId) return { error: new Error('No company selected') };

    const dataToInsert = {
      ...income,
      company_id: companyId,
      type: income.type || 'manual',
    };

    logger.debug('Adding income:', dataToInsert);

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const optimisticIncome = { ...dataToInsert, id: tempId, created_at: new Date().toISOString() } as Income;
    setIncomes(prev => [optimisticIncome, ...prev]);
    
    try {
      const { error, data } = await supabase
        .from('income')
        .insert(dataToInsert)
        .select()
        .single();

      if (error) {
        logger.error('Error adding income:', error);
        throw error;
      }

      setIncomes(prev => prev.map(i => i.id === tempId ? data : i));
      toast.success('Поступление добавлено');
      return { error: null, data };
    } catch (err: any) {
      setIncomes(prev => prev.filter(i => i.id !== tempId));
      toast.error('Ошибка при добавлении поступления', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchIncomes]);

  const deleteIncome = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };

    // Optimistic delete
    const prevIncomes = incomes;
    setIncomes(prev => prev.filter(i => i.id !== id));
    
    try {
      const { error } = await supabase
        .from('income')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      toast.success('Поступление удалено');
      return { error: null };
    } catch (err: any) {
      setIncomes(prevIncomes);
      toast.error('Ошибка при удалении поступления', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchIncomes]);

  useEffect(() => {
    fetchIncomes();
  }, [fetchIncomes]);

  useRealtimeWithFallback({
    channelName: 'income-changes',
    companyId,
    tables: [
      { table: 'income', filter: `company_id=eq.${companyId}`, onChange: () => fetchIncomes() },
    ],
    pollingIntervalMs: 300000, // 5 min
  });

  return {
    incomes,
    loading,
    addIncome,
    deleteIncome,
    refresh: fetchIncomes,
  };
}
