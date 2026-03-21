import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { ChecklistV2, EquipmentKit } from '../types/checklist';
import type { Estimate } from '../types';

export function useChecklistsV2(companyId: string | undefined) {
  const [checklists, setChecklists] = useState<ChecklistV2[]>([]);
  const [kits, setKits] = useState<EquipmentKit[]>([]);
  const [loading, setLoading] = useState(false);

  // Загрузка чек-листов с новой структурой
  const fetchChecklists = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('checklists')
        .select(`
          *,
          items:checklist_items(
            *,
            kit:equipment_kits(name)
          )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Трансформируем данные
      const transformed: ChecklistV2[] = (data || []).map((c: any) => ({
        ...c,
        items: (c.items || []).map((i: any) => ({
          ...i,
          kit_name: i.kit?.name
        })),
        loaded_count: (c.items || []).filter((i: any) => i.loaded).length,
        unloaded_count: (c.items || []).filter((i: any) => i.unloaded).length,
        total_count: (c.items || []).length
      }));

      setChecklists(transformed);
    } catch (err: any) {
      toast.error('Ошибка при загрузке чек-листов', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Загрузка комплектов
  const fetchKits = useCallback(async () => {
    if (!companyId) return;

    try {
      const { data, error } = await supabase
        .from('equipment_kits')
        .select(`
          *,
          items:kit_items(
            *,
            inventory:cable_inventory(name)
          )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformed: EquipmentKit[] = (data || []).map((k: any) => ({
        ...k,
        items: (k.items || []).map((i: any) => ({
          ...i,
          inventory_name: i.inventory?.name
        }))
      }));

      setKits(transformed);
    } catch (err: any) {
      toast.error('Ошибка при загрузке комплектов', { description: err.message });
    }
  }, [companyId]);

  // Создание чек-листа из сметы v2
  const createChecklistFromEstimate = useCallback(async (estimate: Estimate) => {
    if (!companyId) return { error: new Error('No company') };

    try {
      const { data, error } = await supabase.rpc('create_checklist_from_estimate_v2', {
        p_estimate_id: estimate.id,
        p_company_id: companyId
      });

      if (error) throw error;

      toast.success('Чек-лист создан', { description: `Создано из сметы: ${estimate.event_name}` });
      await fetchChecklists();
      return { data, error: null };
    } catch (err: any) {
      toast.error('Ошибка создания чек-листа', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchChecklists]);

  // Создание комплекта
  const createKit = useCallback(async (
    kit: Partial<EquipmentKit>,
    itemIds: string[]
  ) => {
    if (!companyId) return { error: new Error('No company') };

    try {
      // Создаем комплект
      const { data: kitData, error: kitError } = await supabase
        .from('equipment_kits')
        .insert({
          company_id: companyId,
          name: kit.name,
          description: kit.description,
          qr_code: `KIT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        })
        .select()
        .single();

      if (kitError) throw kitError;

      // Добавляем позиции в комплект
      const kitItems = itemIds.map(id => ({
        kit_id: kitData.id,
        inventory_id: id,
        quantity: 1
      }));

      const { error: itemsError } = await supabase
        .from('kit_items')
        .insert(kitItems);

      if (itemsError) throw itemsError;

      toast.success('Комплект создан', { description: kit.name });
      await fetchKits();
      return { data: kitData, error: null };
    } catch (err: any) {
      toast.error('Ошибка создания комплекта', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchKits]);

  // Удаление комплекта
  const deleteKit = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('equipment_kits')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Комплект удален');
      await fetchKits();
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка удаления', { description: err.message });
      return { error: err };
    }
  }, [fetchKits]);

  // Realtime подписки
  useEffect(() => {
    if (!companyId) return;

    const channels = [
      supabase.channel('checklists_v2_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checklists' }, fetchChecklists)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items' }, fetchChecklists)
        .subscribe(),
      supabase.channel('equipment_kits_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_kits' }, fetchKits)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'kit_items' }, fetchKits)
        .subscribe()
    ];

    return () => {
      channels.forEach(c => c.unsubscribe());
    };
  }, [companyId, fetchChecklists, fetchKits]);

  // Первичная загрузка
  useEffect(() => {
    fetchChecklists();
    fetchKits();
  }, [fetchChecklists, fetchKits]);

  return {
    checklists,
    kits,
    loading,
    fetchChecklists,
    createChecklistFromEstimate,
    createKit,
    deleteKit
  };
}
