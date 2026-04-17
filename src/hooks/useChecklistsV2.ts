import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { ChecklistV2, EquipmentKit } from '../types/checklist';
import type { Estimate } from '../types';
import { logger } from '../lib/logger';

export function useChecklistsV2(companyId: string | undefined) {
  const [checklists, setChecklists] = useState<ChecklistV2[]>([]);
  const [kits, setKits] = useState<EquipmentKit[]>([]);
  const [loading, setLoading] = useState(false);

  // Загрузка чек-листов с новой структурой
  const fetchChecklists = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      // Сначала загружаем чек-листы
      const { data: checklistsData, error: checklistsError } = await supabase
        .from('checklists')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (checklistsError) throw checklistsError;

      // Затем загружаем items для каждого чек-листа
      const transformed: ChecklistV2[] = await Promise.all((checklistsData || []).map(async (c: any) => {
        const { data: itemsData } = await supabase
          .from('checklist_items')
          .select('*')
          .eq('checklist_id', c.id);
        
        return {
          ...c,
          items: (itemsData || []),
          loaded_count: (itemsData || []).filter((i: any) => i.loaded).length,
          unloaded_count: (itemsData || []).filter((i: any) => i.unloaded).length,
          total_count: (itemsData || []).length
        };
      }));

      setChecklists(transformed);
    } catch (err: any) {
      // Пока таблицы не созданы - просто пустой массив
      logger.debug('Checklists v2 not loaded (tables may not exist):', err.message);
      setChecklists([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Загрузка комплектов
  const fetchKits = useCallback(async () => {
    if (!companyId) return;

    try {
      // Сначала загружаем kits
      const { data: kitsData, error: kitsError } = await supabase
        .from('equipment_kits')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (kitsError) throw kitsError;

      // Затем загружаем items для каждого kit с названиями оборудования
      const transformed: EquipmentKit[] = await Promise.all((kitsData || []).map(async (k: any) => {
        const { data: itemsData } = await supabase
          .from('kit_items')
          .select(`
            *,
            cable_inventory:inventory_id(name)
          `)
          .eq('kit_id', k.id);
        
        // Добавляем inventory_name из связанной таблицы
        const itemsWithNames = (itemsData || []).map((item: any) => ({
          ...item,
          inventory_name: item.inventory_name || item.cable_inventory?.name || 'Неизвестно'
        }));
        
        return {
          ...k,
          items: itemsWithNames
        };
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
    updateKit,
    deleteKit
  };
}
