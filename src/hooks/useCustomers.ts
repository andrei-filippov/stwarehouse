import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Customer } from '../types';

export function useCustomers(companyId: string | undefined) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', companyId)
      .order('name')
      .limit(1000);
    
    if (fetchError) {
      setError(fetchError.message);
      toast.error('Ошибка при загрузке клиентов', { description: fetchError.message });
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  }, [companyId]);

  const addCustomer = useCallback(async (customer: Partial<Customer>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { data, error: insertError } = await supabase
        .from('customers')
        .insert({ ...customer, company_id: companyId })
        .select()
        .single();

      if (insertError) throw insertError;

      await fetchCustomers();
      toast.success('Клиент добавлен');
      return { data, error: null };
    } catch (err: any) {
      toast.error('Ошибка при добавлении клиента', { description: err.message });
      return { data: null, error: err };
    }
  }, [companyId, fetchCustomers]);

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error: updateError } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);

      if (updateError) throw updateError;

      await fetchCustomers();
      toast.success('Клиент обновлён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении клиента', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchCustomers]);

  const deleteCustomer = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error: deleteError } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (deleteError) throw deleteError;

      await fetchCustomers();
      toast.success('Клиент удалён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении клиента', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchCustomers]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Real-time подписки
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('customers-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'customers', filter: `company_id=eq.${companyId}` },
        () => fetchCustomers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCustomers, companyId]);

  return {
    customers,
    loading,
    error,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    refresh: fetchCustomers
  };
}
