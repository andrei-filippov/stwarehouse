import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Expense } from '../types';
import { createLogger } from '../lib/logger';

const logger = createLogger('expenses');

export function useExpenses(companyId: string | undefined) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchExpenses = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('company_id', companyId)
      .order('date', { ascending: false });
    
    if (error) {
      toast.error('Ошибка при загрузке расходов', { description: error.message });
    } else {
      setExpenses(data || []);
    }
    setLoading(false);
  }, [companyId]);

  const addExpense = useCallback(async (expense: Partial<Expense>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    // Подготавливаем данные для отправки
    const dataToInsert = {
      ...expense,
      company_id: companyId,
      // Убираем type если его нет в схеме
      ...(expense.type ? { type: expense.type } : {})
    };
    
    logger.debug('Adding expense:', dataToInsert);
    
    try {
      const { error, data } = await supabase
        .from('expenses')
        .insert(dataToInsert)
        .select();

      if (error) {
        logger.error('Supabase error:', error);
        throw error;
      }

      logger.info('Expense added:', data?.id);
      await fetchExpenses();
      toast.success('Расход добавлен');
      return { error: null, data };
    } catch (err: any) {
      logger.error('Add expense error:', err);
      toast.error('Ошибка при добавлении', { description: err.message || err.details || 'Неизвестная ошибка' });
      return { error: err };
    }
  }, [companyId, fetchExpenses]);

  const updateExpense = useCallback(async (id: string, updates: Partial<Expense>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchExpenses();
      toast.success('Расход обновлён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchExpenses]);

  const deleteExpense = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchExpenses();
      toast.success('Расход удалён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchExpenses]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('expenses-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'expenses', filter: `company_id=eq.${companyId}` },
        () => fetchExpenses()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchExpenses, companyId]);

  return {
    expenses,
    loading,
    addExpense,
    updateExpense,
    deleteExpense,
    refresh: fetchExpenses
  };
}
