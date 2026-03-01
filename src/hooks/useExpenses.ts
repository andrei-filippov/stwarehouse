import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Expense, ExpenseCategory } from '../types/expenses';

export function useExpenses(userId: string | undefined) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchExpenses = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) {
      toast.error('Ошибка при загрузке расходов', { description: error.message });
    } else if (data) {
      setExpenses(data as Expense[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchExpenses();
    
    // Realtime подписка на изменения
    const channel = supabase
      .channel('expenses_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'expenses' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setExpenses(prev => {
              if (prev.find(e => e.id === payload.new.id)) return prev;
              return [payload.new as Expense, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setExpenses(prev => prev.map(e => 
              e.id === payload.new.id ? payload.new as Expense : e
            ));
          } else if (payload.eventType === 'DELETE') {
            setExpenses(prev => prev.filter(e => e.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchExpenses]);

  const addExpense = async (expenseData: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('expenses')
      .insert([{ ...expenseData, user_id: userId }])
      .select()
      .single();
    
    if (error) {
      toast.error('Ошибка при добавлении расхода', { description: error.message });
    } else if (data) {
      setExpenses(prev => [data as Expense, ...prev]);
      toast.success('Расход добавлен');
    }
    return { error, data };
  };

  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    const { error } = await supabase
      .from('expenses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка при обновлении расхода', { description: error.message });
    } else {
      setExpenses(prev => prev.map(e => 
        e.id === id ? { ...e, ...updates } : e
      ));
      toast.success('Расход обновлен');
    }
    return { error };
  };

  const deleteExpense = async (id: string) => {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка при удалении расхода', { description: error.message });
    } else {
      setExpenses(prev => prev.filter(e => e.id !== id));
      toast.success('Расход удален');
    }
    return { error };
  };

  // Получить расходы за период
  const getExpensesByPeriod = useCallback((startDate: string, endDate: string) => {
    return expenses.filter(e => e.date >= startDate && e.date <= endDate);
  }, [expenses]);

  // Получить общую сумму расходов за период
  const getTotalExpenses = useCallback((startDate: string, endDate: string) => {
    return expenses
      .filter(e => e.date >= startDate && e.date <= endDate)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  // Статистика по категориям
  const getExpensesByCategory = useCallback((startDate: string, endDate: string) => {
    const filtered = expenses.filter(e => e.date >= startDate && e.date <= endDate);
    const stats: Record<ExpenseCategory, number> = {
      equipment: 0,
      consumables: 0,
      salary: 0,
      rent: 0,
      transport: 0,
      other: 0,
    };
    filtered.forEach(e => {
      stats[e.category] = (stats[e.category] || 0) + e.amount;
    });
    return stats;
  }, [expenses]);

  return {
    expenses,
    loading,
    addExpense,
    updateExpense,
    deleteExpense,
    getExpensesByPeriod,
    getTotalExpenses,
    getExpensesByCategory,
    refresh: fetchExpenses,
  };
}
