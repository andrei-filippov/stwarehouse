import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import type { CompanyBankAccount, Currency } from '../types';

export function useCompanyBankAccounts(companyId: string | undefined) {
  const [accounts, setAccounts] = useState<CompanyBankAccount[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAccounts = useCallback(async (force = false) => {
    if (!companyId) return;

    const cacheKey = `fetchAccounts_${companyId}`;
    if (!force) {
      const cached = getCached<any[]>(cacheKey);
      if (cached) { setAccounts(cached); return; }
    }
    setLoading(true);

    const { data, error } = await supabase
      .from('company_bank_accounts')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name');

    if (error) {
      toast.error('Ошибка загрузки счетов', { description: error.message });
    } else {
      setAccounts(data || []);
      setCached(cacheKey, data || []);
    }
    setLoading(false);
  }, [companyId]);

  const addAccount = useCallback(async (account: Partial<CompanyBankAccount>) => {
    if (!companyId) return { error: new Error('No company selected') };

    try {
      const { error } = await supabase
        .from('company_bank_accounts')
        .insert({ ...account, company_id: companyId });

      if (error) throw error;

      await fetchAccounts();
      toast.success('Счет добавлен');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при добавлении счета', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchAccounts]);

  const updateAccount = useCallback(async (id: string, updates: Partial<CompanyBankAccount>) => {
    if (!companyId) return { error: new Error('No company selected') };

    try {
      const { error } = await supabase
        .from('company_bank_accounts')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchAccounts();
      toast.success('Счет обновлен');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении счета', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchAccounts]);

  const deleteAccount = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };

    try {
      const { error } = await supabase
        .from('company_bank_accounts')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchAccounts();
      toast.success('Счет удален');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении счета', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchAccounts]);

  const setDefaultAccount = useCallback(async (id: string) => {
    return updateAccount(id, { is_default: true });
  }, [updateAccount]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('bank-accounts-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'company_bank_accounts', filter: `company_id=eq.${companyId}` },
        () => { if (document.hidden) return; fetchAccounts(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAccounts, companyId]);

  return {
    accounts,
    loading,
    addAccount,
    updateAccount,
    deleteAccount,
    setDefaultAccount,
    refresh: fetchAccounts,
  };
}
