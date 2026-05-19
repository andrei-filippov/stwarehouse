import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useRealtimeWithFallback } from './useRealtimeWithFallback';
import { getCached, setCached } from '../lib/queryCache';
import type { Contract, ContractTemplate, ContractType } from '../types';

export function useContracts(companyId: string | undefined) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchContracts = useCallback(async (force = false) => {
    if (!companyId) return;

    const cacheKey = `fetchContracts_${companyId}`;
    if (!force) {
      const cached = getCached<any[]>(cacheKey);
      if (cached) { setContracts(cached); return; }
    }
    setLoading(true);
    
    const { data, error } = await supabase
      .from('contracts')
      .select(`
        *,
        customer:customer_id (*),
        template:template_id (*),
        estimates:contract_estimates (
          *,
          estimate:estimate_id (*, items:estimate_items(*))
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Ошибка при загрузке договоров', { description: error.message });
    } else {
      setContracts(data || []);
      setCached(cacheKey, data || []);
    }
    setLoading(false);
  }, [companyId]);

  const fetchTemplates = useCallback(async (force = false) => {
    if (!companyId) return;

    const cacheKey = `fetchTemplates_${companyId}`;
    if (!force) {
      const cached = getCached<any[]>(cacheKey);
      if (cached) { setTemplates(cached); return; }
    }
    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    
    if (error) {
      toast.error('Ошибка при загрузке шаблонов', { description: error.message });
    } else {
      setTemplates(data || []);
      setCached(cacheKey, data || []);
    }
  }, [companyId]);

  const createContract = useCallback(async (
    contract: Partial<Contract>, 
    estimateIds: string[],
    bankAccountId?: string
  ) => {
    if (!companyId) return { error: new Error('No company selected'), data: null };
    
    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const optimisticContract = { 
      ...contract, 
      id: tempId, 
      company_id: companyId,
      bank_account_id: bankAccountId || null,
      created_at: new Date().toISOString()
    } as Contract;
    setContracts(prev => [optimisticContract, ...prev]);
    
    try {
      // Создаём договор с company_id и bank_account_id
      const { data: newContract, error: contractError } = await supabase
        .from('contracts')
        .insert({ 
          ...contract, 
          company_id: companyId,
          bank_account_id: bankAccountId || null
        })
        .select()
        .single();

      if (contractError) {
        setContracts(prev => prev.filter(c => c.id !== tempId));
        throw contractError;
      }

      // Связываем сметы
      if (estimateIds.length > 0) {
        const links = estimateIds.map((estimateId, index) => ({
          contract_id: newContract.id,
          estimate_id: estimateId,
          company_id: companyId,
          order_index: index
        }));

        const { error: linksError } = await supabase
          .from('contract_estimates')
          .insert(links);

        if (linksError) {
          setContracts(prev => prev.filter(c => c.id !== tempId));
          throw linksError;
        }
      }

      setContracts(prev => prev.map(c => c.id === tempId ? newContract : c));
      toast.success('Договор создан');
      return { data: newContract, error: null };
    } catch (err: any) {
      toast.error('Ошибка при создании договора', { description: err.message });
      return { data: null, error: err };
    }
  }, [companyId, fetchContracts]);

  const updateContract = useCallback(async (
    id: string, 
    updates: Partial<Contract>, 
    estimateIds: string[],
    bankAccountId?: string
  ) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    // Optimistic update
    const prevContract = contracts.find(c => c.id === id);
    setContracts(prev => prev.map(c => c.id === id ? { ...c, ...updates, bank_account_id: bankAccountId || null } : c));
    
    try {
      // Обновляем договор с bank_account_id
      const { error: contractError } = await supabase
        .from('contracts')
        .update({
          ...updates,
          bank_account_id: bankAccountId || null
        })
        .eq('id', id)
        .eq('company_id', companyId);

      if (contractError) {
        if (prevContract) setContracts(prev => prev.map(c => c.id === id ? prevContract : c));
        throw contractError;
      }

      // Удаляем старые связи
      await supabase
        .from('contract_estimates')
        .delete()
        .eq('contract_id', id);

      // Создаём новые связи
      if (estimateIds.length > 0) {
        const links = estimateIds.map((estimateId, index) => ({
          contract_id: id,
          estimate_id: estimateId,
          company_id: companyId,
          order_index: index
        }));

        const { error: linksError } = await supabase
          .from('contract_estimates')
          .insert(links);

        if (linksError) {
          if (prevContract) setContracts(prev => prev.map(c => c.id === id ? prevContract : c));
          throw linksError;
        }
      }

      toast.success('Договор обновлён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении договора', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchContracts]);

  const deleteContract = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    // Optimistic delete
    const prevContracts = contracts;
    setContracts(prev => prev.filter(c => c.id !== id));
    
    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) {
        setContracts(prevContracts);
        throw error;
      }

      toast.success('Договор удалён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при удалении договора', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchContracts]);

  const getNextContractNumber = useCallback(async (type: ContractType, year: number): Promise<string> => {
    if (!companyId) return `001-${year}У`;
    
    try {
      const { data, error } = await supabase
        .rpc('get_next_contract_number', { 
          p_year: year,
          p_type: type 
        });
      
      if (error) throw error;
      return data || `001-${year}У`;
    } catch (err) {
      console.error('Error getting next number:', err);
      return `001-${year}У`;
    }
  }, [companyId]);

  useEffect(() => {
    fetchContracts();
    fetchTemplates();
  }, [fetchContracts, fetchTemplates]);

  // Real-time подписки
  useRealtimeWithFallback({
    channelName: 'contracts-changes',
    companyId,
    tables: [
      { table: 'contracts', filter: `company_id=eq.${companyId}`, onChange: () => fetchContracts() },
    ],
    pollingIntervalMs: 300000, // 5 min
  });

  return {
    contracts,
    templates,
    loading,
    createContract,
    updateContract,
    deleteContract,
    getNextContractNumber,
    refresh: fetchContracts
  };
}
