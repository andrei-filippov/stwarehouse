import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Act, ActItem, ActStatus } from '../types';

export function useActs(contractId?: string) {
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
          items:act_items (*),
          contract:contract_id (
            id,
            number,
            date,
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
  }, [contractId]);

  const createAct = useCallback(async (act: Partial<Act>, items: Partial<ActItem>[]) => {
    try {
      // Создаем акт
      const { data: actData, error: actError } = await supabase
        .from('acts')
        .insert(act)
        .select()
        .single();
      
      if (actError) throw actError;
      
      // Создаем позиции
      if (items.length > 0) {
        const itemsWithActId = items.map((item, index) => ({
          ...item,
          act_id: actData.id,
          order_index: index,
        }));
        
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
  }, [fetchActs]);

  const updateAct = useCallback(async (id: string, updates: Partial<Act>, items?: Partial<ActItem>[]) => {
    try {
      // Обновляем акт
      const { error: actError } = await supabase
        .from('acts')
        .update(updates)
        .eq('id', id);
      
      if (actError) throw actError;
      
      // Обновляем позиции если переданы
      if (items) {
        // Удаляем старые
        await supabase.from('act_items').delete().eq('act_id', id);
        
        // Добавляем новые
        if (items.length > 0) {
          const itemsWithActId = items.map((item, index) => ({
            ...item,
            act_id: id,
            order_index: index,
          }));
          
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
  }, [fetchActs]);

  const deleteAct = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('acts')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
      
      await fetchActs();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Ошибка удаления акта' };
    }
  }, [fetchActs]);

  const getNextNumber = useCallback(async (year: number): Promise<string> => {
    try {
      const { data, error: rpcError } = await supabase
        .rpc('get_next_act_number', { p_year: year });
      
      if (rpcError) throw rpcError;
      
      return data || `001-${year}А`;
    } catch (err) {
      console.error('Error getting next act number:', err);
      return `001-${year}А`;
    }
  }, []);

  useEffect(() => {
    fetchActs();
  }, [fetchActs]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('acts-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'acts' },
        () => fetchActs()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'act_items' },
        () => fetchActs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActs]);

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
