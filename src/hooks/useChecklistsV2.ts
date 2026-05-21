import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import { useOptimisticMutation } from './useOptimisticMutation';
import type { ChecklistV2, EquipmentKit } from '../types/checklist';
import type { Estimate } from '../types';
import { logger } from '../lib/logger';
import { useRealtimeWithFallback } from './useRealtimeWithFallback';

export function useChecklistsV2(companyId: string | undefined, activeTab?: string) {
  const [checklists, setChecklists] = useState<ChecklistV2[]>([]);
  const [kits, setKits] = useState<EquipmentKit[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Optimistic mutations for instant UI updates
  const optimisticChecklists = useOptimisticMutation(setChecklists);
  const optimisticKits = useOptimisticMutation(setKits);

  // Загрузка чек-листов с новой структурой
  const fetchChecklists = useCallback(async (force = false) => {
    if (!companyId) return;
    const cacheKey = `fetchChecklists_${companyId}`;
    if (!force) {
      const cached = getCached<ChecklistV2[]>(cacheKey);
      if (cached) { setChecklists(cached); return; }
    }
    setLoading(true);

    try {
      // Single query with embedded relation to avoid N+1
      const { data: checklistsData, error: checklistsError } = await supabase
        .from('checklists')
        .select(`
          *,
          checklist_items(*)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (checklistsError) throw checklistsError;

      // Transform embedded data
      const transformed: ChecklistV2[] = (checklistsData || []).map((c: any) => {
        const items = c.checklist_items || [];
        return {
          ...c,
          items: items,
          loaded_count: items.filter((i: any) => i.loaded).length,
          unloaded_count: items.filter((i: any) => i.unloaded).length,
          total_count: items.length
        };
      });

      setChecklists(transformed);
      setCached(cacheKey, transformed);
    } catch (err: any) {
      // Пока таблицы не созданы - просто пустой массив
      logger.debug('Checklists v2 not loaded (tables may not exist):', err.message);
      setChecklists([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Загрузка комплектов
  const fetchKits = useCallback(async (force = false) => {
    if (!companyId) return;
    const cacheKey = `fetchKits_${companyId}`;
    if (!force) {
      const cached = getCached<EquipmentKit[]>(cacheKey);
      if (cached) { setKits(cached); return; }
    }

    try {
      // Single query with embedded relation to avoid N+1
      const { data: kitsData, error: kitsError } = await supabase
        .from('equipment_kits')
        .select(`
          *,
          kit_items(*, cable_inventory:inventory_id(name))
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (kitsError) throw kitsError;

      // Transform embedded data
      const transformed: EquipmentKit[] = (kitsData || []).map((k: any) => ({
        ...k,
        items: (k.kit_items || []).map((item: any) => ({
          ...item,
          inventory_name: item.inventory_name || item.cable_inventory?.name || 'Неизвестно'
        }))
      }));

      setKits(transformed);
    } catch (err: any) {
      // Пока таблицы не созданы - просто пустой массив
      logger.debug('Kits not loaded (tables may not exist):', err.message);
      setKits([]);
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

    // Optimistic add
    const tempId = `temp_${Date.now()}`;
    optimisticKits.add({
      ...kit,
      id: tempId,
      company_id: companyId,
      qr_code: `KIT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      created_at: new Date().toISOString()
    } as EquipmentKit);

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
      
      // Replace temp with real data
      if (kitData) {
        optimisticKits.update(tempId, kitData);
      }

      // Подсчитываем количество каждого inventory_id
      const quantityMap = new Map<string, number>();
      itemIds.forEach(id => {
        quantityMap.set(id, (quantityMap.get(id) || 0) + 1);
      });

      // Добавляем позиции в комплект с правильным количеством
      const kitItems = Array.from(quantityMap.entries()).map(([inventory_id, quantity]) => ({
        kit_id: kitData.id,
        inventory_id,
        quantity
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

  // Обновление комплекта
  const updateKit = useCallback(async (
    id: string,
    kit: Partial<EquipmentKit>,
    itemIds?: string[]
  ) => {
    try {
      // 1. Обновляем основную информацию о комплекте
      const { error: kitError } = await supabase
        .from('equipment_kits')
        .update({
          name: kit.name,
          description: kit.description,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (kitError) throw kitError;

      // 2. Если переданы itemIds - обновляем состав комплекта
      if (itemIds) {
        // Удаляем старые связи
        const { error: deleteError } = await supabase
          .from('kit_items')
          .delete()
          .eq('kit_id', id);

        if (deleteError) throw deleteError;

        // Добавляем новые связи с подсчетом количества
        if (itemIds.length > 0) {
          // Подсчитываем количество каждого inventory_id
          const quantityMap = new Map<string, number>();
          itemIds.forEach(inventoryId => {
            quantityMap.set(inventoryId, (quantityMap.get(inventoryId) || 0) + 1);
          });

          const kitItems = Array.from(quantityMap.entries()).map(([inventory_id, quantity]) => ({
            kit_id: id,
            inventory_id,
            quantity
          }));

          const { error: insertError } = await supabase
            .from('kit_items')
            .insert(kitItems);

          if (insertError) throw insertError;
        }
      }

      toast.success('Комплект обновлен');
      await fetchKits();
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка обновления', { description: err.message });
      return { error: err };
    }
  }, [companyId, fetchKits]);

  // Удаление комплекта
  const deleteKit = useCallback(async (id: string) => {
    // Optimistic remove
    optimisticKits.remove(id);
    
    try {
      const { error } = await supabase
        .from('equipment_kits')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Комплект удален');
      return { error: null };
    } catch (err: any) {
      toast.error('Ошибка удаления', { description: err.message });
      // Refetch on error to restore state
      await fetchKits();
      return { error: err };
    }
  }, [fetchKits, optimisticKits]);

  // Realtime on Vercel, smart polling on Yandex proxy
  useRealtimeWithFallback({
    channelName: 'checklists_v2_changes',
    companyId,
    tables: [
      { table: 'checklists', filter: `company_id=eq.${companyId}`, onChange: () => fetchChecklists(true) },
      { table: 'checklist_items', onChange: () => fetchChecklists(true) },
    ],
    pollingIntervalMs: 120000, // 2 min for checklists
  });

  // Kits: realtime only (no polling). Kits change rarely and are updated manually on tab open.
  useRealtimeWithFallback({
    channelName: 'equipment_kits_changes',
    companyId,
    tables: [
      { table: 'equipment_kits', filter: `company_id=eq.${companyId}`, onChange: () => fetchKits(true) },
      { table: 'kit_items', onChange: () => fetchKits(true) },
    ],
    pollingIntervalMs: 0, // No polling - kits updated manually or via realtime
  });

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
    updateKit,
    deleteKit
  };
}
