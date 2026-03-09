import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Contract, ContractTemplate, ContractEstimateItem, ContractType } from '../types';

export function useContracts(userId: string | undefined) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Загрузка договоров
  const fetchContracts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          customer:customers(*),
          template:contract_templates(*),
          estimates:contract_estimates(
            *,
            estimate:estimates(
              *,
              items:estimate_items(*)
            )
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Contracts fetch error:', error);
        toast.error('Ошибка при загрузке договоров', { description: error.message || error.details || 'Неизвестная ошибка' });
        // Fallback: пробуем загрузить без связанных данных
        const { data: basicData, error: basicError } = await supabase
          .from('contracts')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!basicError && basicData) {
          setContracts(basicData as Contract[]);
          toast.info('Договоры загружены без связанных данных');
        }
      } else if (data) {
        // Преобразуем данные в правильный формат
        const formattedContracts = data.map((c: any) => ({
          ...c,
          estimates: c.estimates?.map((ce: any) => ({
            ...ce,
            estimate: ce.estimate
          })) || []
        }));
        setContracts(formattedContracts);
      }
    } catch (err) {
      console.error('Unexpected error fetching contracts:', err);
      toast.error('Ошибка при загрузке договоров');
    }
    setLoading(false);
  }, [userId]);

  // Загрузка шаблонов
  const fetchTemplates = useCallback(async () => {
    if (!userId) return;
    setTemplatesLoading(true);
    
    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name');
    
    if (error) {
      toast.error('Ошибка при загрузке шаблонов', { description: error.message });
    } else if (data) {
      setTemplates(data as ContractTemplate[]);
    }
    setTemplatesLoading(false);
  }, [userId]);

  // Получение следующего номера договора
  const getNextContractNumber = useCallback(async (type: ContractType, year: number): Promise<string> => {
    const typeCodes: Record<ContractType, string> = {
      service: 'У',
      rent: 'А',
      supply: 'П',
      mixed: 'С',
    };
    const typeCode = typeCodes[type] || 'У';
    const yearShort = year.toString().slice(-2);
    const pattern = `%-${yearShort}${typeCode}`;
    
    // Ищем максимальный номер для данного типа и года
    const { data, error } = await supabase
      .from('contracts')
      .select('number')
      .like('number', pattern)
      .order('number', { ascending: false })
      .limit(1);
    
    if (error || !data || data.length === 0) {
      return `01-${yearShort}${typeCode}`;
    }
    
    // Парсим номер и увеличиваем
    const lastNumber = data[0].number;
    const match = lastNumber.match(/^(\d+)-/);
    if (match) {
      const seq = parseInt(match[1], 10) + 1;
      return `${seq.toString().padStart(2, '0')}-${yearShort}${typeCode}`;
    }
    
    return `01-${yearShort}${typeCode}`;
  }, []);

  // Создание договора
  const createContract = async (
    contract: Omit<Contract, 'id' | 'created_at' | 'updated_at'>,
    estimateIds: string[] = []
  ) => {
    if (!userId) return { error: new Error('Not authenticated'), data: null };
    
    try {
      // Создаём договор
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .insert([{ ...contract, user_id: userId }])
        .select()
        .single();
      
      if (contractError || !contractData) {
        toast.error('Ошибка при создании договора', { description: contractError?.message });
        return { error: contractError, data: null };
      }

      // Добавляем связи со сметами
      if (estimateIds.length > 0) {
        const contractEstimates = estimateIds.map((estimateId, index) => ({
          contract_id: contractData.id,
          estimate_id: estimateId,
          order_index: index,
        }));
        
        const { error: ceError } = await supabase
          .from('contract_estimates')
          .insert(contractEstimates);
        
        if (ceError) {
          toast.error('Ошибка при привязке смет', { description: ceError.message });
        }
      }

      toast.success('Договор создан', { description: `№ ${contract.number}` });
      await fetchContracts();
      return { error: null, data: contractData };
    } catch (err) {
      console.error('Create contract error:', err);
      return { error: err, data: null };
    }
  };

  // Обновление договора
  const updateContract = async (
    id: string, 
    updates: Partial<Contract>,
    estimateIds?: string[]
  ) => {
    try {
      const { error } = await supabase
        .from('contracts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        toast.error('Ошибка при обновлении договора', { description: error.message });
        return { error };
      }

      // Обновляем связи со сметами если переданы
      if (estimateIds !== undefined) {
        // Удаляем старые связи
        await supabase.from('contract_estimates').delete().eq('contract_id', id);
        
        // Добавляем новые
        if (estimateIds.length > 0) {
          const contractEstimates = estimateIds.map((estimateId, index) => ({
            contract_id: id,
            estimate_id: estimateId,
            order_index: index,
          }));
          
          await supabase.from('contract_estimates').insert(contractEstimates);
        }
      }

      toast.success('Договор обновлён');
      await fetchContracts();
      return { error: null };
    } catch (err) {
      console.error('Update contract error:', err);
      return { error: err };
    }
  };

  // Удаление договора
  const deleteContract = async (id: string) => {
    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', id);
      
      if (error) {
        toast.error('Ошибка при удалении договора', { description: error.message });
      } else {
        setContracts(prev => prev.filter(c => c.id !== id));
        toast.success('Договор удалён');
      }
      return { error };
    } catch (err) {
      console.error('Delete contract error:', err);
      return { error: err };
    }
  };

  // Создание шаблона
  const createTemplate = async (template: Omit<ContractTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    if (!userId) return { error: new Error('Not authenticated'), data: null };
    
    try {
      const { data, error } = await supabase
        .from('contract_templates')
        .insert([{ ...template, user_id: userId }])
        .select()
        .single();
      
      if (error) {
        toast.error('Ошибка при создании шаблона', { description: error.message });
        return { error, data: null };
      }

      toast.success('Шаблон создан', { description: template.name });
      await fetchTemplates();
      return { error: null, data };
    } catch (err) {
      console.error('Create template error:', err);
      return { error: err, data: null };
    }
  };

  // Обновление шаблона
  const updateTemplate = async (id: string, updates: Partial<ContractTemplate>) => {
    try {
      const { error } = await supabase
        .from('contract_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        toast.error('Ошибка при обновлении шаблона', { description: error.message });
      } else {
        toast.success('Шаблон обновлён');
        await fetchTemplates();
      }
      return { error };
    } catch (err) {
      console.error('Update template error:', err);
      return { error: err };
    }
  };

  // Удаление шаблона
  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('contract_templates')
        .delete()
        .eq('id', id);
      
      if (error) {
        toast.error('Ошибка при удалении шаблона', { description: error.message });
      } else {
        setTemplates(prev => prev.filter(t => t.id !== id));
        toast.success('Шаблон удалён');
      }
      return { error };
    } catch (err) {
      console.error('Delete template error:', err);
      return { error: err };
    }
  };

  useEffect(() => {
    fetchContracts();
    fetchTemplates();
  }, [fetchContracts, fetchTemplates]);

  return {
    contracts,
    templates,
    loading,
    templatesLoading,
    createContract,
    updateContract,
    deleteContract,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getNextContractNumber,
    refreshContracts: fetchContracts,
    refreshTemplates: fetchTemplates,
  };
}
