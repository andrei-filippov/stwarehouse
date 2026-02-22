import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Estimate, EstimateItem } from '../types';

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
    
    if (error) {
      toast.error('Ошибка при загрузке смет', { description: error.message });
    } else if (data) {
      setEstimates(data as Estimate[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchEstimates();
  }, [fetchEstimates]);

  const createEstimate = async (estimate: Omit<Estimate, 'id' | 'created_at' | 'updated_at'>, items: Omit<EstimateItem, 'id' | 'estimate_id'>[], creatorName?: string) => {
    // Создаем смету
    const { data: estimateData, error: estimateError } = await supabase
      .from('estimates')
      .insert([{ ...estimate, creator_name: creatorName }])
      .select()
      .single();
    
    if (estimateError || !estimateData) {
      toast.error('Ошибка при создании сметы', { description: estimateError?.message });
      return { error: estimateError };
    }

    // Добавляем позиции
    if (items.length > 0) {
      const itemsWithEstimateId = items.map(item => ({
        equipment_id: item.equipment_id,
        name: item.name,
        description: item.description || '',
        quantity: item.quantity || 1,
        price: item.price || 0,
        unit: item.unit || 'шт',
        coefficient: item.coefficient || 1,
        category: item.category || '',
        estimate_id: estimateData.id
      }));
      
      const { error: itemsError } = await supabase
        .from('estimate_items')
        .insert(itemsWithEstimateId);
      
      if (itemsError) {
        toast.error('Ошибка при добавлении позиций сметы', { description: itemsError.message });
        return { error: itemsError };
      }
    }

    await fetchEstimates();
    toast.success('Смета создана', { description: estimate.name });
    return { error: null, data: estimateData };
  };

  const updateEstimate = async (id: string, estimate: Partial<Estimate>, items?: EstimateItem[]) => {
    // Обновляем смету
    const { error: estimateError } = await supabase
      .from('estimates')
      .update({ ...estimate, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (estimateError) {
      toast.error('Ошибка при обновлении сметы', { description: estimateError.message });
      return { error: estimateError };
    }

    // Если есть позиции — обновляем их
    if (items) {
      // Удаляем старые позиции
      await supabase.from('estimate_items').delete().eq('estimate_id', id);
      
      // Добавляем новые
      if (items.length > 0) {
        const cleanItems = items.map(item => ({
          equipment_id: item.equipment_id,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          unit: item.unit,
          coefficient: item.coefficient,
          category: item.category || '',
          estimate_id: id
        }));
        
        const { error: itemsError } = await supabase
          .from('estimate_items')
          .insert(cleanItems);
        
        if (itemsError) {
          toast.error('Ошибка при обновлении позиций сметы', { description: itemsError.message });
          return { error: itemsError };
        }
      }
    }

    await fetchEstimates();
    toast.success('Смета обновлена');
    return { error: null };
  };

  const deleteEstimate = async (id: string) => {
    const { error } = await supabase
      .from('estimates')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Ошибка при удалении сметы', { description: error.message });
    } else {
      setEstimates(prev => prev.filter(e => e.id !== id));
      toast.success('Смета удалена');
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
