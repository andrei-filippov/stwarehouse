import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useRealtimeWithFallback } from './useRealtimeWithFallback';
import { getCached, setCached } from '../lib/queryCache';
import type { Expense } from '../types';
import { createLogger } from '../lib/logger';

const logger = createLogger('expenses');

export function useExpenses(companyId: string | undefined) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchExpenses = useCallback(async (force = false) => {
    if (!companyId) return;

    const cacheKey = `fetchExpenses_${companyId}`;
    if (!force) {
      const cached = getCached<any[]>(cacheKey);
      if (cached) { setExpenses(cached); return; }
    }
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
      setCached(cacheKey, data || []);
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
    
    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const optimisticExpense = { ...dataToInsert, id: tempId, created_at: new Date().toISOString() } as Expense;
    setExpenses(prev => [optimisticExpense, ...prev]);
    
    try {
      const { error, data } = await supabase
        .from('expenses')
        .insert(dataToInsert)
        .select()
        .single();

      if (error) {
        logger.error('Supabase error:', error);
        throw error;
      }

      logger.info('Expense added:', data?.id);
      setExpenses(prev => prev.map(e => e.id === tempId ? data : e));
      toast.success('Расход добавлен');
      return { error: null, data };
    } catch (err: any) {
      setExpenses(prev => prev.filter(e => e.id !== tempId));
      logger.error('Add expense error:', err);
      toast.error('Ошибка при добавлении', { description: err.message || err.details || 'Неизвестная ошибка' });
      return { error: err };
    }
  }, [companyId, fetchExpenses]);

  const updateExpense = useCallback(async (id: string, updates: Partial<Expense>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    // Optimistic update
    const prevExpense = expenses.find(e => e.id === id);
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    
    try {
      const { error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      toast.success('Расход обновлён');
      return { error: null };
    } catch (err: any) {
      if (prevExpense) setExpenses(prev => prev.map(e => e.id === id ? prevExpense : e));
      toast.error('Ошибка при обновлении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchExpenses]);

  const deleteExpense = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    // Optimistic delete
    const prevExpenses = expenses;
    setExpenses(prev => prev.filter(e => e.id !== id));
    
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      toast.success('Расход удалён');
      return { error: null };
    } catch (err: any) {
      setExpenses(prevExpenses);
      toast.error('Ошибка при удалении', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchExpenses]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useRealtimeWithFallback({
    channelName: 'expenses-changes',
    companyId,
    tables: [
      { table: 'expenses', filter: `company_id=eq.${companyId}`, onChange: () => fetchExpenses() },
    ],
    pollingIntervalMs: 300000, // 5 min
  });

  return {
    expenses,
    loading,
    addExpense,
    updateExpense,
    deleteExpense,
    refresh: fetchExpenses
  };
}
