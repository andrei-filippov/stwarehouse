import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Income } from '../types/finance';
import { createLogger } from '../lib/logger';

const logger = createLogger('incomes');

export function useIncomes(companyId: string | undefined) {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchIncomes = useCallback(async () => {
    if (!companyId) return;
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

    try {
      const { error, data } = await supabase
        .from('income')
        .insert(dataToInsert)
        .select();

      if (error) {
        logger.error('Error adding income:', error);
        throw error;
      }

      await fetchIncomes();
      toast.success('Поступление добавлено');
      return { error: null, data };
    } catch (err: any) {
      toast.error('Ошибка при добавлении поступления', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchIncomes]);

  const deleteIncome = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };

    try {
      const { error } = await supabase
        .from('income')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchIncomes();
      toast.success('Поступление удалено');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении поступления', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchIncomes]);

  useEffect(() => {
    fetchIncomes();
  }, [fetchIncomes]);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('income-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'income', filter: `company_id=eq.${companyId}` },
        () => fetchIncomes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchIncomes, companyId]);

  return {
    incomes,
    loading,
    addIncome,
    deleteIncome,
    refresh: fetchIncomes,
  };
}
