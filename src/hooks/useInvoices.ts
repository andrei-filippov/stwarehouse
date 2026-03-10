import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Invoice, InvoiceStatus } from '../types';

export function useInvoices(contractId?: string) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('invoices')
        .select(`
          *,
          contract:contract_id (
            id,
            number,
            customer:customer_id (
              id,
              name,
              inn,
              kpp,
              legal_address,
              bank_name,
              bank_bik,
              bank_account,
              bank_corr_account
            )
          )
        `)
        .order('date', { ascending: false });
      
      if (contractId) {
        query = query.eq('contract_id', contractId);
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      setInvoices(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки счетов');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  const createInvoice = useCallback(async (invoice: Partial<Invoice>) => {
    try {
      const { data, error: createError } = await supabase
        .from('invoices')
        .insert(invoice)
        .select()
        .single();
      
      if (createError) throw createError;
      
      await fetchInvoices();
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Ошибка создания счета' };
    }
  }, [fetchInvoices]);

  const updateInvoice = useCallback(async (id: string, updates: Partial<Invoice>) => {
    try {
      const { error: updateError } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      await fetchInvoices();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Ошибка обновления счета' };
    }
  }, [fetchInvoices]);

  const deleteInvoice = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
      
      await fetchInvoices();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Ошибка удаления счета' };
    }
  }, [fetchInvoices]);

  const getNextNumber = useCallback(async (year: number): Promise<string> => {
    try {
      const { data, error: rpcError } = await supabase
        .rpc('get_next_invoice_number', { p_year: year });
      
      if (rpcError) throw rpcError;
      
      return data || `001-${year}`;
    } catch (err) {
      console.error('Error getting next invoice number:', err);
      return `001-${year}`;
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('invoices-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'invoices' },
        () => fetchInvoices()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInvoices]);

  return {
    invoices,
    loading,
    error,
    refresh: fetchInvoices,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    getNextNumber,
  };
}
