import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Contract, ContractTemplate, ContractType } from '../types';

export function useContracts(companyId: string | undefined) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchContracts = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('contracts')
      .select(`
        *,
        customer:customer_id (*),
        template:template_id (*),
        estimates:contract_estimates (
          *,
          estimate:estimate_id (*)
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Ошибка при загрузке договоров', { description: error.message });
    } else {
      setContracts(data || []);
    }
    setLoading(false);
  }, [companyId]);

  const fetchTemplates = useCallback(async () => {
    if (!companyId) return;
    
    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    
    if (error) {
      toast.error('Ошибка при загрузке шаблонов', { description: error.message });
    } else {
      setTemplates(data || []);
    }
  }, [companyId]);

  const createContract = useCallback(async (
    contract: Partial<Contract>, 
    estimateIds: string[],
    bankAccountId?: string
  ) => {
    if (!companyId) return { error: new Error('No company selected'), data: null };
    
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

      if (contractError) throw contractError;

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

        if (linksError) throw linksError;
      }

      await fetchContracts();
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

      if (contractError) throw contractError;

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

        if (linksError) throw linksError;
      }

      await fetchContracts();
      toast.success('Договор обновлён');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка при обновлении договора', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchContracts]);

  const deleteContract = useCallback(async (id: string) => {
    if (!companyId) return { error: new Error('No company selected') };
    
    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;

      await fetchContracts();
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
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('contracts-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'contracts', filter: `company_id=eq.${companyId}` },
        () => fetchContracts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchContracts, companyId]);

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
