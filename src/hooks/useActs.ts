import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Act, ActItem, ActStatus } from '../types';

export function useActs(contractId?: string, companyId?: string) {
  const [acts, setActs] = useState<Act[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActs = useCallback(async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('acts')
        .select(`
          *,
          items:act_items(*),
          contract:contract_id (
            id,
            number,
            date,
            bank_account_id,
            subject,
            customer:customer_id (
              id,
              name,
              inn,
              kpp,
              legal_address
            )
          ),
          invoice:invoice_id (
            id,
            number,
            date
          )
        `)
        .eq('company_id', companyId)
        .order('date', { ascending: false });
      
      if (contractId) {
        query = query.eq('contract_id', contractId);
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      setActs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки актов');
    } finally {
      setLoading(false);
    }
  }, [contractId, companyId]);

  const createAct = useCallback(async (act: Partial<Act>, items: Partial<ActItem>[]) => {
    try {
      if (!companyId) throw new Error('No company selected');
      
      // Удаляем id, чтобы PostgreSQL сгенерировал новый UUID
      const { id, ...actWithoutId } = act;
      
      // Создаем акт
      const { data: actData, error: actError } = await supabase
        .from('acts')
        .insert({ ...actWithoutId, company_id: companyId })
        .select()
        .single();
      
      if (actError) throw actError;
      
      // Создаем позиции
      if (items.length > 0) {
        const itemsWithActId = items.map((item, index) => {
          // Удаляем id, чтобы PostgreSQL сгенерировал новый UUID
          const { id, ...itemWithoutId } = item;
          return {
            ...itemWithoutId,
            act_id: actData.id,
            company_id: companyId,
            order_index: index,
          };
        });
        
        const { error: itemsError } = await supabase
          .from('act_items')
          .insert(itemsWithActId);
        
        if (itemsError) throw itemsError;
      }
      
      await fetchActs();
      return { data: actData, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Ошибка создания акта' };
    }
  }, [fetchActs, companyId]);

  const updateAct = useCallback(async (id: string, updates: Partial<Act>, items?: Partial<ActItem>[]) => {
    try {
      if (!companyId) throw new Error('No company selected');
      
      // Обновляем акт
      const { error: actError } = await supabase
        .from('acts')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId);
      
      if (actError) throw actError;
      
      // Обновляем позиции если переданы
      if (items) {
        // Удаляем старые
        await supabase.from('act_items').delete().eq('act_id', id);
        
        // Добавляем новые
        if (items.length > 0) {
          const itemsWithActId = items.map((item, index) => {
            // Удаляем id, чтобы PostgreSQL сгенерировал новый UUID
            const { id: itemId, ...itemWithoutId } = item;
            return {
              ...itemWithoutId,
              act_id: id,
              company_id: companyId,
              order_index: index,
            };
          });
          
          const { error: itemsError } = await supabase
            .from('act_items')
            .insert(itemsWithActId);
          
          if (itemsError) throw itemsError;
        }
      }
      
      await fetchActs();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Ошибка обновления акта' };
    }
  }, [fetchActs, companyId]);

  const deleteAct = useCallback(async (id: string) => {
    try {
      if (!companyId) throw new Error('No company selected');
      
      const { error: deleteError } = await supabase
        .from('acts')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);
      
      if (deleteError) throw deleteError;
      
      await fetchActs();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Ошибка удаления акта' };
    }
  }, [fetchActs, companyId]);

  const getNextNumber = useCallback(async (year: number): Promise<string> => {
    try {
      if (!companyId) return `001-${year}А`;
      
      const { data, error: rpcError } = await supabase
        .rpc('get_next_act_number', { p_year: year });
      
      if (rpcError) throw rpcError;
      
      return data || `001-${year}А`;
    } catch (err) {
      console.error('Error getting next act number:', err);
      return `001-${year}А`;
    }
  }, [companyId]);

  useEffect(() => {
    fetchActs();
  }, [fetchActs]);

  // Real-time subscription
  useEffect(() => {
    if (!companyId) return;
    
    const channel = supabase
      .channel('acts-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'acts', filter: `company_id=eq.${companyId}` },
        () => fetchActs()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'act_items', filter: `company_id=eq.${companyId}` },
        () => fetchActs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActs, companyId]);

  return {
    acts,
    loading,
    error,
    refresh: fetchActs,
    createAct,
    updateAct,
    deleteAct,
    getNextNumber,
  };
}
