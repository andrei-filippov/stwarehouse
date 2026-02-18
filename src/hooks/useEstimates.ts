import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Estimate, EstimateItem } from '../types';

export function useEstimates(userId: string | undefined) {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEstimates = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('estimates')
      .select(`
        *,
        items:estimate_items(*)
      `)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setEstimates(data as Estimate[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchEstimates();
  }, [fetchEstimates]);

  const createEstimate = async (estimate: Omit<Estimate, 'id' | 'created_at' | 'updated_at'>, items: Omit<EstimateItem, 'id' | 'estimate_id'>[]) => {
    // Создаем смету
    const { data: estimateData, error: estimateError } = await supabase
      .from('estimates')
      .insert([estimate])
      .select()
      .single();
    
    if (estimateError || !estimateData) {
      return { error: estimateError };
    }

    // Добавляем позиции
    if (items.length > 0) {
      const itemsWithEstimateId = items.map(item => ({
        ...item,
        estimate_id: estimateData.id
      }));
      
      const { error: itemsError } = await supabase
        .from('estimate_items')
        .insert(itemsWithEstimateId);
      
      if (itemsError) {
        return { error: itemsError };
      }
    }

    await fetchEstimates();
    return { error: null, data: estimateData };
  };

  const updateEstimate = async (id: string, estimate: Partial<Estimate>, items?: EstimateItem[]) => {
    // Обновляем смету
    const { error: estimateError } = await supabase
      .from('estimates')
      .update({ ...estimate, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (estimateError) {
      return { error: estimateError };
    }

    // Если есть позиции — обновляем их
    if (items) {
      // Удаляем старые позиции
      await supabase.from('estimate_items').delete().eq('estimate_id', id);
      
      // Добавляем новые
      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('estimate_items')
          .insert(items.map(item => ({
            ...item,
            estimate_id: id
          })));
        
        if (itemsError) {
          return { error: itemsError };
        }
      }
    }

    await fetchEstimates();
    return { error: null };
  };

  const deleteEstimate = async (id: string) => {
    const { error } = await supabase
      .from('estimates')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setEstimates(prev => prev.filter(e => e.id !== id));
    }
    return { error };
  };

  return {
    estimates,
    loading,
    createEstimate,
    updateEstimate,
    deleteEstimate,
    refresh: fetchEstimates
  };
}